import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  auth: vi.fn(),
  requireStaff: vi.fn(),
  isLimited: vi.fn(async () => false),
  db: {
    specialRequest: { findUniqueOrThrow: vi.fn(), create: vi.fn(), update: vi.fn() },
    specialRequestReply: { create: vi.fn() },
    parentLink: { findFirst: vi.fn() },
    entitlement: { findFirst: vi.fn() },
    course: { findUnique: vi.fn() },
    user: { findMany: vi.fn() },
    notification: { createMany: vi.fn(), create: vi.fn() },
  },
}));
vi.mock("@/auth", () => ({ auth: h.auth }));
vi.mock("@/lib/db", () => ({ db: h.db }));
vi.mock("@/lib/staff", () => ({ requireStaff: h.requireStaff }));
vi.mock("@/lib/rate-limit", () => ({ isLimited: h.isLimited, recordAttempt: vi.fn(async () => {}) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

import { closeRequest, createSpecialRequest, parentReply, staffReply } from "./request-actions";

const form = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};

const thread = (instructorId: string | null) =>
  h.db.specialRequest.findUniqueOrThrow.mockResolvedValue({
    id: "r1",
    authorId: "parent-1",
    status: "OPEN",
    course: instructorId ? { instructorId } : null,
  });

const noWrites = () => {
  expect(h.db.specialRequestReply.create).not.toHaveBeenCalled();
  expect(h.db.specialRequest.update).not.toHaveBeenCalled();
  expect(h.db.notification.create).not.toHaveBeenCalled();
  expect(h.db.notification.createMany).not.toHaveBeenCalled();
};

beforeEach(() => {
  vi.clearAllMocks();
  h.isLimited.mockResolvedValue(false);
  h.db.specialRequestReply.create.mockResolvedValue({ id: "reply-1" });
  h.db.notification.create.mockResolvedValue({});
});

describe("staff access to a request", () => {
  const reply = { id: "r1", body: "We will help." };

  it("refuses a teacher who does not teach the course, for reply and close", async () => {
    h.requireStaff.mockResolvedValue({ id: "teacher-2", role: "INSTRUCTOR" });
    thread("teacher-1");
    await expect(staffReply(null, form(reply))).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(closeRequest(form({ id: "r1" }))).rejects.toThrow("NEXT_NOT_FOUND");
    noWrites();
  });

  it("refuses a teacher on a request with no course", async () => {
    h.requireStaff.mockResolvedValue({ id: "teacher-1", role: "INSTRUCTOR" });
    thread(null);
    await expect(staffReply(null, form(reply))).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(closeRequest(form({ id: "r1" }))).rejects.toThrow("NEXT_NOT_FOUND");
    noWrites();
  });

  it("lets the course's own teacher answer", async () => {
    h.requireStaff.mockResolvedValue({ id: "teacher-1", role: "INSTRUCTOR" });
    thread("teacher-1");
    expect(await staffReply(null, form(reply))).toBe("ok");
    expect(h.db.specialRequest.update).toHaveBeenCalledWith({ where: { id: "r1" }, data: { status: "ANSWERED" } });
  });

  it("lets an admin answer and close, with or without a course", async () => {
    h.requireStaff.mockResolvedValue({ id: "admin-1", role: "ADMIN" });
    thread(null);
    expect(await staffReply(null, form(reply))).toBe("ok");
    await closeRequest(form({ id: "r1" }));
    expect(h.db.specialRequest.update).toHaveBeenLastCalledWith({ where: { id: "r1" }, data: { status: "CLOSED" } });
  });
});

describe("createSpecialRequest", () => {
  const valid = { studentId: "child-1", subject: "A question", body: "Please look at the progress of my child." };

  it("is for parents only", async () => {
    h.auth.mockResolvedValue({ user: { id: "s1", role: "STUDENT" } });
    await expect(createSpecialRequest(null, form(valid))).rejects.toThrow("NEXT_NOT_FOUND");
    expect(h.db.specialRequest.create).not.toHaveBeenCalled();
  });

  it("refuses a child the parent is not linked to, and notifies nobody", async () => {
    h.auth.mockResolvedValue({ user: { id: "parent-1", role: "PARENT" } });
    h.db.parentLink.findFirst.mockResolvedValue(null);
    expect(await createSpecialRequest(null, form(valid))).toBe("unlinked");
    expect(h.db.specialRequest.create).not.toHaveBeenCalled();
    expect(h.db.notification.createMany).not.toHaveBeenCalled();
  });

  it("refuses a course the child never held", async () => {
    h.auth.mockResolvedValue({ user: { id: "parent-1", role: "PARENT" } });
    h.db.parentLink.findFirst.mockResolvedValue({ id: "link-1" });
    h.db.entitlement.findFirst.mockResolvedValue(null);
    expect(await createSpecialRequest(null, form({ ...valid, courseId: "c1" }))).toBe("invalid");
    expect(h.db.specialRequest.create).not.toHaveBeenCalled();
    expect(h.db.notification.createMany).not.toHaveBeenCalled();
  });
});

describe("parentReply", () => {
  it("refuses a parent who is not the author", async () => {
    h.auth.mockResolvedValue({ user: { id: "parent-2", role: "PARENT" } });
    thread(null);
    await expect(parentReply(null, form({ id: "r1", body: "Hello there" }))).rejects.toThrow("NEXT_NOT_FOUND");
    noWrites();
  });

  it("refuses a reply on a closed request", async () => {
    h.auth.mockResolvedValue({ user: { id: "parent-1", role: "PARENT" } });
    h.db.specialRequest.findUniqueOrThrow.mockResolvedValue({ id: "r1", authorId: "parent-1", status: "CLOSED" });
    expect(await parentReply(null, form({ id: "r1", body: "Hello there" }))).toBe("invalid");
    noWrites();
  });
});
