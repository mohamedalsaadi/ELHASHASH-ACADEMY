import { z } from "zod";
import { phoneSchema } from "./auth";

/** A teacher registering themselves. Nothing is created until the owner approves. */
export const teacherApplicationInput = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.email().trim().toLowerCase(),
  phone: phoneSchema,
  password: z.string().min(8, "password_too_short").max(128),
  bio: z.string().trim().max(1000).default(""),
  subjectsNote: z.string().trim().min(2).max(500),
  /** The countries of the subjects they intend to teach. */
  countryIds: z.array(z.string().min(1)).min(1).max(20),
  locale: z.enum(["ar", "en"]).default("ar"),
});

export type TeacherApplicationInput = z.infer<typeof teacherApplicationInput>;
