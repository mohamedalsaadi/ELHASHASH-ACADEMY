-- The owner cancelled the free unit (2026-11-01): every lesson is paid. The column stays (migrations are additive
-- until the end of 2026) but no unit is free any more and the admin switch is gone.
-- Free before this migration, to undo if ever needed:
--   cmvlevd33000a6k7kgsjwtv9k (eg-12-math), cmvlevdw1000g6k7k0t2dvv7k (eg-12-physics),
--   cmvleveoj000m6k7k8vu5j7v4 (eg-12-chemistry), cmvlkafqz0004dg7k72k14yxe (ae-12-adv-math)
UPDATE "Unit" SET "isFree" = false WHERE "isFree" = true;
