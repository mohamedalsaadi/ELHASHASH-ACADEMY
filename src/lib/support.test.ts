import { describe, expect, it } from "vitest";
import { accountContext, mayDraft } from "./support";

const now = new Date("2026-11-20T10:00:00Z");

describe("accountContext", () => {
  it("says so when no account uses the email", () => {
    expect(accountContext(null, now)).toBe("No account uses this email address.");
  });
  it("describes plans by state and orders, and never carries a name or contact detail", () => {
    const text = accountContext(
      {
        plans: [
          { course: "Math", kind: "YEARLY", startsAt: new Date("2026-09-01T00:00:00Z"), endsAt: new Date("2027-07-15T00:00:00Z") },
          { course: "Physics", kind: "MONTHLY", startsAt: new Date("2026-08-01T00:00:00Z"), endsAt: new Date("2026-09-01T00:00:00Z") },
        ],
        orders: [{ status: "FAILED", total: "120.00 AED", at: new Date("2026-11-19T08:00:00Z") }],
      },
      now,
    );
    expect(text).toContain("- Plan: Math, YEARLY, active until 2027-07-15");
    expect(text).toContain("- Plan: Physics, MONTHLY, ended 2026-09-01");
    expect(text).toContain("- Order 2026-11-19: FAILED, 120.00 AED");
    expect(text).not.toMatch(/@|\+\d/);
  });
  it("lists nothing when the account has no plans or orders", () => {
    expect(accountContext({ plans: [], orders: [] }, now)).toContain("- No plans.");
  });
});

describe("mayDraft", () => {
  it("never sends a privacy request to the model", () => {
    expect(mayDraft("privacy")).toBe(false);
    for (const topic of ["general", "billing", "technical"]) expect(mayDraft(topic)).toBe(true);
  });
});
