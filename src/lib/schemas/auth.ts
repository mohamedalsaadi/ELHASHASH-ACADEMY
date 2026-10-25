import { z } from "zod";

// Local mobile formats of the seven catalog countries, stored as typed:
// Egypt 01[0125]+8; Saudi/UAE 05+8; Kuwait [569]+7; Qatar [3567]+7; Bahrain [36]+7; Oman [79]+7.
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^(01[0125]\d{8}|05\d{8}|[569]\d{7}|[3567]\d{7}|[36]\d{7}|[79]\d{7})$/, "invalid_phone");

const passwordSchema = z.string().min(8, "password_too_short").max(128);

// Students sign in with their mobile; staff accounts may use an email instead.
export const signInSchema = z.object({
  login: z.union([phoneSchema, z.email().trim().toLowerCase()]),
  password: passwordSchema,
});

export const signUpSchema = z.object({
  email: z.email().trim().toLowerCase(),
  phone: phoneSchema,
  password: passwordSchema,
  name: z.string().trim().min(2).max(80),
  gradeId: z.string().min(1),
});

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
