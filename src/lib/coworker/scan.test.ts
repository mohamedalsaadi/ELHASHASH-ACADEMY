import { describe, expect, it } from "vitest";
import { summariseChecks } from "./github";
import { fileForRoute, fingerprint, groupRows } from "./scan";

describe("fingerprint", () => {
  it("groups the same problem across different ids and numbers", () => {
    expect(fingerprint("payment.gateway", "ZIINA intent create failed: Error 502 for order cmw8abcdefghij1234567890")).toBe(
      fingerprint("payment.gateway", "ZIINA intent create failed: Error 504 for order cmx9zzzzzzzzzz9999999999"),
    );
  });
  it("keeps different sources and different messages apart", () => {
    expect(fingerprint("a", "boom")).not.toBe(fingerprint("b", "boom"));
    expect(fingerprint("a", "boom")).not.toBe(fingerprint("a", "bang"));
  });
});

describe("groupRows", () => {
  const t = (m: number) => new Date(Date.UTC(2026, 10, 16, 10, m));
  it("counts repeats, keeps the newest message and skips heartbeats and its own lines", () => {
    const g = groupRows([
      { source: "mail.send", message: "Resend answered 403: domain is not verified (req 11)", path: null, createdAt: t(1), meta: null },
      { source: "mail.send", message: "Resend answered 403: domain is not verified (req 22)", path: "/ar/x", createdAt: t(5), meta: null },
      { source: "cron.briefing", message: "finished", path: null, createdAt: t(2), meta: null },
      { source: "coworker.action", message: "case x ignored", path: null, createdAt: t(3), meta: null },
    ]);
    expect(g).toHaveLength(1);
    expect(g[0].count).toBe(2);
    expect(g[0].message).toBe("Resend answered 403: domain is not verified (req 22)");
    expect(g[0].known?.code).toBe("MAIL_REFUSED");
  });
  it("takes the route from a server error row", () => {
    const g = groupRows([{ source: "server.error", message: "TypeError: x", path: "/ar/a", createdAt: t(1), meta: { route: "/[locale]/courses/page", kind: "render" } }]);
    expect(g[0].route).toBe("/[locale]/courses/page");
    expect(g[0].routeKind).toBe("render");
  });
});

describe("fileForRoute", () => {
  it("maps pages and route handlers, not actions", () => {
    expect(fileForRoute("/[locale]/courses/page", "render")).toBe("src/app/[locale]/courses/page.tsx");
    expect(fileForRoute("/api/log/route", "route")).toBe("src/app/api/log/route.ts");
    expect(fileForRoute("/[locale]/x/page", "action")).toBeNull();
    expect(fileForRoute(null, "render")).toBeNull();
  });
});

describe("summariseChecks", () => {
  const run = (conclusion: string | null, status = "completed") => ({ name: "check", status, conclusion });
  it("is success only when there are checks and all passed", () => {
    expect(summariseChecks([run("success"), run("skipped")], [{ state: "success" }]).checks).toBe("success");
    expect(summariseChecks([], []).checks).toBe("pending");
  });
  it("ignores a cancelled run (replaced by a newer push) instead of calling it a failure", () => {
    expect(summariseChecks([run("success"), run("cancelled")], []).checks).toBe("success");
    expect(summariseChecks([run("cancelled")], []).checks).toBe("pending");
  });
  it("is failure when any check failed, pending while one is running", () => {
    expect(summariseChecks([run("success"), run("failure")], []).checks).toBe("failure");
    expect(summariseChecks([run("success"), run(null, "in_progress")], []).checks).toBe("pending");
    expect(summariseChecks([run("success")], [{ state: "pending" }]).checks).toBe("pending");
  });
});
