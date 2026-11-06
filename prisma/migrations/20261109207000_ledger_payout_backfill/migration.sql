-- The payout column arrived after the first sales. With the corporate-tax switch off, a historical
-- payout equals the teacher's net share. Zero-net rows stay zero.
UPDATE "LedgerEntry"
   SET "instructorPayout" = "instructorNet"
 WHERE "instructorPayout" = 0
   AND "instructorNet" <> 0;
