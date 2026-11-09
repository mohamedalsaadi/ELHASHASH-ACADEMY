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
  // Two Vercel projects build main and both migrate; the loser times out on Prisma's advisory lock (P1002).
  // Retrying lets it wait for the winner, which has then applied everything, so the retry is a no-op.
  for (let attempt = 1; ; attempt++) {
    try {
      execSync("npx prisma migrate deploy", { stdio: "inherit" });
      break;
    } catch (e) {
      if (attempt === 4) throw e;
      console.log(`[build] migrate attempt ${attempt} failed, retrying in 20 s`);
      await new Promise((r) => setTimeout(r, 20_000));
    }
  }
} else {
  console.log(`[build] VERCEL_ENV=${env ?? "unset"}: skipping migrations`);
}
