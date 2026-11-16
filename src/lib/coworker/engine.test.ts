import { beforeEach, describe, expect, it, vi } from "vitest";

// An in-memory stand-in for the tables the engine touches, supporting only the query shapes it uses.
type Row = Record<string, unknown> & { id: string };
let cases: Row[] = [];
let control: Row | null = null;
let seq = 0;
const match = (row: Row, where: Record<string, unknown> = {}) =>
  Object.entries(where).every(([k, v]) => {
    const x = row[k];
    if (v && typeof v === "object" && !(v instanceof Date)) {
      const o = v as { not?: unknown; gte?: Date };
      if ("not" in o) return x !== o.not;
      if (o.gte) return x instanceof Date && x >= o.gte;
    }
    return x === v;
  });
vi.mock("@/lib/db", () => ({
  db: {
    coworkerControl: { findUnique: async () => control },
    coworkerCase: {
      findMany: async ({ where, take }: { where?: Record<string, unknown>; take?: number }) => cases.filter((c) => match(c, where)).slice(0, take ?? 999),
      findFirst: async ({ where }: { where?: Record<string, unknown> }) => [...cases].filter((c) => match(c, where)).sort((a, b) => (b.count as number) - (a.count as number))[0] ?? null,
      findUnique: async ({ where }: { where: Record<string, unknown> }) => cases.find((c) => match(c, where)) ?? null,
      count: async ({ where }: { where?: Record<string, unknown> }) => cases.filter((c) => match(c, where)).length,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `case${++seq}abcdef`, status: "OPEN", kind: "FIX", attempts: 0, count: 1, note: null, branch: null, prNumber: null, mergedAt: null, mergedSha: null, edits: null, route: null, routeKind: null, createdAt: new Date(), ...data } as Row;
        cases.push(row);
        return row;
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => Object.assign(cases.find((c) => c.id === where.id)!, data),
    },
  },
}));
vi.mock("@/lib/site-log", () => ({ logEvent: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/notify", () => ({ notifyAdmins: vi.fn() }));

import { tick, type Deps } from "./engine";
import type { Gh } from "./github";
import type { Group } from "./scan";

const FILE = "export async function GET() {\n  return job();\n}\n";
const GOOD_EDIT = { path: "src/app/api/cron/briefing/route.ts", find: "return job();", replace: "return await job();" };

const group = (over: Partial<Group> = {}): Group => ({
  fingerprint: "fp1",
  source: "cron.briefing",
  message: "failed: TypeError: boom",
  count: 4,
  firstSeenAt: new Date("2026-11-16T09:00:00Z"),
  lastSeenAt: new Date("2026-11-16T09:50:00Z"),
  route: null,
  routeKind: null,
  paths: [],
  known: null,
  ...over,
});

const mock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

function fake(): Gh {
  return {
    mainSha: vi.fn().mockResolvedValue("main1"),
    getFile: vi.fn().mockResolvedValue({ content: FILE, sha: "blob1" }),
    createBranch: vi.fn().mockResolvedValue(undefined),
    putFile: vi.fn().mockResolvedValue("c1"),
    openPr: vi.fn().mockResolvedValue(7),
    prState: vi.fn().mockResolvedValue({ state: "open", headSha: "h1", checks: "pending", hasChecks: true }),
    mergePr: vi.fn().mockResolvedValue("merged1"),
    closePr: vi.fn().mockResolvedValue(undefined),
    deleteBranch: vi.fn().mockResolvedValue(undefined),
    checksFor: vi.fn().mockResolvedValue({ checks: "success", hasChecks: true }),
  } as unknown as Gh;
}

function deps(over: Partial<Deps> = {}): Deps {
  return {
    gh: fake(),
    scan: async () => [group()],
    countSince: async () => 0,
    triage: vi.fn(),
    proposeFix: vi.fn().mockResolvedValue({ edits: [GOOD_EDIT], title: "Await the job", explanation: "The job was not awaited." }),
    notify: vi.fn().mockResolvedValue(undefined),
    now: new Date("2026-11-16T10:00:00Z"),
    ...over,
  };
}

const green = { state: "open", headSha: "h1", checks: "success", hasChecks: true };

beforeEach(() => {
  cases = [];
  control = null;
  seq = 0;
});

describe("tick", () => {
  it("does nothing while paused", async () => {
    control = { id: "singleton", paused: true, autoMerge: true };
    const d = deps();
    expect((await tick(d)).skipped).toMatch(/paused/);
    expect(d.proposeFix).not.toHaveBeenCalled();
  });

  it("opens a pull request for a repeated, fixable error and never merges in shadow mode", async () => {
    const d = deps();
    await tick(d);
    expect(d.gh.createBranch).toHaveBeenCalled();
    expect(d.gh.putFile).toHaveBeenCalledWith(expect.stringMatching(/^coworker\//), "src/app/api/cron/briefing/route.ts", expect.stringContaining("return await job();"), "blob1", expect.any(String));
    expect(d.gh.openPr).toHaveBeenCalledTimes(1);
    expect(cases[0].status).toBe("PR_OPEN");
    expect(cases[0].prNumber).toBe(7);

    // Checks go green: shadow mode tells the owner and waits.
    mock(d.gh.prState).mockResolvedValue(green);
    await tick(d);
    expect(d.gh.mergePr).not.toHaveBeenCalled();
    expect(d.notify).toHaveBeenCalledWith(expect.objectContaining({ status: "READY" }));
  });

  it("merges a green pull request once auto-merge is on", async () => {
    const d = deps();
    await tick(d);
    control = { id: "singleton", paused: false, autoMerge: true };
    mock(d.gh.prState).mockResolvedValue(green);
    await tick(d);
    expect(d.gh.mergePr).toHaveBeenCalledWith(7, "h1", expect.stringContaining("Sentinel"));
    expect(cases[0].status).toBe("MERGED");
    expect(cases[0].mergedSha).toBe("merged1");
  });

  it("does not merge while main's own checks are red", async () => {
    const d = deps();
    await tick(d);
    control = { id: "singleton", paused: false, autoMerge: true };
    mock(d.gh.prState).mockResolvedValue(green);
    mock(d.gh.checksFor).mockResolvedValue({ checks: "failure", hasChecks: true });
    await tick(d);
    expect(d.gh.mergePr).not.toHaveBeenCalled();
  });

  it("closes the pull request and escalates when the checks fail", async () => {
    const d = deps();
    await tick(d);
    mock(d.gh.prState).mockResolvedValue({ ...green, checks: "failure" });
    await tick(d);
    expect(d.gh.closePr).toHaveBeenCalledWith(7, expect.any(String));
    expect(cases[0].status).toBe("ESCALATED");
    expect(d.notify).toHaveBeenCalledWith(expect.objectContaining({ status: "ESCALATED" }));
  });

  it("refuses a fix that touches a forbidden file and escalates without opening a pull request", async () => {
    const d = deps({ proposeFix: vi.fn().mockResolvedValue({ edits: [{ path: ".github/workflows/ci.yml", find: "a", replace: "b" }], title: "x", explanation: "x" }) });
    await tick(d);
    expect(d.gh.openPr).not.toHaveBeenCalled();
    expect(cases[0].status).toBe("ESCALATED");
  });

  it("escalates a problem only the owner can fix, without asking the model", async () => {
    const d = deps({ scan: async () => [group({ fingerprint: "fp2", source: "vdocipher.slot", message: 'VdoCipher upload slot failed: 403 {"message":"trial limit of 4 videos"}', count: 2 })] });
    await tick(d);
    expect(d.proposeFix).not.toHaveBeenCalled();
    expect(d.triage).not.toHaveBeenCalled();
    expect(cases[0].status).toBe("ESCALATED");
  });

  it("waits on a one-off error", async () => {
    const d = deps({ scan: async () => [group({ count: 1 })] });
    await tick(d);
    expect(d.proposeFix).not.toHaveBeenCalled();
    expect(cases[0].status).toBe("OPEN");
  });

  it("opens a revert when the error returns after a merge", async () => {
    const d = deps();
    await tick(d);
    control = { id: "singleton", paused: false, autoMerge: true };
    mock(d.gh.prState).mockResolvedValue(green);
    await tick(d);
    expect(cases[0].status).toBe("MERGED");

    // main now contains the fix; the error comes back 3 times.
    mock(d.gh.getFile).mockResolvedValue({ content: FILE.replace("return job();", "return await job();"), sha: "blob2" });
    mock(d.gh.openPr).mockResolvedValue(8);
    await tick(deps({ gh: d.gh, scan: async () => [], countSince: async () => 3, now: new Date("2026-11-16T10:10:00Z") }));
    const revert = cases.find((c) => c.kind === "REVERT");
    expect(revert?.status).toBe("PR_OPEN");
    expect(revert?.prNumber).toBe(8);
    expect(d.gh.putFile).toHaveBeenLastCalledWith(expect.any(String), "src/app/api/cron/briefing/route.ts", FILE, "blob2", expect.any(String));
  });
});
