-- Least-privilege database role for the running app.
-- Run in the Neon SQL editor as the owner role, then point the app's DATABASE_URL (in Vercel) at the new role.
-- Keep the owner role only for `prisma migrate deploy`: in Vercel set MIGRATE_DATABASE_URL (Production) to the
-- owner connection string. The build migrates with it (scripts/migrate-if-production.mjs); the site uses DATABASE_URL.
-- Order: run this on a Neon branch first, then production; add MIGRATE_DATABASE_URL; only then switch DATABASE_URL.
-- Choose the password yourself and store it only in Vercel. Never write it in this repository.

CREATE ROLE dhirwa_app LOGIN PASSWORD '<choose-a-long-random-password>';

GRANT CONNECT ON DATABASE neondb TO dhirwa_app;
GRANT USAGE ON SCHEMA public TO dhirwa_app;

-- The app reads and writes rows. It cannot create, alter or drop tables, so an injection bug or a leaked
-- connection string cannot destroy the schema.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO dhirwa_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO dhirwa_app;

-- Tables that later migrations create (run as the owner role) are granted automatically.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO dhirwa_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO dhirwa_app;

-- Check after switching: https://dhirwa.ae/api/health must still answer 200 (it reads information_schema, which any role can).
