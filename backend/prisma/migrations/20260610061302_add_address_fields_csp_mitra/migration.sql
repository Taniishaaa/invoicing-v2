/*
  Warnings:

  - The values [grahak_mitra] on the enum `ProjectType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ProjectType_new" AS ENUM ('fos', 'seva_sarathi', 'atm_mitra', 'csp_mitra', 'collections');
ALTER TABLE "UploadBatch" ALTER COLUMN "project" TYPE "ProjectType_new" USING ("project"::text::"ProjectType_new");
ALTER TABLE "Invoice" ALTER COLUMN "project" TYPE "ProjectType_new" USING ("project"::text::"ProjectType_new");
ALTER TYPE "ProjectType" RENAME TO "ProjectType_old";
ALTER TYPE "ProjectType_new" RENAME TO "ProjectType";
DROP TYPE "public"."ProjectType_old";
COMMIT;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "extractionError" TEXT;
