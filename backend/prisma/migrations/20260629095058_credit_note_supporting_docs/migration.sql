-- DropForeignKey
ALTER TABLE "VendorSupportingDocument" DROP CONSTRAINT "VendorSupportingDocument_uploadBatchId_fkey";

-- AlterTable
ALTER TABLE "VendorSupportingDocument" ADD COLUMN     "creditNoteId" TEXT,
ALTER COLUMN "uploadBatchId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "VendorSupportingDocument_creditNoteId_idx" ON "VendorSupportingDocument"("creditNoteId");

-- AddForeignKey
ALTER TABLE "VendorSupportingDocument" ADD CONSTRAINT "VendorSupportingDocument_uploadBatchId_fkey" FOREIGN KEY ("uploadBatchId") REFERENCES "UploadBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorSupportingDocument" ADD CONSTRAINT "VendorSupportingDocument_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "CreditNote"("id") ON DELETE SET NULL ON UPDATE CASCADE;
