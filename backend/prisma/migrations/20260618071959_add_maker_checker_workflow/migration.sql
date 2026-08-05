-- CreateEnum
CREATE TYPE "UserSubRole" AS ENUM ('hr_maker', 'hr_checker', 'hr_approver', 'finance_maker', 'finance_checker');

-- CreateEnum
CREATE TYPE "WorkflowStage" AS ENUM ('uploaded', 'extracted', 'hr_maker_verified', 'hr_checker_reviewed', 'hr_approved', 'finance_maker_verified', 'finance_cleared', 'paid', 'sent_back', 'rejected');

-- CreateEnum
CREATE TYPE "BatchStatus" AS ENUM ('uploaded', 'processing', 'completed', 'partially_completed', 'failed');

-- AlterEnum
ALTER TYPE "FinanceStatus" ADD VALUE 'maker_verified';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "HrStatus" ADD VALUE 'maker_verified';
ALTER TYPE "HrStatus" ADD VALUE 'checker_reviewed';

-- AlterTable
ALTER TABLE "AuthUser" ADD COLUMN     "subRole" "UserSubRole";

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "fileHash" TEXT,
ADD COLUMN     "fileSize" INTEGER,
ADD COLUMN     "invoiceHash" TEXT,
ADD COLUMN     "mimeType" TEXT,
ADD COLUMN     "originalFileName" TEXT;

-- AlterTable
ALTER TABLE "InvoiceStatus" ADD COLUMN     "currentStage" "WorkflowStage" NOT NULL DEFAULT 'uploaded',
ADD COLUMN     "financeMakerAt" TIMESTAMP(3),
ADD COLUMN     "financeMakerId" TEXT,
ADD COLUMN     "financeMakerRemarks" TEXT,
ADD COLUMN     "hrCheckerAt" TIMESTAMP(3),
ADD COLUMN     "hrCheckerId" TEXT,
ADD COLUMN     "hrCheckerRemarks" TEXT,
ADD COLUMN     "hrMakerAt" TIMESTAMP(3),
ADD COLUMN     "hrMakerId" TEXT,
ADD COLUMN     "hrMakerRemarks" TEXT,
ADD COLUMN     "sentBackAt" TIMESTAMP(3),
ADD COLUMN     "sentBackReason" TEXT;

-- AlterTable
ALTER TABLE "UploadBatch" ADD COLUMN     "failedFiles" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "processedFiles" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "status" "BatchStatus" NOT NULL DEFAULT 'uploaded';

-- CreateIndex
CREATE INDEX "Invoice_fileHash_idx" ON "Invoice"("fileHash");

-- CreateIndex
CREATE INDEX "Invoice_invoiceHash_idx" ON "Invoice"("invoiceHash");
