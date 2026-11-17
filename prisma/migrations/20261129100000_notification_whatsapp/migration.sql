-- When the WhatsApp copy of a course invite was sent (null: not sent). Additive.
ALTER TABLE "Notification" ADD COLUMN "whatsappAt" TIMESTAMP(3);
