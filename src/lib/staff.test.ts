import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  auth: vi.fn(),
  db: {
    user: { findUnique: vi.fn() },
    course: { count: vi.fn() },
    gradeSubject: { findUnique: vi.fn() },
    teacherCountry: { findMany: vi.fn() },
    teacherSlot: { findMany: vi.fn(), createMany: vi.fn() },
  },
}));

vi.mock("@/auth", () => ({ auth: h.auth }));
vi.mock("@/lib/db", () => ({ db: h.db }));
// notFound() throws in Next, which is what stops the caller.
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));

import { assertCourse, assertSlot, isCourseStaffDb, requireAdmin, requireStaff } from "./staff";

const admin = { id: "a1", name: "Owner", role: "ADMIN" as const };
const teacher = { id: "t1", name: "Teacher", role: "INSTRUCTOR" as const };

beforeEach(() => {
  vi.clearAllMocks();
  h.db.teacherCountry.findMany.mockResolvedValue([]);
  h.db.teacherSlot.findMany.mockResolvedValue([]);
});

describe("requireStaff / requireAdmin", () => {
  const as = (sessionRole: string, dbRole: string | null) => {
    h.auth.mockResolvedValue({ user: { id: "u1", name: "x", role: sessionRole } });
    h.db.user.findUnique.mockResolvedValue(dbRole ? { role: dbRole } : null);
  };

  it("404s a signed-out visitor and a student", async () => {
    h.auth.mockResolvedValue(null);
    await expect(requireStaff()).rejects.toThrow("NOT_FOUND");
    as("STUDENT", "STUDENT");
    await expect(requireStaff()).rejects.toThrow("NOT_FOUND");
  });

  it("trusts the database role over the cookie after a demotion or erasure", async () => {
    as("INSTRUCTOR", "STUDENT");
    await expect(requireStaff()).rejects.toThrow("NOT_FOUND");
    as("ADMIN", null);
    await expect(requireStaff()).rejects.toThrow("NOT_FOUND");
  });

  it("lets an instructor into staff areas but not admin-only ones", async () => {
    as("INSTRUCTOR", "INSTRUCTOR");
    await expect(requireStaff()).resolves.toMatchObject({ role: "INSTRUCTOR" });
    await expect(requireAdmin()).rejects.toThrow("NOT_FOUND");
    as("ADMIN", "ADMIN");
    await expect(requireAdmin()).resolves.toMatchObject({ role: "ADMIN" });
  });
});

describe("assertCourse", () => {
  it("lets an admin through without a lookup", async () => {
    await assertCourse(admin, "c1");
    expect(h.db.course.count).not.toHaveBeenCalled();
  });

  it("lets the owning instructor through, checking ownership by id", async () => {
    h.db.course.count.mockResolvedValue(1);
    await assertCourse(teacher, "c1");
    expect(h.db.course.count).toHaveBeenCalledWith({ where: { id: "c1", instructorId: "t1" } });
  });

  it("404s another teacher's course", async () => {
    h.db.course.count.mockResolvedValue(0);
    await expect(assertCourse(teacher, "c1")).rejects.toThrow("NOT_FOUND");
  });
});

describe("isCourseStaffDb", () => {
  it("is false for an unknown user", async () => {
    h.db.user.findUnique.mockResolvedValue(null);
    expect(await isCourseStaffDb("x", "c1")).toBe(false);
  });

  it("is true for an admin and for the course owner", async () => {
    h.db.user.findUnique.mockResolvedValue({ role: "ADMIN" });
    expect(await isCourseStaffDb("a1", "c1")).toBe(true);
    h.db.user.findUnique.mockResolvedValue({ role: "INSTRUCTOR" });
    h.db.course.count.mockResolvedValue(1);
    expect(await isCourseStaffDb("t1", "c1")).toBe(true);
  });

  it("is false for an instructor who does not own the course", async () => {
    h.db.user.findUnique.mockResolvedValue({ role: "INSTRUCTOR" });
    h.db.course.count.mockResolvedValue(0);
    expect(await isCourseStaffDb("t2", "c1")).toBe(false);
  });

  it("follows the stored role, so a user demoted to student owns nothing", async () => {
    h.db.user.findUnique.mockResolvedValue({ role: "STUDENT" });
    h.db.course.count.mockResolvedValue(0);
    expect(await isCourseStaffDb("t1", "c1")).toBe(false);
  });
});

describe("assertSlot", () => {
  const taught = (countryId: string, active = true) => h.db.gradeSubject.findUnique.mockResolvedValue({ grade: { countryId, active } });

  it("lets an admin through without a lookup", async () => {
    await assertSlot(admin, "g1", "s1");
    expect(h.db.gradeSubject.findUnique).not.toHaveBeenCalled();
  });

  it("allows a grade in a country the teacher was granted, and records the slot", async () => {
    taught("ae");
    h.db.teacherCountry.findMany.mockResolvedValue([{ countryId: "ae" }]);
    await assertSlot(teacher, "g1", "s1");
    expect(h.db.teacherSlot.createMany).toHaveBeenCalledWith({ data: [{ userId: "t1", gradeId: "g1", subjectId: "s1" }], skipDuplicates: true });
  });

  it("404s a grade in another country", async () => {
    taught("eg");
    h.db.teacherCountry.findMany.mockResolvedValue([{ countryId: "ae" }]);
    await expect(assertSlot(teacher, "g1", "s1")).rejects.toThrow("NOT_FOUND");
    expect(h.db.teacherSlot.createMany).not.toHaveBeenCalled();
  });

  it("404s an inactive grade and a subject the grade does not teach", async () => {
    h.db.teacherCountry.findMany.mockResolvedValue([{ countryId: "ae" }]);
    taught("ae", false);
    await expect(assertSlot(teacher, "g1", "s1")).rejects.toThrow("NOT_FOUND");
    h.db.gradeSubject.findUnique.mockResolvedValue(null);
    await expect(assertSlot(teacher, "g1", "s1")).rejects.toThrow("NOT_FOUND");
  });
});
