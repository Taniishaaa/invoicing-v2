/*
  Warnings:

  - The values [verified] on the enum `FinanceStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "FinanceStatus_new" AS ENUM ('pending', 'cleared', 'rejected');
ALTER TABLE "public"."InvoiceStatus" ALTER COLUMN "financeStatus" DROP DEFAULT;
ALTER TABLE "InvoiceStatus" ALTER COLUMN "financeStatus" TYPE "FinanceStatus_new" USING ("financeStatus"::text::"FinanceStatus_new");
ALTER TYPE "FinanceStatus" RENAME TO "FinanceStatus_old";
ALTER TYPE "FinanceStatus_new" RENAME TO "FinanceStatus";
DROP TYPE "public"."FinanceStatus_old";
ALTER TABLE "InvoiceStatus" ALTER COLUMN "financeStatus" SET DEFAULT 'pending';
COMMIT;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "hrPartnerAddress" TEXT,
ADD COLUMN     "sbossAddress" TEXT;

-- AlterTable
ALTER TABLE "InvoiceActivity" ADD COLUMN     "role" TEXT;

-- CreateTable
CREATE TABLE "UploadLock" (
    "id" TEXT NOT NULL,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "lockedById" TEXT,
    "lockedByName" TEXT,
    "lockedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UploadLock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemConfig" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SystemConfig_key_key" ON "SystemConfig"("key");
