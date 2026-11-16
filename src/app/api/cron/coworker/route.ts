import { NextResponse } from "next/server";
import { cronRoute } from "@/lib/cron-log";
import { realDeps, tick } from "@/lib/coworker/engine";
import { githubConfigured } from "@/lib/coworker/github";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Sentinel, the log-reading coworker: one small step per call (see src/lib/coworker/engine.ts and docs/coworker.md).
 * Called every 30 minutes by .github/workflows/coworker.yml. Off with COWORKER_ENABLED=0 or the pause switch on /admin/ai.
 */
async function run() {
  if (process.env.COWORKER_ENABLED === "0") return NextResponse.json({ ok: true, skipped: "COWORKER_ENABLED=0" });
  if (!githubConfigured()) return NextResponse.json({ ok: true, skipped: "GITHUB_COWORKER_TOKEN is not set" });
  return NextResponse.json({ ok: true, ...(await tick(realDeps())) });
}

export const GET = cronRoute("coworker", run);
