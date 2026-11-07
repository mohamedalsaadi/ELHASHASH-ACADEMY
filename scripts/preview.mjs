// Local preview on a throwaway database: the same embedded Postgres and seed as the e2e suite, with `next dev` on port
// 3200. For reviewing signed-in pages without touching real accounts. It never reads DATABASE_URL from .env.local, every
// external service key is blank, and the database is deleted on exit.
// Usage: node scripts/preview.mjs. Personas and their password are in e2e/seed.ts.
import EmbeddedPostgres from "embedded-postgres";
import { execSync, spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const port = 54329; // e2e/seed.ts only accepts this port and database name.
const dir = mkdtempSync(join(tmpdir(), "dhirwa-preview-"));
const pg = new EmbeddedPostgres({ databaseDir: join(dir, "data"), user: "e2e", password: "e2e", port, persistent: false,
  initdbFlags: ["--encoding=UTF8", "--locale=C"], onLog: () => {} });
const env = {
  ...process.env,
  DATABASE_URL: `postgresql://e2e:e2e@localhost:${port}/dhirwa_e2e`,
  AUTH_SECRET: "preview-only-secret-not-used-anywhere-else-0123456789",
  AUTH_TRUST_HOST: "true",
  APP_URL: "http://localhost:3200",
  SEED_STUDENT_PASSWORD: "e2e-pass-1234",
  RESEND_API_KEY: "", DAILY_API_KEY: "", GEMINI_API_KEY: "", ZIINA_API_KEY: "", CRON_SECRET: "preview-cron",
  STRIPE_SECRET_KEY: "", STRIPE_WEBHOOK_SECRET: "", VDOCIPHER_API_SECRET: "", BLOB_READ_WRITE_TOKEN: "", VERCEL_OIDC_TOKEN: "",
};
const run = (cmd) => execSync(cmd, { stdio: "inherit", env });

await pg.initialise();
await pg.start();
await pg.createDatabase("dhirwa_e2e");
run("npx prisma migrate deploy");
run("npx tsx prisma/seed.ts");
run("npx tsx e2e/seed.ts");

const app = spawn("npx next dev -p 3200", { stdio: "inherit", env, shell: true });
const stop = async () => {
  app.kill();
  await pg.stop().catch(() => {});
  rmSync(dir, { recursive: true, force: true });
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
app.on("exit", stop);
