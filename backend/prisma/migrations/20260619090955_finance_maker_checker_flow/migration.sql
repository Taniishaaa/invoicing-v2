/*
  Warnings:

  - You are about to drop the column `financeRemarks` on the `InvoiceStatus` table. All the data in the column will be lost.
  - You are about to drop the column `financeVerifiedAt` on the `InvoiceStatus` table. All the data in the column will be lost.
  - You are about to drop the column `financeVerifiedById` on the `InvoiceStatus` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "InvoiceStatus" DROP CONSTRAINT "InvoiceStatus_financeVerifiedById_fkey";

-- AlterTable
ALTER TABLE "InvoiceStatus" DROP COLUMN "financeRemarks",
DROP COLUMN "financeVerifiedAt",
DROP COLUMN "financeVerifiedById",
ADD COLUMN     "financeCheckerAt" TIMESTAMP(3),
ADD COLUMN     "financeCheckerId" TEXT,
ADD COLUMN     "financeCheckerRemarks" TEXT;

-- CreateIndex
CREATE INDEX "InvoiceStatus_currentStage_idx" ON "InvoiceStatus"("currentStage");

-- CreateIndex
CREATE INDEX "InvoiceStatus_hrStatus_idx" ON "InvoiceStatus"("hrStatus");

-- CreateIndex
CREATE INDEX "InvoiceStatus_financeStatus_idx" ON "InvoiceStatus"("financeStatus");

-- CreateIndex
CREATE INDEX "InvoiceStatus_paymentStatus_idx" ON "InvoiceStatus"("paymentStatus");

-- AddForeignKey
ALTER TABLE "InvoiceStatus" ADD CONSTRAINT "InvoiceStatus_hrMakerId_fkey" FOREIGN KEY ("hrMakerId") REFERENCES "AuthUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceStatus" ADD CONSTRAINT "InvoiceStatus_hrCheckerId_fkey" FOREIGN KEY ("hrCheckerId") REFERENCES "AuthUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceStatus" ADD CONSTRAINT "InvoiceStatus_financeMakerId_fkey" FOREIGN KEY ("financeMakerId") REFERENCES "AuthUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceStatus" ADD CONSTRAINT "InvoiceStatus_financeCheckerId_fkey" FOREIGN KEY ("financeCheckerId") REFERENCES "AuthUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
