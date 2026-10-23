import { z } from "zod";

export const checkoutSchema = z.object({
  skuIds: z.array(z.string().min(1)).min(1).max(10),
  method: z.enum(["CARD", "WALLET", "KIOSK", "VALU"]),
  locale: z.enum(["ar", "en"]).default("ar"),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
