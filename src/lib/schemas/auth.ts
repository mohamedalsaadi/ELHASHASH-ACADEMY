import { z } from "zod";
import { ageOn, parseBirthDate } from "@/lib/age";

// Local mobile formats of the seven catalog countries, stored as typed:
// Egypt 01[0125]+8; Saudi/UAE 05+8; Kuwait [569]+7; Qatar [3567]+7; Bahrain [36]+7; Oman [79]+7.
// Any other country can sign up with an international number starting +.
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^(01[0125]\d{8}|05\d{8}|[569]\d{7}|[3567]\d{7}|[36]\d{7}|[79]\d{7}|\+[1-9]\d{6,14})$/, "invalid_phone");

/** One rule for every place a password is created. bcrypt ignores bytes past 72, so longer is not safer. */
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72;
export const passwordSchema = z.string().min(PASSWORD_MIN, "password_too_short").max(PASSWORD_MAX);

// Students sign in with their mobile; staff accounts may use an email instead.
// Sign-in checks the credential, not the policy: an old account with a shorter password must still get in.
export const signInSchema = z.object({
  login: z.union([phoneSchema, z.email().trim().toLowerCase()]),
  password: z.string().min(1).max(PASSWORD_MAX),
});

export const signUpSchema = z
  .object({
    type: z.enum(["STUDENT", "PARENT"]).default("STUDENT"),
    email: z.email().trim().toLowerCase(),
    phone: phoneSchema,
    password: passwordSchema,
    name: z.string().trim().min(2).max(80),
    /// Required for a student, absent for a parent.
    gradeId: z.string().optional(),
    /// Required for a student. The action decides whether the account is a minor.
    dateOfBirth: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "invalid_birthdate").optional(),
    /// Required for a minor; the consent link is sent here.
    guardianEmail: z.email().trim().toLowerCase().optional(),
    /// A student joins with a guardian's consent; the model has no birth date, so every STUDENT is a minor.
    guardianName: z.string().trim().min(2).max(80).optional(),
    guardianConsent: z.coerce.boolean().default(false),
  })
  .refine((d) => d.type === "PARENT" || Boolean(d.gradeId), { path: ["gradeId"], message: "invalid_grade" })
  .superRefine((d, ctx) => {
    if (d.type === "PARENT") return;
    const dob = parseBirthDate(d.dateOfBirth);
    if (!dob) {
      ctx.addIssue({ code: "custom", path: ["dateOfBirth"], message: "invalid_birthdate" });
      return;
    }
    const age = ageOn(dob);
    if (age < 13) {
      ctx.addIssue({ code: "custom", path: ["dateOfBirth"], message: "too_young" });
      return;
    }
    if (age < 18 && (!d.guardianConsent || !d.guardianName || !d.guardianEmail)) {
      ctx.addIssue({ code: "custom", path: ["guardianConsent"], message: "guardian_required" });
    }
  });

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;

/** A Google sign-in creates the row; this fills the phone, grade and guardian fields. */
export const completeProfileSchema = z
  .object({
    phone: phoneSchema,
    gradeId: z.string().min(1),
    dateOfBirth: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "invalid_birthdate"),
    guardianName: z.string().trim().min(2).max(80).optional(),
    guardianEmail: z.email().trim().toLowerCase().optional(),
    guardianConsent: z.coerce.boolean().default(false),
  })
  .superRefine((d, ctx) => {
    const dob = parseBirthDate(d.dateOfBirth);
    if (!dob) {
      ctx.addIssue({ code: "custom", path: ["dateOfBirth"], message: "invalid_birthdate" });
      return;
    }
    const age = ageOn(dob);
    if (age < 13) {
      ctx.addIssue({ code: "custom", path: ["dateOfBirth"], message: "too_young" });
      return;
    }
    if (age < 18 && (!d.guardianConsent || !d.guardianName || !d.guardianEmail)) {
      ctx.addIssue({ code: "custom", path: ["guardianConsent"], message: "guardian_required" });
    }
  });
