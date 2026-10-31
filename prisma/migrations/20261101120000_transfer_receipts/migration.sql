-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "receiptKey" TEXT,
ADD COLUMN     "receiptName" TEXT,
ADD COLUMN     "receiptSize" INTEGER,
ADD COLUMN     "receiptType" TEXT;

-- AlterTable
ALTER TABLE "PlatformSetting" ADD COLUMN     "bankAccountName" TEXT,
ADD COLUMN     "bankIban" TEXT,
ADD COLUMN     "bankInstructionsAr" TEXT,
ADD COLUMN     "bankInstructionsEn" TEXT,
ADD COLUMN     "bankName" TEXT;
