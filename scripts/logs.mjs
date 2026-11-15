// Prints the latest site log rows: `node --env-file=.env.local scripts/logs.mjs [level=ERROR] [source=vdocipher] [n=50]`.
// Read-only. Uses whichever DATABASE_URL the env file holds, so point it at the database you want to read.
import pg from "pg";

const arg = Object.fromEntries(process.argv.slice(2).map((a) => a.split("=")));
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const { rows } = await client.query(
  `SELECT "createdAt", level, source, message, path FROM "SiteLog"
   WHERE ($1::text IS NULL OR level = $1) AND ($2::text IS NULL OR source LIKE $2 || '%')
   ORDER BY "createdAt" DESC LIMIT $3`,
  [arg.level ?? null, arg.source ?? null, Number(arg.n) || 50],
);
for (const r of rows) console.log(`${r.createdAt.toISOString()} ${r.level.padEnd(5)} ${r.source} ${r.message}${r.path ? ` [${r.path}]` : ""}`);
await client.end();
