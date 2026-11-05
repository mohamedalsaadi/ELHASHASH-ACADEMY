-- A guardian can now consent on the signup form, before a parent account exists, so parentId
-- becomes optional and each row records where the consent came from.
CREATE TYPE "ConsentSource" AS ENUM ('SIGNUP', 'PARENT');
ALTER TABLE "GuardianConsent" ADD COLUMN "source" "ConsentSource" NOT NULL DEFAULT 'PARENT';
ALTER TABLE "GuardianConsent" ALTER COLUMN "parentId" DROP NOT NULL;
