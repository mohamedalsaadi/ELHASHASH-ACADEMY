-- Contact-form messages are kept so the owner can answer them in the back office, with an AI draft. Additive only.
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "email" TEXT NOT NULL,
    "phone" VARCHAR(30),
    "topic" VARCHAR(20) NOT NULL,
    "message" VARCHAR(2000) NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'OPEN',
    "aiDraft" VARCHAR(4000),
    "reply" VARCHAR(4000),
    "repliedById" TEXT,
    "repliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupportTicket_status_createdAt_idx" ON "SupportTicket"("status", "createdAt");
