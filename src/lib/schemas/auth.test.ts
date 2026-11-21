import { describe, expect, it } from "vitest";
import { PASSWORD_MAX, PASSWORD_MIN, completeProfileSchema, otpFinishSchema, passwordSchema, signInSchema, signUpSchema } from "./auth";
import { teacherApplicationInput } from "./teacher-application";

const eight = "12345678";
const seven = "1234567";

describe("one password rule", () => {
  it("accepts 8 characters and refuses 7 everywhere a password is created", () => {
    expect(passwordSchema.safeParse(eight).success).toBe(true);
    expect(passwordSchema.safeParse(seven).success).toBe(false);

    const student = signUpSchema.safeParse({
      email: "a@example.com",
      phone: "0501234567",
      password: seven,
      name: "Mona Ali",
      gradeId: "g1", countryId: "c1",
      guardianName: "Guardian",
      guardianConsent: true,
      acceptTerms: true,
    });
    expect(student.success).toBe(false);

    expect(
      teacherApplicationInput.safeParse({
        name: "Mona Ali",
        email: "a@example.com",
        phone: "0501234567",
        password: seven,
        subjectsNote: "Physics",
        countryIds: ["c1"],
      }).success,
    ).toBe(false);
  });

  it("refuses a password past bcrypt's 72-byte limit", () => {
    expect(passwordSchema.safeParse("a".repeat(PASSWORD_MAX)).success).toBe(true);
    expect(passwordSchema.safeParse("a".repeat(PASSWORD_MAX + 1)).success).toBe(false);
  });

  it("signs in an account whose password is shorter than the current minimum", () => {
    // Sign-in checks the credential, not the policy: an older account must not be locked out.
    expect(signInSchema.safeParse({ login: "0501234567", password: "old-password" }).success).toBe(true);
    expect(signInSchema.safeParse({ login: "0501234567", password: "" }).success).toBe(false);
    expect(signInSchema.safeParse({ login: "0501234567", password: "x".repeat(500) }).success).toBe(false);
  });

  it("keeps the minimum at 8 so the copy, the browser and the server agree", () => {
    expect(PASSWORD_MIN).toBe(8);
  });
});

describe("finishing a Google account", () => {
  // Half a year past the birthday, so the rounded age is exactly the number of years asked for.
  const yearsAgo = (n: number) => {
    const d = new Date();
    d.setUTCFullYear(d.getUTCFullYear() - n);
    d.setUTCMonth(d.getUTCMonth() - 6);
    return d.toISOString().slice(0, 10);
  };
  const first = completeProfileSchema({ grade: true, dob: true, phone: false });
  const pay = completeProfileSchema({ grade: false, dob: false, phone: true });
  const guardian = { guardianName: "Guardian", guardianPhone: "+971509999999", guardianConsent: true };

  it("asks a first sign-in only for grade (with its country) and birth date, not the phone", () => {
    expect(first.safeParse({ gradeId: "g1", countryId: "c1", dateOfBirth: yearsAgo(16) }).success).toBe(true);
    expect(first.safeParse({ countryId: "c1", dateOfBirth: yearsAgo(16) }).success).toBe(false);
    expect(first.safeParse({ gradeId: "g1", dateOfBirth: yearsAgo(16) }).success).toBe(false);
    expect(first.safeParse({ gradeId: "g1", countryId: "c1" }).success).toBe(false);
  });

  it("asks at checkout only for the phone, and refuses one the app would not accept", () => {
    expect(pay.safeParse({ phone: "0501234567" }).success).toBe(true);
    expect(pay.safeParse({ phone: "1234" }).success).toBe(false);
    expect(pay.safeParse({}).success).toBe(false);
  });

  it("ignores a field the student is not being asked for", () => {
    const r = pay.safeParse({ phone: "0501234567", gradeId: "", dateOfBirth: "not a date" });
    expect(r.success).toBe(true);
    expect(r.success && r.data.gradeId).toBeUndefined();
    expect(r.success && r.data.dateOfBirth).toBeUndefined();
  });

  it("refuses a minor under 13 with no guardian consent and accepts one with it", () => {
    expect(first.safeParse({ gradeId: "g1", countryId: "c1", dateOfBirth: yearsAgo(10) }).success).toBe(false);
    expect(first.safeParse({ gradeId: "g1", countryId: "c1", dateOfBirth: yearsAgo(10), ...guardian }).success).toBe(true);
  });

  it("lets a student of 13 or more finish with no guardian, even when the browser sends the empty boxes", () => {
    expect(first.safeParse({ gradeId: "g1", countryId: "c1", dateOfBirth: yearsAgo(14) }).success).toBe(true);
    // The form posts the guardian inputs, empty when left alone; "" must read as absent, not as a too-short name.
    const blank = { gradeId: "g1", countryId: "c1", dateOfBirth: yearsAgo(17), guardianName: "", guardianPhone: "", guardianEmail: "" };
    expect(first.safeParse(blank).success).toBe(true);
    expect(signUpSchema.safeParse({ ...blank, phone: "0501234567", acceptTerms: true, email: "a@example.com", password: "12345678", name: "Mona Ali" }).success).toBe(true);
    expect(otpFinishSchema.safeParse({ type: "STUDENT", name: "Mona Ali", gradeId: "g1", countryId: "c1", dateOfBirth: yearsAgo(17), acceptTerms: true, guardianName: "" }).success).toBe(true);
  });
});

describe("the phone sign-up finish step", () => {
  const base = { type: "STUDENT" as const, name: "طالب", gradeId: "g1", countryId: "c1", dateOfBirth: "1990-01-01", acceptTerms: true };
  it("needs no email and no password: the phone is the sign-in", () => {
    expect(otpFinishSchema.safeParse(base).success).toBe(true);
    expect(otpFinishSchema.safeParse({ ...base, email: "" }).success).toBe(true);
  });
  it("still needs the terms, a grade for a student, and a guardian for a minor", () => {
    expect(otpFinishSchema.safeParse({ ...base, acceptTerms: false }).success).toBe(false);
    expect(otpFinishSchema.safeParse({ ...base, gradeId: undefined }).success).toBe(false);
    expect(otpFinishSchema.safeParse({ ...base, countryId: undefined }).success).toBe(false);
    expect(otpFinishSchema.safeParse({ ...base, dateOfBirth: "2018-01-01" }).success).toBe(false);
    expect(otpFinishSchema.safeParse({ type: "PARENT", name: "ولي", acceptTerms: true }).success).toBe(true);
  });
});
