import { describe, expect, it } from "vitest";
import { phoneSchema, signUpSchema } from "./schemas/auth";

describe("phoneSchema", () => {
  it.each([
    "01012345678",
    "01112345678",
    "0501234567",
    "51234567",
    "31234567",
    "66123456",
    "71234567",
    "+201012345678",
    "+966501234567",
    "+971501234567",
  ])("accepts the mobile %s", (phone) => {
    expect(phoneSchema.safeParse(phone).success).toBe(true);
  });

  it.each(["1234567", "0612345678", "0101234567", "phone", "+12", "+abc123456"])("rejects %s", (phone) => {
    expect(phoneSchema.safeParse(phone).success).toBe(false);
  });
});

describe("password policy", () => {
  const base = { name: "طالب", phone: "01012345678", gradeId: "g1", email: "s@example.com" };
  it("rejects under 12 characters", () => {
    expect(signUpSchema.safeParse({ ...base, password: "short123" }).success).toBe(false);
  });
  it("rejects past 72 characters, which bcrypt would silently truncate", () => {
    expect(signUpSchema.safeParse({ ...base, password: "a".repeat(73) }).success).toBe(false);
    expect(signUpSchema.safeParse({ ...base, password: "a".repeat(72) }).success).toBe(true);
  });
});

describe("signUpSchema", () => {
  const base = { name: "طالب", phone: "01012345678", password: "password1234", gradeId: "g1" };

  it("requires a valid email and lowercases it", () => {
    const r = signUpSchema.safeParse({ ...base, email: "Student@Example.COM" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe("student@example.com");
  });

  it("rejects a missing or malformed email", () => {
    expect(signUpSchema.safeParse(base).success).toBe(false);
    expect(signUpSchema.safeParse({ ...base, email: "not-an-email" }).success).toBe(false);
  });

  it("requires a grade for a student but not for a parent", () => {
    const parent = { type: "PARENT" as const, name: "ولي", email: "parent@example.com", phone: "01012345678", password: "password1234" };
    expect(signUpSchema.safeParse(parent).success).toBe(true);
    expect(signUpSchema.safeParse({ ...parent, type: "STUDENT" as const }).success).toBe(false);
  });
});
