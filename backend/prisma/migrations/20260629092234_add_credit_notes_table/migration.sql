/*
  Warnings:

  - You are about to drop the column `originalInvoiceId` on the `Invoice` table. All the data in the column will be lost.
  - You are about to drop the column `originalInvoiceNumber` on the `Invoice` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_originalInvoiceId_fkey";

-- AlterTable
ALTER TABLE "Invoice" DROP COLUMN "originalInvoiceId",
DROP COLUMN "originalInvoiceNumber";

-- CreateTable
CREATE TABLE "CreditNote" (
    "id" TEXT NOT NULL,
    "hrPartnerId" TEXT NOT NULL,
    "originalInvoiceId" TEXT,
    "uploadBatchId" TEXT,
    "extractionStatus" "ExtractionStatus" NOT NULL DEFAULT 'pending',
    "creditNoteNumber" TEXT,
    "originalInvoiceNumber" TEXT,
    "creditNoteDate" TIMESTAMP(3),
    "taxableAmount" DECIMAL(15,2),
    "cgstAmount" DECIMAL(15,2),
    "sgstAmount" DECIMAL(15,2),
    "igstAmount" DECIMAL(15,2),
    "creditNoteValue" DECIMAL(15,2),
    "description" TEXT,
    "rawExtraction" JSONB,
    "extractionError" TEXT,
    "pdfPath" TEXT NOT NULL,
    "originalFileName" TEXT,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CreditNote_creditNoteNumber_idx" ON "CreditNote"("creditNoteNumber");

-- CreateIndex
CREATE INDEX "CreditNote_originalInvoiceNumber_idx" ON "CreditNote"("originalInvoiceNumber");

-- CreateIndex
CREATE INDEX "CreditNote_originalInvoiceId_idx" ON "CreditNote"("originalInvoiceId");

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_hrPartnerId_fkey" FOREIGN KEY ("hrPartnerId") REFERENCES "HrPartner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_originalInvoiceId_fkey" FOREIGN KEY ("originalInvoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_uploadBatchId_fkey" FOREIGN KEY ("uploadBatchId") REFERENCES "UploadBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
