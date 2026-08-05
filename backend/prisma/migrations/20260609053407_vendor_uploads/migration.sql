/*
  Warnings:

  - Added the required column `nature` to the `UploadBatch` table without a default value. This is not possible if the table is not empty.
  - Added the required column `project` to the `UploadBatch` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Invoice_hrPartnerId_invoiceNumber_key";

-- AlterTable
ALTER TABLE "Invoice" ALTER COLUMN "invoiceNumber" DROP NOT NULL;

-- AlterTable
ALTER TABLE "UploadBatch" ADD COLUMN     "nature" "NatureType" NOT NULL,
ADD COLUMN     "project" "ProjectType" NOT NULL;
