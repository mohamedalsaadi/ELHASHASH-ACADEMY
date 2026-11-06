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
  const base = {
    name: "طالب",
    phone: "01012345678",
    gradeId: "g1",
    email: "s@example.com",
    dateOfBirth: "2000-01-01",
  };
  it("rejects under 8 characters", () => {
    expect(signUpSchema.safeParse({ ...base, password: "short12" }).success).toBe(false);
    expect(signUpSchema.safeParse({ ...base, password: "short123" }).success).toBe(true);
  });
  it("rejects past 72 characters, which bcrypt would silently truncate", () => {
    expect(signUpSchema.safeParse({ ...base, password: "a".repeat(73) }).success).toBe(false);
    expect(signUpSchema.safeParse({ ...base, password: "a".repeat(72) }).success).toBe(true);
  });
});

describe("signUpSchema", () => {
  const base = {
    name: "طالب",
    phone: "01012345678",
    password: "password1234",
    gradeId: "g1",
    dateOfBirth: "2000-01-01",
  };
  const minor = {
    ...base,
    dateOfBirth: "2012-01-01",
    guardianName: "ولي الأمر",
    guardianEmail: "guardian@example.com",
    guardianConsent: true,
  };

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

  it("requires a birth date for a student", () => {
    expect(signUpSchema.safeParse({ ...base, email: "s@example.com", dateOfBirth: undefined }).success).toBe(false);
  });

  it("lets an adult student sign up without a guardian", () => {
    expect(signUpSchema.safeParse({ ...base, email: "s@example.com" }).success).toBe(true);
  });

  it("requires a guardian name, email and consent for a minor", () => {
    expect(signUpSchema.safeParse({ ...minor, email: "s@example.com" }).success).toBe(true);
    expect(signUpSchema.safeParse({ ...minor, email: "s@example.com", guardianConsent: false }).success).toBe(false);
    expect(signUpSchema.safeParse({ ...minor, email: "s@example.com", guardianEmail: undefined }).success).toBe(false);
    expect(signUpSchema.safeParse({ ...minor, email: "s@example.com", guardianName: undefined }).success).toBe(false);
  });

  it("blocks a student under 13", () => {
    expect(signUpSchema.safeParse({ ...minor, email: "s@example.com", dateOfBirth: "2020-01-01" }).success).toBe(false);
  });
});
