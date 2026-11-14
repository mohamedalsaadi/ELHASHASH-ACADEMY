import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  auth: vi.fn(),
  db: { parentLink: { findUnique: vi.fn() }, guardianConsent: { upsert: vi.fn(async (_a: { update: Record<string, unknown> }) => ({})) } },
}));
vi.mock("@/auth", () => ({ auth: h.auth }));
vi.mock("@/lib/db", () => ({ db: h.db }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

import { recordChildConsent } from "./actions";

const form = (studentId: string) => {
  const f = new FormData();
  f.set("studentId", studentId);
  return f;
};

beforeEach(() => vi.clearAllMocks());

describe("recordChildConsent", () => {
  it("rejects a parent who is not linked to the child, and writes nothing", async () => {
    h.auth.mockResolvedValue({ user: { id: "parent-2", role: "PARENT" } });
    h.db.parentLink.findUnique.mockResolvedValue(null);
    await expect(recordChildConsent(form("child-1"))).rejects.toThrow("NEXT_NOT_FOUND");
    expect(h.db.parentLink.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { parentId_studentId: { parentId: "parent-2", studentId: "child-1" } } }),
    );
    expect(h.db.guardianConsent.upsert).not.toHaveBeenCalled();
  });

  it("rejects a non-parent account", async () => {
    h.auth.mockResolvedValue({ user: { id: "t1", role: "INSTRUCTOR" } });
    await expect(recordChildConsent(form("child-1"))).rejects.toThrow("NEXT_NOT_FOUND");
    expect(h.db.guardianConsent.upsert).not.toHaveBeenCalled();
  });

  it("a repeat consent only bumps verifiedAt; the first name and wording stand", async () => {
    h.auth.mockResolvedValue({ user: { id: "parent-1", role: "PARENT" } });
    h.db.parentLink.findUnique.mockResolvedValue({ parent: { name: "Parent" } });
    await recordChildConsent(form("child-1"));
    const arg = h.db.guardianConsent.upsert.mock.calls[0]![0];
    expect(Object.keys(arg.update)).toEqual(["verifiedAt"]);
  });
});
