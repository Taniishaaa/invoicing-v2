"""
SBOSS Credit Note Parser
------------------------
Separate from the regular invoice parser.

Flow:
  1. Read PDF from local disk
  2. Extract raw text with pdfplumber
  3. No IRN check — credit notes are NOT required to be GST e-invoices
  4. PAN check — vendor PAN must be explicitly printed OR embedded in a valid GSTIN
  5. Determine CGST/SGST vs IGST from GSTINs found
  6. Claude Haiku — extract CN fields including original invoice reference number
  7. Return structured result

The critical field is original_invoice_number — the invoice this CN is issued against.
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

# ── SBOSS hardcoded PAN ────────────────────────────────────────────────────────
SBOSS_PAN = "ABJCS0628K"

# ── GST state codes ────────────────────────────────────────────────────────────
GST_STATE_CODES = {
    "01": "Jammu & Kashmir",   "02": "Himachal Pradesh",  "03": "Punjab",
    "04": "Chandigarh",        "05": "Uttarakhand",        "06": "Haryana",
    "07": "Delhi",             "08": "Rajasthan",          "09": "Uttar Pradesh",
    "10": "Bihar",             "11": "Sikkim",             "12": "Arunachal Pradesh",
    "13": "Nagaland",          "14": "Manipur",            "15": "Mizoram",
    "16": "Tripura",           "17": "Meghalaya",          "18": "Assam",
    "19": "West Bengal",       "20": "Jharkhand",          "21": "Odisha",
    "22": "Chhattisgarh",      "23": "Madhya Pradesh",     "24": "Gujarat",
    "26": "Dadra & Nagar Haveli & Daman & Diu",
    "27": "Maharashtra",       "29": "Karnataka",          "30": "Goa",
    "31": "Lakshadweep",       "32": "Kerala",             "33": "Tamil Nadu",
    "34": "Puducherry",        "35": "Andaman & Nicobar Islands",
    "36": "Telangana",         "37": "Andhra Pradesh",     "38": "Ladakh",
    "97": "Other Territory",   "99": "Other Country",
}

GSTIN_RE = re.compile(r'(?<![A-Z0-9])([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z])(?![A-Z0-9])')


def extract_gstins_and_pans(text: str):
    """
    Derive PANs only from GSTINs — direct whole-document PAN string matching
    is too loose (any ABCDE1234F-shaped token, e.g. an invoice number, would
    match), so the expected PAN is checked directly against the text separately.
    """
    upper  = text.upper()
    gstins = set(GSTIN_RE.findall(upper))
    pans   = {g[2:12] for g in gstins}
    return gstins, pans


def state_from_gstin(gstin: str):
    if not gstin or len(gstin) < 2:
        return None, None
    code = gstin[:2]
    return code, GST_STATE_CODES.get(code)


def determine_tax_type(vendor_gstin: str, sboss_gstin: str) -> str:
    if not vendor_gstin or not sboss_gstin:
        return "unknown"
    return "cgst_sgst" if vendor_gstin[:2] == sboss_gstin[:2] else "igst"


# ── Extraction prompt ──────────────────────────────────────────────────────────
EXTRACTION_PROMPT = """You are an expert Indian GST credit note data extractor.

Extract the following fields from this credit note and return ONLY a valid JSON object with no extra text, no markdown.

TAX TYPE HINT: {tax_type_hint}. {tax_type_rule}

Fields to extract:

- credit_note_number   : The credit note number / document number (string)
- credit_note_date     : Date of the credit note in YYYY-MM-DD format (string or null)
- original_invoice_number : CRITICAL — the invoice number of the ORIGINAL invoice this credit note is issued against.
  Look for phrases such as:
    "Credit Note against Invoice No", "Original Invoice No", "Against Invoice",
    "Ref Invoice", "Being credit note against", "Original Bill No", "Ref No",
    "Against Invoice Reference", "In respect of Invoice", "Reversal of Invoice".
  This is the most important field. (string or null)

Vendor / Supplier (the party issuing the credit note):
- hr_partner_name    : Company name of the vendor
- hr_partner_gstin   : GSTIN of vendor (string or null)
- hr_partner_pan     : PAN of vendor — derive from GSTIN chars 3-12 if not printed (string or null)
- hr_partner_state   : State of vendor from GSTIN state code — full state name (string or null)
- hr_partner_address : Billing address of vendor (string or null)

Recipient (SBOSS):
- sboss_name    : Name of the recipient
- sboss_gstin   : GSTIN of recipient (string or null)
- sboss_pan     : PAN of recipient — should be ABJCS0628K (string or null)
- sboss_state   : State of recipient from GSTIN — full state name (string or null)
- sboss_address : Billing address of recipient (string or null)

Amounts — credit notes have NEGATIVE values (they reduce what is owed):
- taxable_amount : Taxable value — return as a NEGATIVE number (e.g. -1800)
- cgst_amount    : CGST amount — NEGATIVE number, null if IGST invoice
- sgst_amount    : SGST amount — NEGATIVE number, null if IGST invoice
- igst_amount    : IGST amount — NEGATIVE number, null if CGST/SGST invoice
- credit_note_value : Total credit note value including tax — NEGATIVE number

- description : Brief description / reason for the credit note (string or null)

RULES:
- All amount fields must be NEGATIVE numbers since this is a credit note.
- {tax_type_rule}
- For CGST+SGST: igst_amount must be null. For IGST: cgst_amount and sgst_amount must be null.

Return ONLY the JSON object.

Credit note text:
{text}"""


# ── Main entry point ───────────────────────────────────────────────────────────
def process_credit_note(
    pdf_bytes: bytes,
    vendor_pan: str,
    service_group: str = None,
    nature: str = None,
) -> dict:

    try:
        pdf_text = ""
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            for page in pdf.pages:
                t = page.extract_text()
                if t:
                    pdf_text += t + "\n"
    except Exception as e:
        return _error(f"Failed to read PDF: {str(e)}")

    if not pdf_text.strip():
        return _error("PDF appears to be empty or scanned — no text could be extracted")

    # ── PAN check — explicit text OR embedded in valid GSTIN ──────────────────
    gstins, pans = extract_gstins_and_pans(pdf_text)
    expected_pan = vendor_pan.strip().upper()

    vendor_gstin_matches = [g for g in gstins if g[2:12] == expected_pan]

    pan_in_text = bool(re.search(
        r'(?<![A-Z])' + re.escape(expected_pan) + r'(?![A-Z0-9])',
        pdf_text.upper()
    ))

    if not pan_in_text and not vendor_gstin_matches:
        return _reject(
            f"PAN mismatch. Your registered PAN ({expected_pan}) was not found in this credit note "
            f"(checked both explicit PAN text and GSTIN). "
            f"Please ensure you are uploading your own company's credit note."
        )

    # ── Tax type from GSTINs ───────────────────────────────────────────────────
    vendor_gstin = vendor_gstin_matches[0] if vendor_gstin_matches else None
    sboss_gstin  = next((g for g in gstins if g[2:12] == SBOSS_PAN), None)
    tax_type     = determine_tax_type(vendor_gstin, sboss_gstin)

    vendor_state_name = state_from_gstin(vendor_gstin)[1] if vendor_gstin else None
    sboss_state_name  = state_from_gstin(sboss_gstin)[1]  if sboss_gstin  else None

    if tax_type == "cgst_sgst":
        tax_type_hint = "CGST + SGST (intra-state)"
        tax_type_rule = "Extract CGST and SGST as negative numbers. igst_amount must be null."
    elif tax_type == "igst":
        tax_type_hint = "IGST (inter-state)"
        tax_type_rule = "Extract IGST as a negative number. cgst_amount and sgst_amount must be null."
    else:
        tax_type_hint = "CGST+SGST or IGST"
        tax_type_rule = "Extract whichever tax type appears, as negative numbers."

    # ── Claude extraction ──────────────────────────────────────────────────────
    try:
        message = claude.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=1024,
            messages=[{
                "role": "user",
                "content": EXTRACTION_PROMPT.format(
                    text=pdf_text[:6000],
                    tax_type_hint=tax_type_hint,
                    tax_type_rule=tax_type_rule,
                ),
            }],
        )
        text_block = next((b for b in message.content if hasattr(b, 'text')), None)
        if not text_block:
            return _error("Claude returned no text content")
        raw_response = text_block.text.strip()
    except Exception as e:
        return _error(f"Claude extraction failed: {str(e)}")

    # ── Parse JSON ─────────────────────────────────────────────────────────────
    try:
        clean = raw_response
        if clean.startswith("```"):
            clean = re.sub(r"^```[a-z]*\n?", "", clean)
            clean = re.sub(r"\n?```$", "", clean)
        data = json.loads(clean.strip())
    except json.JSONDecodeError as e:
        return _error(f"Failed to parse Claude response: {str(e)}\nRaw: {raw_response[:200]}")

    cn_number = (data.get("credit_note_number") or "").strip()
    if not cn_number:
        return _reject("Could not extract credit note number from this PDF.")

    original_inv_no = (data.get("original_invoice_number") or "").strip() or None

    return {
        "success":  True,
        "rejected": False,

        "invoice_number":  cn_number,
        "invoice_type":    "credit_note",
        "invoice_date":    data.get("credit_note_date"),
        "irn":             None,

        # Credit Note specific fields (kept for parserService.js compatibility)
        "credit_note_number": cn_number,
        "credit_note_date":   data.get("credit_note_date"),

        "original_invoice_number": original_inv_no,

        "hr_partner_name":    data.get("hr_partner_name"),
        "hr_partner_gstin":   data.get("hr_partner_gstin") or vendor_gstin,
        "hr_partner_pan":     data.get("hr_partner_pan")   or expected_pan,
        "hr_partner_state":   data.get("hr_partner_state") or vendor_state_name,
        "hr_partner_address": data.get("hr_partner_address"),

        "sboss_name":    data.get("sboss_name"),
        "sboss_gstin":   data.get("sboss_gstin") or sboss_gstin,
        "sboss_pan":     data.get("sboss_pan")   or SBOSS_PAN,
        "sboss_state":   data.get("sboss_state") or sboss_state_name,
        "sboss_address": data.get("sboss_address"),

        "amount_of_service": None,
        "service_charges":   None,
        "taxable_amount":    _to_negative(data.get("taxable_amount")),
        "cgst_amount":       _to_negative(data.get("cgst_amount")),
        "sgst_amount":       _to_negative(data.get("sgst_amount")),
        "igst_amount":       _to_negative(data.get("igst_amount")),
        "round_off":         None,
        "invoice_value":     _to_negative(data.get("credit_note_value")),
        "credit_note_value": _to_negative(data.get("credit_note_value")),

        "description":           data.get("description"),
        "tax_type":              tax_type,
        "tax_validation_warning": None,
        "raw_extraction":        data,
    }


def _to_negative(value) -> float | None:
    if value is None:
        return None
    try:
        v = float(value)
        return v if v <= 0 else -v
    except (ValueError, TypeError):
        return None


def _error(message: str) -> dict:
    return {"success": False, "rejected": False, "error": message}


def _reject(message: str) -> dict:
    return {"success": False, "rejected": True, "error": message}
