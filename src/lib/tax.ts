import { db } from "@/lib/db";
import { getFinanceConfig } from "@/lib/platform-settings";

export type TaxConfig = {
  vatEnabled: boolean;
  vatRateBp: number;
  vatTrn: string | null;
  taxCountryCode: string | null;
};

/**
 * VAT belongs to the market the course is sold in. The global switch is the master; a country is
 * charged only when both it and the master are on. A skill course with no country uses the global
 * profile. This prevents a UAE-registered platform from charging UAE VAT on an Egyptian sale.
 */
export async function taxConfigFor(countryCode: string | null): Promise<TaxConfig> {
  const cfg = await getFinanceConfig();
  if (!cfg.vatEnabled) return { vatEnabled: false, vatRateBp: 0, vatTrn: null, taxCountryCode: countryCode };
  if (!countryCode) return { vatEnabled: true, vatRateBp: cfg.vatRateBp, vatTrn: cfg.vatTrn, taxCountryCode: null };

  const country = await db.country.findUnique({
    where: { code: countryCode },
    select: { vatEnabled: true, vatRateBp: true, vatTrn: true },
  });
  if (!country?.vatEnabled) return { vatEnabled: false, vatRateBp: 0, vatTrn: null, taxCountryCode: countryCode };
  return { vatEnabled: true, vatRateBp: country.vatRateBp, vatTrn: country.vatTrn ?? cfg.vatTrn, taxCountryCode: countryCode };
}

/** VAT on a buyer-paid net total, at the market's rate. */
export function vatFor(net: number, tax: TaxConfig): number {
  return tax.vatEnabled ? Math.round((net * tax.vatRateBp) / 10_000) : 0;
}
