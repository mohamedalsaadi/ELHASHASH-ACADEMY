import { describe, expect, it } from "vitest";
import { PASSWORD_MAX, PASSWORD_MIN, completeProfileSchema, passwordSchema, signInSchema, signUpSchema } from "./auth";
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
      gradeId: "g1",
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
  const base = { phone: "0501234567", gradeId: "g1", guardianName: "Guardian", guardianEmail: "g@example.com", guardianConsent: true, acceptTerms: true };

  it("refuses to finish without the terms tick", () => {
    expect(completeProfileSchema.safeParse({ ...base, dateOfBirth: yearsAgo(20) }).success).toBe(true);
    expect(completeProfileSchema.safeParse({ ...base, dateOfBirth: yearsAgo(20), acceptTerms: undefined }).success).toBe(false);
  });

  it("lets an adult finish with no guardian details", () => {
    expect(completeProfileSchema.safeParse({ phone: "0501234567", gradeId: "g1", dateOfBirth: yearsAgo(20), acceptTerms: true }).success).toBe(true);
  });

  it("refuses a minor with no guardian consent and accepts one with it", () => {
    expect(completeProfileSchema.safeParse({ phone: "0501234567", gradeId: "g1", dateOfBirth: yearsAgo(16), acceptTerms: true }).success).toBe(false);
    expect(completeProfileSchema.safeParse({ ...base, dateOfBirth: yearsAgo(16) }).success).toBe(true);
  });

  it("refuses a student under 13", () => {
    expect(completeProfileSchema.safeParse({ ...base, dateOfBirth: yearsAgo(12) }).success).toBe(false);
  });

  it("refuses a phone the rest of the app would not accept", () => {
    expect(completeProfileSchema.safeParse({ ...base, phone: "1234", dateOfBirth: yearsAgo(16) }).success).toBe(false);
  });
});
