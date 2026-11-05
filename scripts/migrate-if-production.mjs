// Applies pending Prisma migrations on Vercel Production builds, before `next build` runs.
//
// Production only, deliberately. A preview build runs branch code, and a branch can add a migration
// that has not been reviewed; preview deployments usually point at the same Neon project, so
// migrating there would put unmerged schema on the real database. Locally VERCEL_ENV is unset and
// this is a no-op, so `npm run build` never touches production.
import { execSync } from "node:child_process";

const env = process.env.VERCEL_ENV;

if (env === "production") {
  console.log("[build] Vercel Production: applying pending migrations");
  execSync("npx prisma migrate deploy", { stdio: "inherit" });
} else {
  console.log(`[build] VERCEL_ENV=${env ?? "unset"}: skipping migrations`);
}
