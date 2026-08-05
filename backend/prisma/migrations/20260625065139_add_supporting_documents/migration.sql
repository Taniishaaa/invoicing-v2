-- CreateEnum
CREATE TYPE "SupportingDocumentStage" AS ENUM ('hr', 'compliance', 'finance');

-- CreateTable
CREATE TABLE "VendorSupportingDocument" (
    "id" TEXT NOT NULL,
    "uploadBatchId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "documentName" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorSupportingDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BatchSupportingDocument" (
    "id" TEXT NOT NULL,
    "uploadBatchId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "stage" "SupportingDocumentStage" NOT NULL,
    "title" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BatchSupportingDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VendorSupportingDocument_uploadBatchId_idx" ON "VendorSupportingDocument"("uploadBatchId");

-- CreateIndex
CREATE INDEX "BatchSupportingDocument_uploadBatchId_idx" ON "BatchSupportingDocument"("uploadBatchId");

-- CreateIndex
CREATE INDEX "BatchSupportingDocument_stage_idx" ON "BatchSupportingDocument"("stage");

-- AddForeignKey
ALTER TABLE "VendorSupportingDocument" ADD CONSTRAINT "VendorSupportingDocument_uploadBatchId_fkey" FOREIGN KEY ("uploadBatchId") REFERENCES "UploadBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorSupportingDocument" ADD CONSTRAINT "VendorSupportingDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "AuthUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchSupportingDocument" ADD CONSTRAINT "BatchSupportingDocument_uploadBatchId_fkey" FOREIGN KEY ("uploadBatchId") REFERENCES "UploadBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchSupportingDocument" ADD CONSTRAINT "BatchSupportingDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "AuthUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
