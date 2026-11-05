// End-to-end run on a throwaway database: starts a local Postgres in a temp folder, applies the migrations, seeds
// the catalog and the test personas (e2e/seed.ts), runs Playwright against `next dev` on port 3200, then deletes it.
// It never reads DATABASE_URL from .env.local: the production database is never touched.
// Usage: node scripts/e2e.mjs [playwright args]
import EmbeddedPostgres from "embedded-postgres";
import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const port = 54329;
const dir = mkdtempSync(join(tmpdir(), "dhirwa-e2e-"));
const pg = new EmbeddedPostgres({ databaseDir: join(dir, "data"), user: "e2e", password: "e2e", port, persistent: false,
  initdbFlags: ["--encoding=UTF8", "--locale=C"], onLog: () => {} });

const url = `postgresql://e2e:e2e@localhost:${port}/dhirwa_e2e`;
// Every secret a real service would use is blanked, so nothing leaves the machine: no mail, no video rooms, no AI.
const env = {
  ...process.env,
  DATABASE_URL: url,
  AUTH_SECRET: "e2e-only-secret-not-used-anywhere-else-0123456789",
  AUTH_TRUST_HOST: "true",
  APP_URL: "http://localhost:3200",
  SEED_STUDENT_PASSWORD: "e2e-pass-1234",
  // Re-read the user row on every request, so a password reset is observed immediately.
  SESSION_RECHECK_MS: "0",
  RESEND_API_KEY: "", DAILY_API_KEY: "", GEMINI_API_KEY: "", ZIINA_API_KEY: "", CRON_SECRET: "e2e-cron",
  STRIPE_SECRET_KEY: "", STRIPE_WEBHOOK_SECRET: "", VDOCIPHER_API_SECRET: "", BLOB_READ_WRITE_TOKEN: "",
  VERCEL_OIDC_TOKEN: "",
};
const run = (cmd) => execSync(cmd, { stdio: "inherit", env });

let code = 0;
try {
  await pg.initialise();
  await pg.start();
  await pg.createDatabase("dhirwa_e2e");
  run("npx prisma migrate deploy");
  run("npx tsx prisma/seed.ts");
  run("npx tsx e2e/seed.ts");
  run(`npx playwright test ${process.argv.slice(2).join(" ")}`);
} catch (e) {
  code = typeof e?.status === "number" ? e.status : 1;
} finally {
  await pg.stop().catch(() => {});
  rmSync(dir, { recursive: true, force: true });
}
process.exit(code);
