import { minorPerUnit } from "./format";
import type { Currency } from "./pricing-engine";

export type Method = "CARD" | "WALLET" | "KIOSK" | "VALU";
export type GatewayName = "PAYMOB" | "ZIINA" | "STRIPE";

/** Vercel sets VERCEL_ENV; locally we fall back to NODE_ENV. Tests are never production. */
function isProduction(): boolean {
  return process.env.VERCEL_ENV === "production" || (process.env.VERCEL_ENV === undefined && process.env.NODE_ENV === "production");
}

/**
 * Ziina's `test` intent needs no payment method — it "completes" without money. So it may only be
 * used off production, and a production deployment carrying the flag refuses Ziina entirely.
 */
export function ziinaTestMode(): boolean {
  return process.env.ZIINA_TEST === "1" && !isProduction();
}

export function ziinaTestModeInProduction(): boolean {
  return process.env.ZIINA_TEST === "1" && isProduction();
}

/** A test Stripe key in production would take fake "payments"; checkout refuses instead. */
export function stripeTestKeyInProduction(): boolean {
  return isProduction() && (process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_test_");
}

// Decided by the cart's currency: Paymob settles EGP; Ziina settles AED while the academy has no
// trade licence; every other currency, and anything unconfigured, pays by card on Stripe.
export function activeGateway(currency: Currency): { gateway: GatewayName; methods: Method[] } {
  if (currency === "EGP" && process.env.PAYMOB_SECRET_KEY) {
    return { gateway: "PAYMOB", methods: ["CARD", "WALLET", "KIOSK", "VALU"] };
  }
  if (
    currency === "AED" &&
    process.env.ZIINA_API_KEY &&
    process.env.ZIINA_ENABLED !== "0" &&
    !ziinaTestModeInProduction()
  ) {
    return { gateway: "ZIINA", methods: ["CARD"] };
  }
  return { gateway: "STRIPE", methods: ["CARD"] };
}

/** Stripe takes 3-decimal currencies only in multiples of 10 fils; prices are saved that way, so anything else is a bug. */
export function stripeUnitAmount(amount: number, currency: Currency): number {
  if (minorPerUnit(currency) === 1000 && amount % 10 !== 0) throw new Error(`${currency} amount ${amount} is not a multiple of 10`);
  return amount;
}
