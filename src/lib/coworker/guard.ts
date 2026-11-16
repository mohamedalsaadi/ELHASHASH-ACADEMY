// The coworker's hard limits. These run in code, after the model has answered and before anything is committed:
// a model that is wrong, confused or manipulated by text in a log line still cannot get past them.
// The owner chose "full freedom except secrets"; the extra denials (workflows, migrations, dependencies, its own code,
// the rules file) exist because a fix to those cannot be undone by reverting a commit, or would let it rewrite its own gate.

export type Edit = { path: string; find: string; replace: string };

export const LIMITS = { files: 2, changedLines: 80, fileLines: 600, mergesPerHour: 1, mergesPerDay: 3 } as const;

const ALLOW = /^src\//;
const DENY: RegExp[] = [
  /(^|\/)\.env/,
  /^\.github\//,
  /^vercel\.json$/,
  /^package(-lock)?\.json$/,
  /^prisma\//,
  /^AGENTS\.md$/,
  /^src\/lib\/coworker\//,
  /^src\/app\/api\/cron\/coworker\//,
  /^src\/generated\//,
  /\.(png|jpe?g|webp|svg|ico|woff2?|pdf|mp[34])$/i,
];

/** Anything that looks like a key, a token, a live-mode switch or a private key must never be written by the coworker. */
const SECRET = /sk_live|sk_test|rk_live|whsec_|AKIA[0-9A-Z]{16}|-----BEGIN|ZIINA_TEST|ZIINA_API_KEY\s*=|\b[A-Za-z0-9+/_-]{40,}\b|(api[_-]?key|secret|token|password)\s*[:=]\s*["'`][^"'`\s]{12,}/i;

export function pathAllowed(path: string): { ok: true } | { ok: false; reason: string } {
  if (path.includes("..") || path.startsWith("/") || path.includes("\\")) return { ok: false, reason: `path ${path} is not a plain repository path` };
  if (DENY.some((d) => d.test(path))) return { ok: false, reason: `${path} is off limits for the coworker` };
  if (!ALLOW.test(path)) return { ok: false, reason: `${path} is outside src/` };
  return { ok: true };
}

const lines = (s: string) => (s === "" ? 0 : s.split("\n").length);

/** Applies find/replace edits to file contents. Each `find` must match exactly once, so an edit can never land somewhere unintended. */
export function applyEdits(files: Record<string, string>, edits: Edit[]): { ok: true; files: Record<string, string> } | { ok: false; reason: string } {
  const out = { ...files };
  for (const e of edits) {
    const src = out[e.path];
    if (src === undefined) return { ok: false, reason: `${e.path} was not provided to the model` };
    if (e.find === "") return { ok: false, reason: `an edit to ${e.path} has an empty "find"` };
    const first = src.indexOf(e.find);
    if (first === -1) return { ok: false, reason: `an edit to ${e.path} does not match the file` };
    if (src.indexOf(e.find, first + 1) !== -1) return { ok: false, reason: `an edit to ${e.path} matches more than once` };
    out[e.path] = src.slice(0, first) + e.replace + src.slice(first + e.find.length);
  }
  return { ok: true, files: out };
}

/** Everything the coworker must pass before a commit: paths, number of files, size, secrets, and that the edits really apply. */
export function checkEdits(files: Record<string, string>, edits: Edit[]): { ok: true; files: Record<string, string>; changed: number } | { ok: false; reason: string } {
  if (edits.length === 0) return { ok: false, reason: "no edits" };
  const paths = [...new Set(edits.map((e) => e.path))];
  if (paths.length > LIMITS.files) return { ok: false, reason: `touches ${paths.length} files (limit ${LIMITS.files})` };
  for (const p of paths) {
    const v = pathAllowed(p);
    if (!v.ok) return v;
    if (lines(files[p] ?? "") > LIMITS.fileLines) return { ok: false, reason: `${p} is longer than ${LIMITS.fileLines} lines` };
  }
  let changed = 0;
  for (const e of edits) {
    if (SECRET.test(e.replace)) return { ok: false, reason: "an edit contains something that looks like a secret or a live-mode switch" };
    changed += lines(e.find) + lines(e.replace);
  }
  if (changed > LIMITS.changedLines) return { ok: false, reason: `changes ${changed} lines (limit ${LIMITS.changedLines})` };
  const applied = applyEdits(files, edits);
  if (!applied.ok) return applied;
  return { ok: true, files: applied.files, changed };
}

/** The edits that undo `edits` on a file that now contains each `replace` once. */
export function invertEdits(edits: Edit[]): Edit[] {
  return [...edits].reverse().map((e) => ({ path: e.path, find: e.replace, replace: e.find }));
}

/** May a green pull request be merged now? Pure, so the rate limits are easy to test. */
export function mayMerge(input: { autoMerge: boolean; paused: boolean; mainChecks: "pending" | "success" | "failure"; mergesLastHour: number; mergesLastDay: number }): { ok: true } | { ok: false; reason: string } {
  if (input.paused) return { ok: false, reason: "paused" };
  if (!input.autoMerge) return { ok: false, reason: "auto-merge is off (shadow mode)" };
  if (input.mainChecks === "failure") return { ok: false, reason: "checks on main are red" };
  if (input.mergesLastHour >= LIMITS.mergesPerHour) return { ok: false, reason: "one merge per hour already used" };
  if (input.mergesLastDay >= LIMITS.mergesPerDay) return { ok: false, reason: "three merges today already used" };
  return { ok: true };
}
