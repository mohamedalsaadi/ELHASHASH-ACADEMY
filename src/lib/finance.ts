/**
 * Money split for one paid order line, in integer minor units.
 *
 * VAT is exclusive: the teacher's price is the net amount and VAT is added on top, so the
 * buyer pays `net + vat`. The platform share is taken from the net, never from the VAT.
 * The teacher receives the remainder, so the parts always sum back to what the buyer paid.
 */
export type FinanceConfig = {
  vatEnabled: boolean;
  /** Basis points: 500 = 5.00%. */
  vatRateBp: number;
  /** Tax registration number, shown on receipts once VAT is live. */
  vatTrn: string | null;
  /** Basis points: 3000 = 30.00%. */
  platformShareBp: number;
  /** Welcome discount for a referred family, in percent. Zero disables referrals. */
  referralWelcomePercentOff: number;
  /** One-time reward for the referrer, in percent. */
  referralRewardPercentOff: number;
  /** A contractual contribution from the teacher's share toward corporate tax. Not a VAT line. */
  corporateTaxEnabled: boolean;
  /** Basis points: 900 = 9.00%. */
  corporateTaxBp: number;
  /** Seller identity printed on documents. Null until the owner supplies it. */
  sellerLegalName: string | null;
  sellerAddress: string | null;
  sellerLicenceNo: string | null;
};

export const DEFAULT_FINANCE: FinanceConfig = {
  vatEnabled: false,
  vatRateBp: 500,
  vatTrn: null,
  platformShareBp: 3000,
  referralWelcomePercentOff: 0,
  referralRewardPercentOff: 0,
  corporateTaxEnabled: false,
  corporateTaxBp: 900,
  sellerLegalName: null,
  sellerAddress: null,
  sellerLicenceNo: null,
};

export type LineSplit = {
  /** What the buyer pays: net - platformDiscount + vat. */
  gross: number;
  vat: number;
  /** Buyer-paid net, gross - vat. */
  net: number;
  /** The platform's take after funding `platformDiscount`; never negative. */
  platformFee: number;
  /** The teacher's share, calculated before any platform-funded discount. */
  instructorNet: number;
  /** The teacher's contractual corporate-tax contribution. */
  corporateTax: number;
  corporateTaxBp: number;
  /** What the teacher is actually paid: instructorNet - corporateTax. */
  instructorPayout: number;
  platformDiscount: number;
  vatRateBp: number;
  platformShareBp: number;
};

/**
 * `net` is the line price before a platform-funded discount. Teacher pay is calculated from it, the
 * platform funds the discount out of its own share, and VAT is charged on what the buyer actually pays.
 */
export function splitLine(net: number, cfg: FinanceConfig, platformDiscount = 0): LineSplit {
  const platformShare = Math.round((net * cfg.platformShareBp) / 10_000);
  const discount = Math.min(Math.max(0, platformDiscount), platformShare);
  const paidNet = net - discount;
  const vatRateBp = cfg.vatEnabled ? cfg.vatRateBp : 0;
  const vat = Math.round((paidNet * vatRateBp) / 10_000);
  const instructorNet = net - platformShare;
  const corporateTaxBp = cfg.corporateTaxEnabled ? cfg.corporateTaxBp : 0;
  const corporateTax = Math.round((instructorNet * corporateTaxBp) / 10_000);
  return {
    gross: paidNet + vat,
    vat,
    net: paidNet,
    platformFee: platformShare - discount,
    instructorNet,
    corporateTax,
    corporateTaxBp,
    instructorPayout: instructorNet - corporateTax,
    platformDiscount: discount,
    vatRateBp,
    platformShareBp: cfg.platformShareBp,
  };
}

/** VAT owed on a net total; zero while the flag is off. */
export function vatOn(net: number, cfg: FinanceConfig): number {
  return cfg.vatEnabled ? Math.round((net * cfg.vatRateBp) / 10_000) : 0;
}
