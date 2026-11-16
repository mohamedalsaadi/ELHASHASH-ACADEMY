import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { matchKnown, type KnownProblem } from "@/lib/log-catalog";

// The coworker's only window onto the site: SiteLog rows, read-only. The log is already scrubbed of query strings
// and holds facts, not what a person typed. Grouping here turns many rows into a few problems.

export type LogRow = { source: string; message: string; path: string | null; createdAt: Date; meta: unknown };

export type Group = {
  fingerprint: string;
  source: string;
  /** The newest message in the group, as stored. */
  message: string;
  count: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
  /** Next.js route and kind ("render" or "route") from `server.error` meta, when the row has one. */
  route: string | null;
  routeKind: string | null;
  paths: string[];
  known: KnownProblem | null;
};

/** The same problem hashes the same: ids, numbers and hex are blanked so "order cmw8… failed" and "order cmx9… failed" group together. */
export function fingerprint(source: string, message: string): string {
  const norm = message
    .toLowerCase()
    .replace(/\b[a-z0-9]{20,}\b/g, "#")
    .replace(/[0-9a-f]{8,}/g, "#")
    .replace(/\d+/g, "#")
    .replace(/\s+/g, " ")
    .slice(0, 140);
  return createHash("sha1").update(`${source}|${norm}`).digest("hex").slice(0, 16);
}

/** Lines the coworker never acts on: its own traffic and plain heartbeats. */
const SKIP = /^(cron\.[a-z-]+$|client\.vdo_upload$)/;

export function groupRows(rows: LogRow[]): Group[] {
  const map = new Map<string, Group>();
  for (const r of rows) {
    if (/^coworker\./.test(r.source) || (SKIP.test(r.source) && /finished/.test(r.message))) continue;
    const fp = fingerprint(r.source, r.message);
    const m = (r.meta && typeof r.meta === "object" ? r.meta : {}) as { route?: unknown; kind?: unknown };
    const route = typeof m.route === "string" ? m.route : null;
    const routeKind = typeof m.kind === "string" ? m.kind : null;
    const g = map.get(fp);
    if (!g) {
      map.set(fp, { fingerprint: fp, source: r.source, message: r.message, count: 1, firstSeenAt: r.createdAt, lastSeenAt: r.createdAt, route, routeKind, paths: r.path ? [r.path] : [], known: matchKnown(r.source, r.message) });
      continue;
    }
    g.count += 1;
    if (r.createdAt > g.lastSeenAt) {
      g.lastSeenAt = r.createdAt;
      g.message = r.message;
    }
    if (r.createdAt < g.firstSeenAt) g.firstSeenAt = r.createdAt;
    if (!g.route && route) {
      g.route = route;
      g.routeKind = routeKind;
    }
    if (r.path && g.paths.length < 3 && !g.paths.includes(r.path)) g.paths.push(r.path);
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

/** Errors from the last `minutes`, grouped. Warnings are not read: a refusal is not a bug. */
export async function scanErrors(minutes: number): Promise<Group[]> {
  const rows = await db.siteLog.findMany({
    where: { level: "ERROR", createdAt: { gte: new Date(Date.now() - minutes * 60_000) } },
    orderBy: { createdAt: "desc" },
    take: 500,
    select: { source: true, message: true, path: true, createdAt: true, meta: true },
  });
  return groupRows(rows);
}

/** How many ERROR rows with this fingerprint landed after `since`. Used to watch a fix after it merges. */
export async function countSince(g: { source: string; fingerprint: string }, since: Date): Promise<number> {
  const rows = await db.siteLog.findMany({ where: { level: "ERROR", source: g.source, createdAt: { gt: since } }, take: 200, select: { source: true, message: true } });
  return rows.filter((r) => fingerprint(r.source, r.message) === g.fingerprint).length;
}

/** The source file a server error came from, taken from its Next.js route. Null for actions and anything that does not map to a file under src/app. */
export function fileForRoute(route: string | null, kind: string | null): string | null {
  if (!route || !route.startsWith("/") || (kind !== "render" && kind !== "route")) return null;
  const clean = route.replace(/\/(page|route)$/, "");
  return `src/app${clean}/${kind === "route" ? "route.ts" : "page.tsx"}`;
}
