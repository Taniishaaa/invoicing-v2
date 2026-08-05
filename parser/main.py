from fastapi import FastAPI
from pydantic import BaseModel
from typing import Optional
import base64

from invoice_parser import process_invoice
from credit_note_parser import process_credit_note

app = FastAPI()


class ParseRequest(BaseModel):
    pdfBytes: str
    vendorPan: str
    serviceGroup: Optional[str] = None
    nature: Optional[str] = None
    isCreditNote: Optional[bool] = False


@app.post("/parse")
async def parse_invoice(req: ParseRequest):

    pdf_bytes = base64.b64decode(req.pdfBytes)

    if req.isCreditNote:
        result = process_credit_note(
            pdf_bytes=pdf_bytes,
            vendor_pan=req.vendorPan,
        )
    else:
        result = process_invoice(
            pdf_bytes=pdf_bytes,
            vendor_pan=req.vendorPan,
            service_group=req.serviceGroup,
            nature=req.nature,
        )

    return result


@app.get("/health")
async def health():
    return {"status": "ok"}