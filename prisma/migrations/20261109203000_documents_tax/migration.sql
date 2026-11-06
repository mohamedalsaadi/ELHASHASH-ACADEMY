-- Per-market VAT, numbered documents, teacher acknowledgement, and monthly statements.

ALTER TABLE "Country" ADD COLUMN "vatEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Country" ADD COLUMN "vatRateBp" INTEGER NOT NULL DEFAULT 500;
ALTER TABLE "Country" ADD COLUMN "vatTrn" TEXT;

ALTER TABLE "Order" ADD COLUMN "taxCountryCode" TEXT;

ALTER TABLE "LedgerEntry" ADD COLUMN "corporateTax" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "LedgerEntry" ADD COLUMN "corporateTaxBp" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "LedgerEntry" ADD COLUMN "instructorPayout" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "PlatformSetting" ADD COLUMN "corporateTaxEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PlatformSetting" ADD COLUMN "corporateTaxBp" INTEGER NOT NULL DEFAULT 900;
ALTER TABLE "PlatformSetting" ADD COLUMN "sellerLegalName" TEXT;
ALTER TABLE "PlatformSetting" ADD COLUMN "sellerAddress" TEXT;
ALTER TABLE "PlatformSetting" ADD COLUMN "sellerLicenceNo" TEXT;

CREATE TYPE "DocumentKind" AS ENUM ('INVOICE', 'CREDIT_NOTE');
CREATE TYPE "DocumentPdfStatus" AS ENUM ('PENDING', 'READY', 'FAILED');
CREATE TYPE "StatementStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED');

CREATE TABLE "DocumentSequence" (
  "key" TEXT NOT NULL,
  "next" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "DocumentSequence_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "Document" (
  "id" TEXT NOT NULL,
  "kind" "DocumentKind" NOT NULL,
  "sequenceKey" TEXT NOT NULL,
  "sequenceNo" INTEGER NOT NULL,
  "number" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "creditsDocumentId" TEXT,
  "currency" "Currency" NOT NULL,
  "taxCountryCode" TEXT,
  "sellerName" TEXT NOT NULL,
  "sellerAddress" TEXT,
  "sellerTrn" TEXT,
  "buyerName" TEXT NOT NULL,
  "buyerEmail" TEXT,
  "buyerPhone" TEXT,
  "beneficiaryName" TEXT,
  "subtotal" INTEGER NOT NULL,
  "discount" INTEGER NOT NULL,
  "platformDiscount" INTEGER NOT NULL DEFAULT 0,
  "vat" INTEGER NOT NULL,
  "vatRateBp" INTEGER NOT NULL DEFAULT 0,
  "total" INTEGER NOT NULL,
  "lines" JSONB NOT NULL,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "pdfKey" TEXT,
  "pdfStatus" "DocumentPdfStatus" NOT NULL DEFAULT 'PENDING',
  "pdfAttempts" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Document_number_key" ON "Document"("number");
CREATE UNIQUE INDEX "Document_creditsDocumentId_key" ON "Document"("creditsDocumentId");
CREATE UNIQUE INDEX "Document_orderId_kind_key" ON "Document"("orderId", "kind");
CREATE UNIQUE INDEX "Document_sequenceKey_sequenceNo_key" ON "Document"("sequenceKey", "sequenceNo");
CREATE INDEX "Document_taxCountryCode_issuedAt_idx" ON "Document"("taxCountryCode", "issuedAt");
ALTER TABLE "Document" ADD CONSTRAINT "Document_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_creditsDocumentId_fkey" FOREIGN KEY ("creditsDocumentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ReceiptAck" (
  "documentId" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ip" TEXT,
  "userAgent" TEXT,
  CONSTRAINT "ReceiptAck_pkey" PRIMARY KEY ("documentId", "teacherId")
);
ALTER TABLE "ReceiptAck" ADD CONSTRAINT "ReceiptAck_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReceiptAck" ADD CONSTRAINT "ReceiptAck_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "TeacherStatement" (
  "id" TEXT NOT NULL,
  "number" TEXT NOT NULL,
  "instructorId" TEXT NOT NULL,
  "period" TEXT NOT NULL,
  "currency" "Currency" NOT NULL,
  "salesCount" INTEGER NOT NULL DEFAULT 0,
  "refundCount" INTEGER NOT NULL DEFAULT 0,
  "gross" INTEGER NOT NULL DEFAULT 0,
  "vat" INTEGER NOT NULL DEFAULT 0,
  "net" INTEGER NOT NULL DEFAULT 0,
  "platformFee" INTEGER NOT NULL DEFAULT 0,
  "platformDiscount" INTEGER NOT NULL DEFAULT 0,
  "corporateTax" INTEGER NOT NULL DEFAULT 0,
  "instructorNet" INTEGER NOT NULL DEFAULT 0,
  "instructorPayout" INTEGER NOT NULL DEFAULT 0,
  "status" "StatementStatus" NOT NULL DEFAULT 'OPEN',
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acknowledgedAt" TIMESTAMP(3),
  "ackIp" TEXT,
  "ackUserAgent" TEXT,
  CONSTRAINT "TeacherStatement_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TeacherStatement_number_key" ON "TeacherStatement"("number");
CREATE UNIQUE INDEX "TeacherStatement_instructorId_period_currency_key" ON "TeacherStatement"("instructorId", "period", "currency");
CREATE INDEX "TeacherStatement_period_status_idx" ON "TeacherStatement"("period", "status");
ALTER TABLE "TeacherStatement" ADD CONSTRAINT "TeacherStatement_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
