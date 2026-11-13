// Restore drill (audit #43): proves a point-in-time restore of the production database actually works.
// It creates a temporary Neon branch of production as it was 30 minutes ago, runs smoke queries on it, and always deletes it.
// Needs NEON_API_KEY and NEON_PROJECT_ID. Exits non-zero on any failure, so the scheduled GitHub Action emails the owner.
// Reads and branches only: nothing in production is changed.
import pg from "pg";

const key = process.env.NEON_API_KEY;
const project = process.env.NEON_PROJECT_ID;
if (!key || !project) {
  console.error("NEON_API_KEY and NEON_PROJECT_ID are required.");
  process.exit(2);
}
const api = `https://console.neon.tech/api/v2/projects/${encodeURIComponent(project)}`;
const call = async (path, init = {}) => {
  const res = await fetch(`${api}${path}`, { ...init, headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", Accept: "application/json" } });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path} -> ${res.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
};

// Tables that must hold data in a healthy production copy. Counts are compared as "at least one row", never printed with content.
const TABLES = ["User", "Course", "Lesson", "Order", "Entitlement"];

let branchId = null;
let failed = false;
try {
  const at = new Date(Date.now() - 30 * 60_000).toISOString();
  const name = `restore-drill-${new Date().toISOString().slice(0, 10)}-${Math.random().toString(36).slice(2, 6)}`;
  const created = await call("/branches", { method: "POST", body: JSON.stringify({ branch: { name, parent_timestamp: at }, endpoints: [{ type: "read_only" }] }) });
  branchId = created.branch?.id;
  const uri = created.connection_uris?.[0]?.connection_uri;
  if (!branchId || !uri) throw new Error("Neon did not return a branch and a connection string");
  console.log(`Branch ${name} created from ${at}.`);

  // The new endpoint needs a moment before it accepts connections.
  let client;
  for (let attempt = 1; attempt <= 12; attempt++) {
    client = new pg.Client({ connectionString: uri });
    try {
      await client.connect();
      break;
    } catch (e) {
      client = null;
      if (attempt === 12) throw e;
      await new Promise((r) => setTimeout(r, 5_000));
    }
  }
  for (const table of TABLES) {
    const n = Number((await client.query(`select count(*) as n from "${table}"`)).rows[0].n);
    console.log(`${table}: ${n} rows`);
    if (n < 1) throw new Error(`${table} is empty in the restored branch`);
  }
  const migrations = Number((await client.query(`select count(*) as n from "_prisma_migrations" where finished_at is not null`)).rows[0].n);
  console.log(`Applied migrations: ${migrations}`);
  if (migrations < 1) throw new Error("No applied migrations in the restored branch");
  await client.end();
  console.log("Restore drill passed.");
} catch (e) {
  failed = true;
  console.error("Restore drill FAILED:", e.message);
} finally {
  if (branchId) {
    try {
      await call(`/branches/${branchId}`, { method: "DELETE" });
      console.log("Drill branch deleted.");
    } catch (e) {
      failed = true;
      console.error("Could not delete the drill branch, remove it in the Neon console:", e.message);
    }
  }
}
process.exit(failed ? 1 : 0);
