import { z } from "zod";
import { phoneSchema } from "./auth";

export const checkoutSchema = z.object({
  skuIds: z.array(z.string().min(1)).min(1).max(10),
  method: z.enum(["CARD", "WALLET", "KIOSK", "VALU"]),
  locale: z.enum(["ar", "en"]).default("ar"),
  coupon: z.string().trim().max(40).optional(),
  /** A parent buying for a linked child. Checked against ParentLink on the server. */
  forStudentId: z.string().min(1).max(40).optional(),
  /** A parent buying for a registered student without a link, by the phone the student signed up with. */
  forStudentPhone: phoneSchema.optional(),
  /** The buyer's declaration that they are the student's parent or guardian. Required with forStudentPhone. */
  guardianAttestation: z.boolean().optional(),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
