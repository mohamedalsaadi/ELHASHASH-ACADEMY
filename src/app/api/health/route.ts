import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Columns and tables the deployed code selects. Each one arrived with a migration that shipped
 * alongside the code using it; if the database is behind, every query touching it throws P2022
 * and the site renders its error boundary while still answering 200 everywhere else. A plain
 * `SELECT 1` cannot see that, which is how the 2026-11-05 outage stayed invisible.
 */
const REQUIRED_COLUMNS: [string, string][] = [
  ["User", "passwordChangedAt"],
  ["User", "liveApproved"],
  ["Course", "aiGrading"],
  ["LessonView", "confidence"],
  ["Order", "beneficiaryDeclaredAt"],
  ["Order", "platformDiscount"],
  ["OrderItem", "platformDiscount"],
  ["LedgerEntry", "platformDiscount"],
  ["PlatformSetting", "referralWelcomePercentOff"],
  ["Order", "taxCountryCode"],
  ["Country", "vatEnabled"],
  ["LedgerEntry", "instructorPayout"],
  ["User", "dateOfBirth"],
  ["GuardianConsent", "verifiedAt"],
  ["Sku", "aedPrice"],
  ["OrderItem", "displayPrice"],
];
const REQUIRED_TABLES = ["GuardianConsent", "AiRun", "Referral", "ReferralCode", "Document", "TeacherStatement", "FxRate"];

// Monitors poll this; the schema does not change between deploys, so a short cache is enough.
const TTL_MS = 30_000;
let cached: { at: number; ok: boolean } | null = null;

async function missingSchema(): Promise<string[]> {
  // Static, trusted identifiers only: no user input reaches these strings.
  const values = REQUIRED_COLUMNS.map(([t, c]) => `('${t}','${c}')`).join(",");
  const columns = await db.$queryRawUnsafe<{ missing: string }[]>(`
    WITH expected(tbl, col) AS (VALUES ${values})
    SELECT e.tbl || '.' || e.col AS missing
      FROM expected e
      LEFT JOIN information_schema.columns c
        ON c.table_schema = 'public' AND c.table_name = e.tbl AND c.column_name = e.col
     WHERE c.column_name IS NULL
  `);

  const missing = columns.map((r) => r.missing);
  for (const table of REQUIRED_TABLES) {
    const rows = await db.$queryRawUnsafe<{ t: string | null }[]>(
      `SELECT to_regclass('public."${table}"')::text AS t`,
    );
    if (!rows[0]?.t) missing.push(table);
  }
  return missing;
}

function reply(ok: boolean) {
  return NextResponse.json({ ok }, { status: ok ? 200 : 503 });
}

/** For uptime checks: 200 when the app, its database and the schema its code needs all answer. */
export async function GET() {
  if (cached && Date.now() - cached.at < TTL_MS) return reply(cached.ok);

  let ok = false;
  try {
    await db.$queryRaw`SELECT 1`;
    const missing = await missingSchema();
    ok = missing.length === 0;
    if (!ok) console.error("[health] database schema is behind the deployed code:", missing.join(", "));
  } catch (e) {
    console.error("[health] database unreachable", e);
  }

  cached = { at: Date.now(), ok };
  return reply(ok);
}
