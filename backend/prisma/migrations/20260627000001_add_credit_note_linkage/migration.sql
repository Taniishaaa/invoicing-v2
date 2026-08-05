-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN "originalInvoiceNumber" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "originalInvoiceId" TEXT;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_originalInvoiceId_fkey" FOREIGN KEY ("originalInvoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
