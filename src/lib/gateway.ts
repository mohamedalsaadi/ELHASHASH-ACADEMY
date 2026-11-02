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

export type ActiveGateway = { gateway: GatewayName; methods: Method[] };

// Ziina is the only way to pay: it settles AED. Stripe and Paymob stay coded but hidden until the
// owner turns them on with STRIPE_ENABLED=1 / PAYMOB_ENABLED=1. Null means nothing can take this currency.
export function activeGateway(currency: Currency): ActiveGateway | null {
  if (
    currency === "AED" &&
    process.env.ZIINA_API_KEY &&
    process.env.ZIINA_ENABLED !== "0" &&
    !ziinaTestModeInProduction()
  ) {
    return { gateway: "ZIINA", methods: ["CARD"] };
  }
  if (currency === "EGP" && process.env.PAYMOB_SECRET_KEY && process.env.PAYMOB_ENABLED === "1") {
    return { gateway: "PAYMOB", methods: ["CARD", "WALLET", "KIOSK", "VALU"] };
  }
  if (process.env.STRIPE_ENABLED === "1") return { gateway: "STRIPE", methods: ["CARD"] };
  return null;
}

/** Stripe takes 3-decimal currencies only in multiples of 10 fils; prices are saved that way, so anything else is a bug. */
export function stripeUnitAmount(amount: number, currency: Currency): number {
  if (minorPerUnit(currency) === 1000 && amount % 10 !== 0) throw new Error(`${currency} amount ${amount} is not a multiple of 10`);
  return amount;
}
