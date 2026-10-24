import { minorPerUnit } from "./format";
import type { Currency } from "./pricing-engine";

export type Method = "CARD" | "WALLET" | "KIOSK" | "VALU";

// Decided by the cart's currency: Paymob Egypt only settles EGP (wallets, kiosk cash, valU) and is used when its keys are set;
// every other currency, and EGP without Paymob, pays by card on Stripe.
export function activeGateway(currency: Currency): { gateway: "PAYMOB" | "STRIPE"; methods: Method[] } {
  if (currency === "EGP" && process.env.PAYMOB_SECRET_KEY) return { gateway: "PAYMOB", methods: ["CARD", "WALLET", "KIOSK", "VALU"] };
  return { gateway: "STRIPE", methods: ["CARD"] };
}

/** Stripe takes 3-decimal currencies only in multiples of 10 fils; prices are saved that way, so anything else is a bug. */
export function stripeUnitAmount(amount: number, currency: Currency): number {
  if (minorPerUnit(currency) === 1000 && amount % 10 !== 0) throw new Error(`${currency} amount ${amount} is not a multiple of 10`);
  return amount;
}
