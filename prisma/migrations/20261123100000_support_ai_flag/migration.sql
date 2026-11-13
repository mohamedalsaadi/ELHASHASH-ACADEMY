-- Support triage: the drafting model can flag a ticket the owner must decide. Additive.
ALTER TABLE "SupportTicket" ADD COLUMN "aiFlag" VARCHAR(20);
ALTER TABLE "SupportTicket" ADD COLUMN "aiReason" VARCHAR(300);
