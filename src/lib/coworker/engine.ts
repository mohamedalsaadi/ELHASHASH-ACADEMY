import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { logError } from "@/lib/log-error";
import type { KnownProblem } from "@/lib/log-catalog";
import { matchKnown } from "@/lib/log-catalog";
import { notifyAdmins } from "@/lib/notify";
import { logEvent } from "@/lib/site-log";
import { checkEdits, invertEdits, LIMITS, mayMerge, type Edit } from "./guard";
import { githubClient, prUrl, type Gh } from "./github";
import { countSince, fileForRoute, scanErrors, type Group } from "./scan";
import { proposeFix, triage } from "./triage";

// Sentinel: reads the site log and acts on it, one small step per run so it fits a serverless function.
// Each run: (1) move open pull requests forward (merge when green and allowed, close when red), (2) watch recent merges and
// revert one that made its error come back, (3) take in new problems from the log, (4) work on at most one open case.
// Every code change goes through a branch and a pull request, passes guard.ts, and needs green CI before it is merged.

export type Deps = {
  gh: Gh;
  scan: (minutes: number) => Promise<Group[]>;
  countSince: typeof countSince;
  triage: typeof triage;
  proposeFix: typeof proposeFix;
  notify: (c: { id: string; status: string; titleEn: string; titleAr: string; bodyEn: string; bodyAr: string }) => Promise<void>;
  now: Date;
};

export function realDeps(): Deps {
  return {
    gh: githubClient(),
    scan: scanErrors,
    countSince,
    triage,
    proposeFix,
    now: new Date(),
    async notify(c) {
      await notifyAdmins({ kind: "SYSTEM", titleAr: c.titleAr, titleEn: c.titleEn, bodyAr: c.bodyAr, bodyEn: c.bodyEn, href: "/admin/ai", dedupeKey: `coworker:${c.id}:${c.status}` });
    },
  };
}

/** A fix needs this many sightings inside the scan window before the coworker touches code; a one-off blip is not a bug. */
export const MIN_SIGHTINGS_TO_FIX = 3;
export const WATCH_MINUTES = 30;
const MAX_ATTEMPTS = 2;

export type Verdict = { act: "wait" } | { act: "ignore"; reason: string } | { act: "escalate"; reason: string } | { act: "ask_model" } | { act: "fix" };

/** What to do with a case from the catalog alone, before any model is asked. Pure. */
export function decide(known: KnownProblem | null, count: number): Verdict {
  if (!known) return count >= MIN_SIGHTINGS_TO_FIX ? { act: "ask_model" } : { act: "wait" };
  if (known.who === "ignore") return { act: "ignore", reason: known.titleEn };
  if (known.who === "owner") return known.severity === "high" || count >= 2 ? { act: "escalate", reason: `${known.titleEn}. ${known.fixEn}` } : { act: "wait" };
  return count >= MIN_SIGHTINGS_TO_FIX ? { act: "fix" } : { act: "wait" };
}

/** The concrete source files worth showing the model for a problem: catalog files, the cron job's own route, the route a server error came from. */
export function filesFor(g: { source: string; route?: string | null; routeKind?: string | null }, known: KnownProblem | null): string[] {
  const out: string[] = [];
  const cron = /^cron\.([a-z-]+)$/.exec(g.source);
  if (cron) out.push(`src/app/api/cron/${cron[1]}/route.ts`);
  const fromRoute = fileForRoute(g.route ?? null, g.routeKind ?? null);
  if (fromRoute) out.push(fromRoute);
  for (const f of known?.files ?? []) if (/\.tsx?$/.test(f)) out.push(f);
  return [...new Set(out)].slice(0, LIMITS.files + 1);
}

export type TickResult = { skipped?: string; steps: string[] };

const json = (v: unknown) => v as Prisma.InputJsonValue;

async function act(steps: string[], caseId: string | null, message: string) {
  steps.push(message);
  await logEvent({ source: "coworker.action", message: message.slice(0, 480), meta: caseId ? { caseId } : undefined });
}

export async function tick(deps: Deps): Promise<TickResult> {
  const steps: string[] = [];
  const control = await db.coworkerControl.findUnique({ where: { id: "singleton" } });
  const paused = Boolean(control?.paused);
  const autoMerge = Boolean(control?.autoMerge);
  if (paused) return { skipped: "paused on /admin/ai", steps };

  await progressPrs(deps, steps, { paused, autoMerge });
  await watchMerged(deps, steps);
  await intake(deps);
  await work(deps, steps);
  return { steps };
}

async function mergesSince(since: Date) {
  return db.coworkerCase.count({ where: { mergedAt: { gte: since } } });
}

async function progressPrs(deps: Deps, steps: string[], ctl: { paused: boolean; autoMerge: boolean }) {
  const open = await db.coworkerCase.findMany({ where: { status: "PR_OPEN", prNumber: { not: null } }, orderBy: { createdAt: "asc" }, take: 5 });
  for (const c of open) {
    try {
      const st = await deps.gh.prState(c.prNumber!);
      if (st.state === "merged") {
        await db.coworkerCase.update({ where: { id: c.id }, data: { status: "MERGED", mergedAt: c.mergedAt ?? deps.now, note: "merged on GitHub" } });
        await act(steps, c.id, `case ${c.id.slice(-6)}: pull request ${c.prNumber} was merged on GitHub`);
        continue;
      }
      if (st.state === "closed") {
        await db.coworkerCase.update({ where: { id: c.id }, data: { status: "CLOSED", note: "closed on GitHub" } });
        await act(steps, c.id, `case ${c.id.slice(-6)}: pull request ${c.prNumber} was closed on GitHub`);
        continue;
      }
      if (st.checks === "failure") {
        await deps.gh.closePr(c.prNumber!, "Sentinel: the checks failed, so this change is closed and the problem goes to the owner.");
        if (c.branch) await deps.gh.deleteBranch(c.branch);
        await escalate(deps, c.id, "ESCALATED", "Checks failed on the proposed fix", `The fix for "${c.summary.slice(0, 120)}" failed the checks and was closed.`);
        await act(steps, c.id, `case ${c.id.slice(-6)}: checks failed, pull request closed, escalated`);
        continue;
      }
      if (st.checks === "pending") {
        if (deps.now.getTime() - c.createdAt.getTime() > 6 * 3_600_000) {
          await deps.gh.closePr(c.prNumber!, "Sentinel: the checks never finished, so this change is closed.");
          if (c.branch) await deps.gh.deleteBranch(c.branch);
          await escalate(deps, c.id, "ESCALATED", "Checks never finished", `The fix for "${c.summary.slice(0, 120)}" waited 6 hours for checks and was closed.`);
        }
        continue;
      }
      // Checks are green. Merge only when the owner has switched auto-merge on and the rate limits allow it.
      const mainChecks = (await deps.gh.checksFor(await deps.gh.mainSha())).checks;
      const verdict = mayMerge({
        autoMerge: ctl.autoMerge,
        paused: ctl.paused,
        mainChecks,
        mergesLastHour: await mergesSince(new Date(deps.now.getTime() - 3_600_000)),
        mergesLastDay: await mergesSince(new Date(deps.now.getTime() - 86_400_000)),
      });
      if (!verdict.ok) {
        if (!ctl.autoMerge && c.note !== "ready") {
          await db.coworkerCase.update({ where: { id: c.id }, data: { note: "ready" } });
          await deps.notify({
            id: c.id,
            status: "READY",
            titleEn: "Sentinel has a fix ready for you to merge",
            titleAr: "لدى Sentinel إصلاح جاهز للدمج",
            bodyEn: `${c.summary.slice(0, 160)} Pull request: ${prUrl(c.prNumber!)}`,
            bodyAr: `${c.summary.slice(0, 160)} طلب الدمج: ${prUrl(c.prNumber!)}`,
          });
        }
        continue;
      }
      const sha = await deps.gh.mergePr(c.prNumber!, st.headSha, `Sentinel: ${c.summary.slice(0, 80)}`);
      if (!sha) {
        await db.coworkerCase.update({ where: { id: c.id }, data: { note: "merge refused by GitHub" } });
        continue;
      }
      await db.coworkerCase.update({ where: { id: c.id }, data: { status: "MERGED", mergedSha: sha, mergedAt: deps.now, note: "merged and deployed by Sentinel" } });
      if (c.branch) await deps.gh.deleteBranch(c.branch);
      await act(steps, c.id, `case ${c.id.slice(-6)}: merged pull request ${c.prNumber} (${sha.slice(0, 7)}), deploy follows`);
      await deps.notify({
        id: c.id,
        status: "MERGED",
        titleEn: "Sentinel merged a fix and it is deploying",
        titleAr: "دمج Sentinel إصلاحًا وهو قيد النشر",
        bodyEn: `${c.summary.slice(0, 160)} Pull request: ${prUrl(c.prNumber!)}. It is watched for ${WATCH_MINUTES} minutes and reverted if the error returns.`,
        bodyAr: `${c.summary.slice(0, 160)} طلب الدمج: ${prUrl(c.prNumber!)}. يُراقب ${WATCH_MINUTES} دقيقة ويُتراجع عنه إن عاد الخطأ.`,
      });
    } catch (e) {
      await logError("coworker.error", e, { message: `advancing case ${c.id.slice(-6)}` });
      steps.push(`case ${c.id.slice(-6)}: error while advancing (see the log)`);
    }
  }
}

/** A merged fix whose error comes back within the watch window is reverted through a new pull request. */
async function watchMerged(deps: Deps, steps: string[]) {
  const since = new Date(deps.now.getTime() - WATCH_MINUTES * 60_000);
  const merged = await db.coworkerCase.findMany({ where: { kind: "FIX", status: "MERGED", mergedAt: { gte: since } }, take: 5 });
  for (const c of merged) {
    try {
      if ((await db.coworkerCase.count({ where: { fingerprint: `revert:${c.id}` } })) > 0) continue;
      const again = await deps.countSince({ source: c.source, fingerprint: c.fingerprint }, c.mergedAt!);
      if (again < MIN_SIGHTINGS_TO_FIX) continue;
      const edits = Array.isArray(c.edits) ? (c.edits as Edit[]) : [];
      const inverse = invertEdits(edits);
      const main = await deps.gh.mainSha();
      const files: Record<string, { content: string; sha: string }> = {};
      for (const p of new Set(inverse.map((e) => e.path))) {
        const f = await deps.gh.getFile(p, main);
        if (f) files[p] = f;
      }
      const checked = checkEdits(Object.fromEntries(Object.entries(files).map(([p, f]) => [p, f.content])), inverse);
      if (!checked.ok) {
        await escalate(deps, c.id, "ESCALATED", "Fix made it worse and could not be reverted automatically", `After the fix for "${c.summary.slice(0, 100)}" the error came back ${again} times and the revert does not apply cleanly: ${checked.reason}.`);
        await act(steps, c.id, `case ${c.id.slice(-6)}: error returned after the fix, automatic revert not possible (${checked.reason})`);
        continue;
      }
      const revert = await db.coworkerCase.create({
        data: { fingerprint: `revert:${c.id}`, kind: "REVERT", parentId: c.id, source: c.source, summary: `Revert: ${c.summary}`.slice(0, 500), status: "OPEN", attempts: 1, edits: json(inverse) },
      });
      const opened = await openPullRequest(deps, revert.id, `Revert: ${c.summary.slice(0, 70)}`, `Sentinel is reverting its own earlier change: the error it was meant to fix came back ${again} times within ${WATCH_MINUTES} minutes of the merge.`, files, checked.files);
      await escalate(deps, c.id, "ESCALATED", "Sentinel's fix made things worse; a revert was opened", `The error "${c.summary.slice(0, 100)}" came back after the fix. Revert pull request: ${prUrl(opened)}.`);
      await act(steps, c.id, `case ${c.id.slice(-6)}: error returned ${again} times after the fix, revert pull request ${opened} opened`);
    } catch (e) {
      await logError("coworker.error", e, { message: `watching case ${c.id.slice(-6)}` });
    }
  }
}

async function intake(deps: Deps) {
  const groups = await deps.scan(120);
  for (const g of groups) {
    const existing = await db.coworkerCase.findUnique({ where: { fingerprint: g.fingerprint } });
    if (!existing) {
      await db.coworkerCase.create({
        data: { fingerprint: g.fingerprint, source: g.source, summary: `${g.source}: ${g.message}`.slice(0, 500), knownCode: g.known?.code ?? null, count: g.count, firstSeenAt: g.firstSeenAt, lastSeenAt: g.lastSeenAt, route: g.route, routeKind: g.routeKind },
      });
      continue;
    }
    // A fix that merged more than the watch window ago, and the error is still happening: try once more, up to MAX_ATTEMPTS.
    const reopen = existing.status === "MERGED" && existing.kind === "FIX" && existing.mergedAt && deps.now.getTime() - existing.mergedAt.getTime() > WATCH_MINUTES * 60_000 && g.lastSeenAt > existing.mergedAt && g.count >= MIN_SIGHTINGS_TO_FIX && existing.attempts < MAX_ATTEMPTS;
    await db.coworkerCase.update({
      where: { id: existing.id },
      data: { count: Math.max(existing.count, g.count), lastSeenAt: g.lastSeenAt > existing.lastSeenAt ? g.lastSeenAt : existing.lastSeenAt, ...(reopen ? { status: "OPEN", note: "error continued after the fix" } : {}) },
    });
  }
}

async function escalate(deps: Deps, id: string, status: "ESCALATED" | "IGNORED", title: string, body: string) {
  await db.coworkerCase.update({ where: { id }, data: { status, note: body.slice(0, 500) } });
  if (status === "ESCALATED") await deps.notify({ id, status, titleEn: `Needs you: ${title}`, titleAr: `يحتاج تدخلك: ${title}`, bodyEn: body, bodyAr: body });
}

/** Creates the branch, writes the edited files, opens the pull request and records it on the case. */
async function openPullRequest(
  deps: Deps,
  caseId: string,
  title: string,
  explanation: string,
  before: Record<string, { content: string; sha: string }>,
  after: Record<string, string>,
): Promise<number> {
  const main = await deps.gh.mainSha();
  const branch = `coworker/${caseId.slice(-8)}-${deps.now.getTime().toString(36)}`;
  await deps.gh.createBranch(branch, main);
  const message = `Sentinel: ${title}\n\n${explanation}\n\nWritten by the Dhirwa log coworker from a site log finding.`;
  for (const [path, content] of Object.entries(after)) {
    if (content !== before[path]?.content) await deps.gh.putFile(branch, path, content, before[path].sha, message);
  }
  const body = `${explanation}\n\n---\nOpened by Sentinel, the Dhirwa log coworker. It reads only the site log. Checks must pass before it can be merged. Case \`${caseId}\`.`;
  const n = await deps.gh.openPr(branch, `Sentinel: ${title}`.slice(0, 120), body);
  await db.coworkerCase.update({ where: { id: caseId }, data: { status: "PR_OPEN", branch, prNumber: n } });
  return n;
}

async function work(deps: Deps, steps: string[]) {
  const c = await db.coworkerCase.findFirst({ where: { status: "OPEN", kind: "FIX" }, orderBy: [{ count: "desc" }, { createdAt: "asc" }] });
  if (!c) return;
  try {
    const known = matchKnown(c.source, c.summary);
    const group: Group = {
      fingerprint: c.fingerprint,
      source: c.source,
      message: c.summary.replace(`${c.source}: `, ""),
      count: c.count,
      firstSeenAt: c.firstSeenAt,
      lastSeenAt: c.lastSeenAt,
      route: c.route,
      routeKind: c.routeKind,
      paths: [],
      known,
    };
    let verdict = decide(known, c.count);
    if (verdict.act === "wait") return;
    if (verdict.act === "ask_model") {
      const t = await deps.triage(group);
      if (!t) return;
      verdict = t.action === "FIX" ? { act: "fix" } : t.action === "IGNORE" ? { act: "ignore", reason: t.reason } : { act: "escalate", reason: t.reason };
    }
    if (verdict.act === "ignore") {
      await escalate(deps, c.id, "IGNORED", verdict.reason, verdict.reason);
      await act(steps, c.id, `case ${c.id.slice(-6)} ignored: ${verdict.reason.slice(0, 120)}`);
      return;
    }
    if (verdict.act === "escalate") {
      await escalate(deps, c.id, "ESCALATED", known?.titleEn ?? c.source, verdict.reason);
      await act(steps, c.id, `case ${c.id.slice(-6)} escalated: ${verdict.reason.slice(0, 120)}`);
      return;
    }

    // act === "fix": show the model the likely files and let it propose exact edits; the guard decides if they may be committed.
    const main = await deps.gh.mainSha();
    const files: Record<string, { content: string; sha: string }> = {};
    for (const p of filesFor(group, known)) {
      const f = await deps.gh.getFile(p, main);
      if (f) files[p] = f;
    }
    if (Object.keys(files).length === 0) {
      await escalate(deps, c.id, "ESCALATED", known?.titleEn ?? c.source, `No source file could be matched to this error, so no fix was tried: ${c.summary.slice(0, 200)}`);
      await act(steps, c.id, `case ${c.id.slice(-6)} escalated: no source file matched`);
      return;
    }
    const fix = await deps.proposeFix(group, Object.fromEntries(Object.entries(files).map(([p, f]) => [p, f.content])), known ? known.titleEn : null);
    if (!fix || "giveUp" in fix) {
      const reason = fix ? fix.giveUp : "the model gave no usable answer";
      const attempts = c.attempts + 1;
      if (!fix && attempts < MAX_ATTEMPTS) {
        await db.coworkerCase.update({ where: { id: c.id }, data: { attempts } });
        return;
      }
      await escalate(deps, c.id, "ESCALATED", known?.titleEn ?? c.source, `Sentinel could not find a safe fix: ${reason}. ${c.summary.slice(0, 200)}`);
      await act(steps, c.id, `case ${c.id.slice(-6)} escalated: no safe fix (${reason.slice(0, 100)})`);
      return;
    }
    const checked = checkEdits(Object.fromEntries(Object.entries(files).map(([p, f]) => [p, f.content])), fix.edits);
    if (!checked.ok) {
      await escalate(deps, c.id, "ESCALATED", known?.titleEn ?? c.source, `Sentinel's proposed fix was refused by its own guardrails (${checked.reason}). ${c.summary.slice(0, 200)}`);
      await act(steps, c.id, `case ${c.id.slice(-6)} escalated: fix refused by the guard (${checked.reason})`);
      return;
    }
    await db.coworkerCase.update({ where: { id: c.id }, data: { edits: json(fix.edits), attempts: c.attempts + 1 } });
    const n = await openPullRequest(deps, c.id, fix.title, fix.explanation, files, checked.files);
    await act(steps, c.id, `case ${c.id.slice(-6)}: opened pull request ${n} (${checked.changed} lines): ${fix.title}`);
    await deps.notify({
      id: c.id,
      status: "PR_OPEN",
      titleEn: "Sentinel opened a fix",
      titleAr: "فتح Sentinel إصلاحًا",
      bodyEn: `${fix.title}. Pull request: ${prUrl(n)}`,
      bodyAr: `${fix.title}. طلب الدمج: ${prUrl(n)}`,
    });
  } catch (e) {
    await logError("coworker.error", e, { message: `working on case ${c.id.slice(-6)}` });
    steps.push(`case ${c.id.slice(-6)}: error while working (see the log)`);
  }
}
