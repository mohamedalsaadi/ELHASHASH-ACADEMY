import { z } from "zod";

// Egyptian mobile (01xxxxxxxxx) or UAE mobile (05xxxxxxxx), stored as typed.
export const phoneSchema = z.string().trim().regex(/^(01[0125]\d{8}|05\d{8})$/, "invalid_phone");

const passwordSchema = z.string().min(8, "password_too_short").max(128);

// Students sign in with their mobile; staff accounts may use an email instead.
export const signInSchema = z.object({
  login: z.union([phoneSchema, z.email().trim().toLowerCase()]),
  password: passwordSchema,
});

export const signUpSchema = z.object({
  phone: phoneSchema,
  password: passwordSchema,
  name: z.string().trim().min(2).max(80),
  gradeId: z.string().min(1),
});

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
