-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('super_admin', 'hr_team', 'finance_team', 'vendor');

-- CreateEnum
CREATE TYPE "ProjectType" AS ENUM ('fos', 'seva_sarathi', 'atm_mitra', 'grahak_mitra', 'collections');

-- CreateEnum
CREATE TYPE "NatureType" AS ENUM ('salary', 'reimbursement', 'sourcing', 'bgv', 'fnf');

-- CreateEnum
CREATE TYPE "InvoiceType" AS ENUM ('regular', 'credit_note');

-- CreateEnum
CREATE TYPE "ExtractionStatus" AS ENUM ('pending', 'processing', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "HrStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "FinanceStatus" AS ENUM ('pending', 'verified', 'rejected');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('unpaid', 'paid');

-- CreateTable
CREATE TABLE "AuthUser" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrPartner" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pan" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrPartner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadBatch" (
    "id" TEXT NOT NULL,
    "hrPartnerId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "totalFiles" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UploadBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "uploadBatchId" TEXT NOT NULL,
    "hrPartnerId" TEXT NOT NULL,
    "project" "ProjectType" NOT NULL,
    "nature" "NatureType" NOT NULL,
    "extractionStatus" "ExtractionStatus" NOT NULL DEFAULT 'pending',
    "rawExtraction" JSONB,
    "hrPartnerGstin" TEXT,
    "hrPartnerPan" TEXT,
    "hrPartnerState" TEXT,
    "sbossName" TEXT,
    "sbossState" TEXT,
    "sbossGstin" TEXT,
    "sbossPan" TEXT,
    "irn" TEXT,
    "invoiceNumber" TEXT NOT NULL,
    "invoiceDate" TIMESTAMP(3),
    "description" TEXT,
    "taxableAmount" DECIMAL(15,2),
    "type" "InvoiceType" NOT NULL DEFAULT 'regular',
    "cgstAmount" DECIMAL(15,2),
    "sgstAmount" DECIMAL(15,2),
    "igstAmount" DECIMAL(15,2),
    "invoiceValue" DECIMAL(15,2),
    "shortAmount" DECIMAL(15,2),
    "excessAmount" DECIMAL(15,2),
    "note" TEXT,
    "pdfPath" TEXT NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceStatus" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "hrStatus" "HrStatus" NOT NULL DEFAULT 'pending',
    "financeStatus" "FinanceStatus" NOT NULL DEFAULT 'pending',
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'unpaid',
    "hrApprovedById" TEXT,
    "hrApprovedAt" TIMESTAMP(3),
    "hrRemarks" TEXT,
    "financeVerifiedById" TEXT,
    "financeVerifiedAt" TIMESTAMP(3),
    "financeRemarks" TEXT,
    "paymentReferenceId" TEXT,
    "paymentDate" TIMESTAMP(3),
    "paymentUpdatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceActivity" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuthUser_username_key" ON "AuthUser"("username");

-- CreateIndex
CREATE UNIQUE INDEX "HrPartner_userId_key" ON "HrPartner"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "HrPartner_pan_key" ON "HrPartner"("pan");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_irn_key" ON "Invoice"("irn");

-- CreateIndex
CREATE INDEX "Invoice_invoiceNumber_idx" ON "Invoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "Invoice_irn_idx" ON "Invoice"("irn");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_hrPartnerId_invoiceNumber_key" ON "Invoice"("hrPartnerId", "invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceStatus_invoiceId_key" ON "InvoiceStatus"("invoiceId");

-- CreateIndex
CREATE INDEX "InvoiceActivity_invoiceId_idx" ON "InvoiceActivity"("invoiceId");

-- AddForeignKey
ALTER TABLE "HrPartner" ADD CONSTRAINT "HrPartner_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AuthUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadBatch" ADD CONSTRAINT "UploadBatch_hrPartnerId_fkey" FOREIGN KEY ("hrPartnerId") REFERENCES "HrPartner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadBatch" ADD CONSTRAINT "UploadBatch_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "AuthUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_uploadBatchId_fkey" FOREIGN KEY ("uploadBatchId") REFERENCES "UploadBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_hrPartnerId_fkey" FOREIGN KEY ("hrPartnerId") REFERENCES "HrPartner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceStatus" ADD CONSTRAINT "InvoiceStatus_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceStatus" ADD CONSTRAINT "InvoiceStatus_hrApprovedById_fkey" FOREIGN KEY ("hrApprovedById") REFERENCES "AuthUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceStatus" ADD CONSTRAINT "InvoiceStatus_financeVerifiedById_fkey" FOREIGN KEY ("financeVerifiedById") REFERENCES "AuthUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceStatus" ADD CONSTRAINT "InvoiceStatus_paymentUpdatedById_fkey" FOREIGN KEY ("paymentUpdatedById") REFERENCES "AuthUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceActivity" ADD CONSTRAINT "InvoiceActivity_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceActivity" ADD CONSTRAINT "InvoiceActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AuthUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
