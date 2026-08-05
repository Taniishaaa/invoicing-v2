/*
  Warnings:

  - The values [sent_back] on the enum `WorkflowStage` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `sentBackAt` on the `InvoiceStatus` table. All the data in the column will be lost.
  - You are about to drop the column `sentBackReason` on the `InvoiceStatus` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "ComplianceStatus" AS ENUM ('pending', 'verified', 'rejected');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'compliance_team';

-- AlterEnum
ALTER TYPE "UserSubRole" ADD VALUE 'compliance';

-- AlterEnum
BEGIN;
CREATE TYPE "WorkflowStage_new" AS ENUM ('uploaded', 'extracted', 'hr_maker_verified', 'hr_checker_reviewed', 'hr_approved', 'compliance_verified', 'finance_maker_verified', 'finance_cleared', 'paid', 'rejected');
ALTER TABLE "public"."InvoiceStatus" ALTER COLUMN "currentStage" DROP DEFAULT;
ALTER TABLE "InvoiceStatus" ALTER COLUMN "currentStage" TYPE "WorkflowStage_new" USING ("currentStage"::text::"WorkflowStage_new");
ALTER TYPE "WorkflowStage" RENAME TO "WorkflowStage_old";
ALTER TYPE "WorkflowStage_new" RENAME TO "WorkflowStage";
DROP TYPE "public"."WorkflowStage_old";
ALTER TABLE "InvoiceStatus" ALTER COLUMN "currentStage" SET DEFAULT 'uploaded';
COMMIT;

-- DropIndex
DROP INDEX "Invoice_irn_key";

-- AlterTable
ALTER TABLE "InvoiceStatus" DROP COLUMN "sentBackAt",
DROP COLUMN "sentBackReason",
ADD COLUMN     "complianceAt" TIMESTAMP(3),
ADD COLUMN     "complianceRemarks" TEXT,
ADD COLUMN     "complianceStatus" "ComplianceStatus" NOT NULL DEFAULT 'pending',
ADD COLUMN     "complianceUserId" TEXT;

-- CreateIndex
CREATE INDEX "InvoiceStatus_complianceStatus_idx" ON "InvoiceStatus"("complianceStatus");

-- AddForeignKey
ALTER TABLE "InvoiceStatus" ADD CONSTRAINT "InvoiceStatus_complianceUserId_fkey" FOREIGN KEY ("complianceUserId") REFERENCES "AuthUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
