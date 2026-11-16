import { describe, expect, it } from "vitest";
import { applyEdits, checkEdits, invertEdits, LIMITS, mayMerge, pathAllowed } from "./guard";

describe("pathAllowed", () => {
  it("allows source files under src/", () => {
    expect(pathAllowed("src/app/api/cron/briefing/route.ts").ok).toBe(true);
    expect(pathAllowed("src/lib/payments.ts").ok).toBe(true);
  });
  it.each([".env.local", "src/.env", ".github/workflows/ci.yml", "vercel.json", "package.json", "package-lock.json", "prisma/migrations/x/migration.sql", "AGENTS.md", "src/lib/coworker/guard.ts", "src/app/api/cron/coworker/route.ts", "src/generated/prisma/client.ts", "../outside.ts", "/etc/passwd", "docs/plan.md", "public/logo.png"])("refuses %s", (p) => {
    expect(pathAllowed(p).ok).toBe(false);
  });
});

describe("applyEdits", () => {
  const files = { "src/a.ts": "const a = 1;\nconst b = 2;\n" };
  it("replaces one exact match", () => {
    const r = applyEdits(files, [{ path: "src/a.ts", find: "const b = 2;", replace: "const b = 3;" }]);
    expect(r.ok && r.files["src/a.ts"]).toBe("const a = 1;\nconst b = 3;\n");
  });
  it("refuses a find that matches nowhere, twice, or is empty", () => {
    expect(applyEdits(files, [{ path: "src/a.ts", find: "zzz", replace: "x" }]).ok).toBe(false);
    expect(applyEdits({ "src/a.ts": "x x" }, [{ path: "src/a.ts", find: "x", replace: "y" }]).ok).toBe(false);
    expect(applyEdits(files, [{ path: "src/a.ts", find: "", replace: "y" }]).ok).toBe(false);
  });
  it("refuses an edit to a file the model was not shown", () => {
    expect(applyEdits(files, [{ path: "src/other.ts", find: "a", replace: "b" }]).ok).toBe(false);
  });
});

describe("checkEdits", () => {
  const files = { "src/a.ts": "const a = 1;\n", "src/b.ts": "const b = 1;\n", "src/c.ts": "const c = 1;\n" };
  it("passes a small safe edit", () => {
    const r = checkEdits(files, [{ path: "src/a.ts", find: "const a = 1;", replace: "const a = 2;" }]);
    expect(r.ok).toBe(true);
  });
  it("refuses more than two files", () => {
    const r = checkEdits(files, ["a", "b", "c"].map((n) => ({ path: `src/${n}.ts`, find: `const ${n} = 1;`, replace: `const ${n} = 2;` })));
    expect(r.ok).toBe(false);
  });
  it("refuses a denied path even when the file was shown", () => {
    const r = checkEdits({ ".github/workflows/ci.yml": "on: push\n" }, [{ path: ".github/workflows/ci.yml", find: "on: push", replace: "on: pull_request" }]);
    expect(r.ok).toBe(false);
  });
  it("refuses secrets and live-mode switches in the new text", () => {
    for (const bad of ['const k = "sk_live_abcdefghijklmnop";', "process.env.ZIINA_TEST = '1';", 'const token = "abcdefghijklmnopqrstuvwx";', "x" + "y".repeat(45)]) {
      expect(checkEdits(files, [{ path: "src/a.ts", find: "const a = 1;", replace: bad }]).ok).toBe(false);
    }
  });
  it("refuses a change that is too large", () => {
    const big = Array.from({ length: LIMITS.changedLines + 5 }, (_, i) => `line ${i}`).join("\n");
    expect(checkEdits(files, [{ path: "src/a.ts", find: "const a = 1;", replace: big }]).ok).toBe(false);
  });
  it("refuses an empty edit list", () => {
    expect(checkEdits(files, []).ok).toBe(false);
  });
});

describe("invertEdits", () => {
  it("undoes edits in reverse order", () => {
    const edits = [{ path: "src/a.ts", find: "one", replace: "two" }, { path: "src/a.ts", find: "two\nx", replace: "three" }];
    const inv = invertEdits(edits);
    expect(inv[0]).toEqual({ path: "src/a.ts", find: "three", replace: "two\nx" });
    expect(inv[1]).toEqual({ path: "src/a.ts", find: "two", replace: "one" });
  });
});

describe("mayMerge", () => {
  const ok = { autoMerge: true, paused: false, mainChecks: "success" as const, mergesLastHour: 0, mergesLastDay: 0 };
  it("merges when everything allows it", () => {
    expect(mayMerge(ok).ok).toBe(true);
  });
  it("holds back in shadow mode, when paused, when main is red, and at the rate limits", () => {
    expect(mayMerge({ ...ok, autoMerge: false }).ok).toBe(false);
    expect(mayMerge({ ...ok, paused: true }).ok).toBe(false);
    expect(mayMerge({ ...ok, mainChecks: "failure" }).ok).toBe(false);
    expect(mayMerge({ ...ok, mergesLastHour: 1 }).ok).toBe(false);
    expect(mayMerge({ ...ok, mergesLastDay: 3 }).ok).toBe(false);
  });
});
