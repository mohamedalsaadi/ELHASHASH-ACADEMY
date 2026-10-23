import { z } from "zod";

// Egyptian mobile (01xxxxxxxxx) or UAE mobile (05xxxxxxxx), stored as typed.
export const phoneSchema = z.string().trim().regex(/^(01[0125]\d{8}|05\d{8})$/, "invalid_phone");

export const signInSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(8, "password_too_short").max(128),
});

export const signUpSchema = signInSchema.extend({
  name: z.string().trim().min(2).max(80),
  gradeId: z.string().min(1),
});

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
