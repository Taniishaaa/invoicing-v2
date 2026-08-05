"""
SBOSS Invoice Parser
--------------------
Flow:
  1. Read PDF from local disk
  2. Extract raw text with pdfplumber
  3. Bill guard — confirm IRN exists (proves it's a GST e-invoice)
  4. Extract all GSTINs from invoice → derive PANs from them (chars 3-12)
  5. PAN check (dual) — vendor PAN must be embedded in a valid GSTIN AND/OR explicitly printed
  6. Determine CGST/SGST vs IGST using state codes from vendor + SBOSS GSTINs
  7. Claude Haiku — structured extraction with tax-type hint
  8. Credit note guard — reject if Claude detects a credit note
  9. Validate Claude output (tax type consistency check)
  10. Return structured result

Official GST rule: GSTIN chars 3-12 (0-indexed: 2-11) = PAN of the entity.
Source: GST portal / CBIC. Valid for all normal taxpayers (companies, LLPs, firms, proprietors).
"""

import re
import json
import os
import io
import pdfplumber
import anthropic

from dotenv import load_dotenv
load_dotenv()

# ── Claude client ──────────────────────────────────────────────────────────────
claude = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
CLAUDE_MODEL = "claude-haiku-4-5-20251001"

# ── SBOSS hardcoded PAN (recipient / buyer) ────────────────────────────────────
# SBOSS GSTIN: 05ABJCS0628K1Z8 → PAN = ABJCS0628K
SBOSS_PAN = "ABJCS0628K"

# ── All Indian GST state/UT codes (Census 2011 classification) ─────────────────
GST_STATE_CODES = {
    "01": "Jammu & Kashmir",
    "02": "Himachal Pradesh",
    "03": "Punjab",
    "04": "Chandigarh",
    "05": "Uttarakhand",
    "06": "Haryana",
    "07": "Delhi",
    "08": "Rajasthan",
    "09": "Uttar Pradesh",
    "10": "Bihar",
    "11": "Sikkim",
    "12": "Arunachal Pradesh",
    "13": "Nagaland",
    "14": "Manipur",
    "15": "Mizoram",
    "16": "Tripura",
    "17": "Meghalaya",
    "18": "Assam",
    "19": "West Bengal",
    "20": "Jharkhand",
    "21": "Odisha",
    "22": "Chhattisgarh",
    "23": "Madhya Pradesh",
    "24": "Gujarat",
    "26": "Dadra & Nagar Haveli & Daman & Diu",
    "27": "Maharashtra",
    "29": "Karnataka",
    "30": "Goa",
    "31": "Lakshadweep",
    "32": "Kerala",
    "33": "Tamil Nadu",
    "34": "Puducherry",
    "35": "Andaman & Nicobar Islands",
    "36": "Telangana",
    "37": "Andhra Pradesh",
    "38": "Ladakh",
    "97": "Other Territory",
    "99": "Other Country",
}

# ── Regex helpers ──────────────────────────────────────────────────────────────
GSTIN_RE = re.compile(
    r'(?<![A-Z0-9])([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z])(?![A-Z0-9])'
)


# ── IRN finder (handles split-line IRNs) ───────────────────────────────────────
def find_irn(text: str) -> str | None:
    """
    GST e-invoices have a 64-character hex IRN.
    Handles single-line and split IRNs across all known vendor formats.
    Filters out purely-numeric tokens (Ack No etc.) by requiring at least one a-f letter.
    """
    def find_64_pair(search_text: str) -> str | None:
        # Only tokens with at least one hex letter — filters out pure-numeric Ack No
        tokens = [t for t in re.finditer(r'[0-9a-fA-F]{8,}', search_text)
                  if re.search(r'[a-fA-F]', t.group())]
        for i in range(len(tokens)):
            seg1 = tokens[i].group()
            if len(seg1) >= 64:
                continue
            for j in range(i + 1, min(i + 5, len(tokens))):
                seg2 = tokens[j].group()
                if len(seg1) + len(seg2) == 64:
                    return (seg1 + seg2).lower()
        return None

    # 1. Full 64-char IRN on one line
    m = re.search(r'(?<![0-9a-fA-F])([0-9a-fA-F]{64})(?![0-9a-fA-F])', text)
    if m:
        return m.group(1).lower()

    # 2. Search in 300 chars near IRN label
    irn_label = re.search(r'IRN\b', text, re.IGNORECASE)
    if irn_label:
        result = find_64_pair(text[irn_label.end():irn_label.end() + 300])
        if result:
            return result

    # 3. Full text fallback
    return find_64_pair(text)


# ── GSTIN + PAN extraction ─────────────────────────────────────────────────────
def extract_gstins_and_pans(text: str) -> tuple[set, set]:
    """
    Extract all GSTINs from text.
    Derive PANs only from GSTINs — direct whole-document PAN string matching
    is too loose (any ABCDE1234F-shaped token, e.g. an invoice number, would
    match), so the expected PAN is checked directly against the text separately.
    """
    upper = text.upper()
    gstins = set(GSTIN_RE.findall(upper))
    pans = {gstin[2:12] for gstin in gstins}  # official PAN position in GSTIN
    return gstins, pans


# ── State code helpers ─────────────────────────────────────────────────────────
def state_from_gstin(gstin: str) -> tuple[str, str] | tuple[None, None]:
    if not gstin or len(gstin) < 2:
        return None, None
    code = gstin[:2]
    return code, GST_STATE_CODES.get(code)


def determine_tax_type(vendor_gstin: str, sboss_gstin: str) -> str:
    if not vendor_gstin or not sboss_gstin:
        return "unknown"
    vendor_code = vendor_gstin[:2]
    sboss_code  = sboss_gstin[:2]
    if vendor_code == sboss_code:
        return "cgst_sgst"
    return "igst"


# ── Claude extraction prompt ───────────────────────────────────────────────────
EXTRACTION_PROMPT = """You are an expert Indian GST e-invoice data extractor.

Extract the following fields from this invoice text and return ONLY a valid JSON object with no extra text, no markdown, no explanation.

TAX TYPE HINT: This invoice is expected to have {tax_type_hint}. Use this to correctly identify CGST/SGST vs IGST amounts.

Fields to extract:

- invoice_number  : Invoice number/ID (string)
- irn             : IRN — the 64-character hex hash. If split across lines, join them. (string or null)
- invoice_date    : Invoice date in YYYY-MM-DD format (string or null)
- invoice_type    : "credit_note" if it's a credit note, otherwise "regular"

Vendor / HR Partner — the SUPPLIER (listed under "Bill From", "Supplier", "Seller", or at top of invoice):
- hr_partner_name    : Company name of the vendor/supplier
- hr_partner_gstin   : GSTIN of vendor (string or null)
- hr_partner_pan     : PAN of vendor. Derive from vendor GSTIN chars 3-12 if not explicitly printed. (string or null)
- hr_partner_state   : State of vendor — derive from first 2 digits of their GSTIN using the GST state code table. Return full state name. (string or null)
- hr_partner_address : BILLING address of the vendor — the address from which this invoice is being raised / place of supply. NOT the head office address if different. Use the address associated with the vendor's GSTIN on this invoice. (string or null)

SBI / SBOSS — the RECIPIENT/BUYER (listed under "Bill To", "Recipient", "Buyer"):
- sboss_name    : Company/entity name of the recipient
- sboss_gstin   : GSTIN of recipient (string or null)
- sboss_pan     : PAN of recipient. Derive from SBOSS GSTIN chars 3-12. Should be ABJCS0628K. (string or null)
- sboss_state   : State of recipient — derive from first 2 digits of their GSTIN. Return full state name. (string or null)
- sboss_address : BILLING address of the recipient as printed on this invoice. (string or null)

CRITICAL RULES:
- Supplier and recipient are DIFFERENT companies with DIFFERENT GSTINs.
- {tax_type_rule}
- For CGST+SGST invoices: igst_amount must be null.
- For IGST invoices: cgst_amount and sgst_amount must be null.
- PAN = characters 3 to 12 (1-indexed) of GSTIN. Example: GSTIN 27AAECI0979D1ZQ → PAN = AAECI0979D.

Amounts (numbers, not strings — null if not found):
- amount_of_service : Base service amount (manpower/salary cost line item)
- service_charges   : Sum of extra charges on top (admin, PF, EDLI, etc.) — null if none
- taxable_amount    : Taxable value (= amount_of_service + service_charges)
- cgst_amount       : CGST amount (null if IGST invoice)
- sgst_amount       : SGST amount (null if IGST invoice)
- igst_amount       : IGST amount (null if CGST/SGST invoice)
- round_off         : Round off if present (can be negative) — null if not present
- invoice_value     : Total invoice value including all tax and round off

Other:
- description : Brief description of service from invoice (string or null)

Return ONLY the JSON object.

Invoice text:
{invoice_text}"""


# ── Main entry point ────────────────────────────────────────────────────────────
def process_invoice(
    pdf_bytes: bytes,
    vendor_pan: str,
    service_group: str = None,
    nature: str = None,
) -> dict:

    # ── Step 1: Extract text 
    try:
        pdf_text = ""
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    pdf_text += page_text + "\n"
    except Exception as e:
        return _error(f"Failed to read PDF: {str(e)}")

    if not pdf_text.strip():
        return _error("PDF appears to be empty or scanned — no text could be extracted")

    # ── Step 3: Bill guard — IRN check ────────────────────────────────────────
    irn_found = find_irn(pdf_text)
    if not irn_found:
        return _reject(
            "This does not appear to be a valid GST e-invoice. "
            "IRN (Invoice Reference Number) not found. "
            "Please upload only GST e-invoices."
        )

    # ── Step 4: Extract GSTINs and PANs ───────────────────────────────────────
    gstins_in_pdf, pans_in_pdf = extract_gstins_and_pans(pdf_text)
    expected_pan = vendor_pan.strip().upper()

    # ── Step 5: PAN check — explicit text OR embedded in valid GSTIN ──────────
    vendor_gstin_matches = [g for g in gstins_in_pdf if g[2:12] == expected_pan]

    pan_in_text = bool(re.search(
        r'(?<![A-Z])' + re.escape(expected_pan) + r'(?![A-Z0-9])',
        pdf_text.upper()
    ))

    if not pan_in_text and not vendor_gstin_matches:
        return _reject(
            f"PAN mismatch. Your registered PAN ({expected_pan}) was not found in this invoice "
            f"(checked both explicit PAN text and GSTIN). "
            f"Please ensure you are uploading your own company's invoice."
        )

    # ── Step 6: Determine tax type from GSTINs ────────────────────────────────
    vendor_gstin = vendor_gstin_matches[0] if vendor_gstin_matches else None
    sboss_gstin  = next((g for g in gstins_in_pdf if g[2:12] == SBOSS_PAN), None)

    tax_type = determine_tax_type(vendor_gstin, sboss_gstin)

    vendor_state_code, vendor_state_name = state_from_gstin(vendor_gstin) if vendor_gstin else (None, None)
    sboss_state_code,  sboss_state_name  = state_from_gstin(sboss_gstin)  if sboss_gstin  else (None, None)

    if tax_type == "cgst_sgst":
        tax_type_hint = "CGST + SGST (intra-state supply — both parties are in the same state)"
        tax_type_rule = "Both parties have the same state code in their GSTIN, so this is an intra-state invoice. Extract CGST and SGST amounts. igst_amount must be null."
    elif tax_type == "igst":
        tax_type_hint = "IGST (inter-state supply — parties are in different states)"
        tax_type_rule = "Parties have different state codes in their GSTINs, so this is an inter-state invoice. Extract IGST amount. cgst_amount and sgst_amount must be null."
    else:
        tax_type_hint = "CGST+SGST or IGST (could not determine from GSTINs — extract whatever is on the invoice)"
        tax_type_rule = "Extract whichever tax type appears on the invoice."

    # ── Step 7: Claude extraction ──────────────────────────────────────────────
    invoice_text_for_claude = pdf_text[:6000]

    try:
        message = claude.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=1024,
            messages=[
                {
                    "role": "user",
                    "content": EXTRACTION_PROMPT.format(
                        invoice_text=invoice_text_for_claude,
                        tax_type_hint=tax_type_hint,
                        tax_type_rule=tax_type_rule,
                    ),
                }
            ],
        )
        text_block = next((b for b in message.content if hasattr(b, 'text')), None)
        if not text_block:
            return _error("Claude returned no text content")
        raw_response = text_block.text.strip()
    except Exception as e:
        return _error(f"Claude extraction failed: {str(e)}")

    # ── Step 8: Parse Claude JSON ──────────────────────────────────────────────
    try:
        clean = raw_response
        if clean.startswith("```"):
            clean = re.sub(r"^```[a-z]*\n?", "", clean)
            clean = re.sub(r"\n?```$", "", clean)
        data = json.loads(clean.strip())
    except json.JSONDecodeError as e:
        return _error(f"Failed to parse Claude response as JSON: {str(e)}\nRaw: {raw_response[:200]}")

    # ── Step 9: Invoice number check ──────────────────────────────────────────
    invoice_number = (data.get("invoice_number") or "").strip()
    if not invoice_number:
        return _reject(
            "Could not extract invoice number from this PDF. "
            "Please ensure this is a valid GST e-invoice."
        )

    # ── Step 9b: Credit note guard ─────────────────────────────────────────────
    if (data.get("invoice_type") or "").strip().lower() == "credit_note":
        return _reject(
            "This appears to be a Credit Note, not a regular invoice. "
            "Please use the 'Upload Credit Notes' page to upload credit notes."
        )

    # ── Step 10: Tax type validation ──────────────────────────────────────────
    tax_validation_warning = None
    if tax_type == "cgst_sgst" and data.get("igst_amount"):
        tax_validation_warning = (
            f"Warning: State codes suggest intra-state (CGST+SGST) but invoice has IGST. "
            f"Vendor state: {vendor_state_name}, SBOSS state: {sboss_state_name}. Please verify."
        )
    elif tax_type == "igst" and (data.get("cgst_amount") or data.get("sgst_amount")):
        tax_validation_warning = (
            f"Warning: State codes suggest inter-state (IGST) but invoice has CGST/SGST. "
            f"Vendor state: {vendor_state_name}, SBOSS state: {sboss_state_name}. Please verify."
        )

    return {
        "success":  True,
        "rejected": False,

        "invoice_number": invoice_number,
        "irn":            (data.get("irn") or irn_found or "").strip() or None,
        "invoice_date":   data.get("invoice_date"),
        "invoice_type":   data.get("invoice_type") or "regular",

        "hr_partner_name":    data.get("hr_partner_name"),
        "hr_partner_gstin":   data.get("hr_partner_gstin") or vendor_gstin,
        "hr_partner_pan":     data.get("hr_partner_pan") or expected_pan,
        "hr_partner_state":   data.get("hr_partner_state") or vendor_state_name,
        "hr_partner_address": data.get("hr_partner_address"),

        "sboss_name":    data.get("sboss_name"),
        "sboss_gstin":   data.get("sboss_gstin") or sboss_gstin,
        "sboss_pan":     data.get("sboss_pan") or SBOSS_PAN,
        "sboss_state":   data.get("sboss_state") or sboss_state_name,
        "sboss_address": data.get("sboss_address"),

        "amount_of_service": _to_decimal(data.get("amount_of_service")),
        "service_charges":   _to_decimal(data.get("service_charges")),
        "taxable_amount":    _to_decimal(data.get("taxable_amount")),
        "cgst_amount":       _to_decimal(data.get("cgst_amount")),
        "sgst_amount":       _to_decimal(data.get("sgst_amount")),
        "igst_amount":       _to_decimal(data.get("igst_amount")),
        "round_off":         _to_decimal(data.get("round_off")),
        "invoice_value":     _to_decimal(data.get("invoice_value")),

        "description":             data.get("description"),
        "original_invoice_number": None,

        "tax_type":               tax_type,
        "tax_validation_warning": tax_validation_warning,
        "raw_extraction":         data,
    }


# ── Helpers ───────────────────────────────────────────────────────────────────
def _error(message: str) -> dict:
    return {"success": False, "rejected": False, "error": message}


def _reject(message: str) -> dict:
    return {"success": False, "rejected": True, "error": message}


def _to_decimal(value) -> float | None:
    if value is None:
        return None
    try:
        return float(str(value).replace(",", "").strip())
    except (ValueError, TypeError):
        return None
