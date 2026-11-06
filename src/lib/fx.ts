import { minorPerUnit } from "./format";
import type { Currency } from "./pricing-engine";

/** Currencies that can use an owner-entered suggestion rate. AED is the charge currency, so it is excluded. */
export const FX_CURRENCIES: Currency[] = ["EGP", "SAR", "KWD", "QAR", "BHD", "OMR"];

/**
 * AED minor units for a local amount at `aedPerUnit`. This only pre-fills the admin's AED price
 * field. The saved AED price is what the gateway charges; no checkout ever calls this.
 */
export function aedFromRate(localMinor: number, currency: Currency, aedPerUnit: number): number {
  return Math.round((localMinor / minorPerUnit(currency)) * aedPerUnit * 100);
}
