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
};

export const DEFAULT_FINANCE: FinanceConfig = {
  vatEnabled: false,
  vatRateBp: 500,
  vatTrn: null,
  platformShareBp: 3000,
};

export type LineSplit = {
  /** What the buyer pays: net + vat. */
  gross: number;
  vat: number;
  net: number;
  platformFee: number;
  instructorNet: number;
  vatRateBp: number;
  platformShareBp: number;
};

export function splitLine(net: number, cfg: FinanceConfig): LineSplit {
  const vatRateBp = cfg.vatEnabled ? cfg.vatRateBp : 0;
  const vat = Math.round((net * vatRateBp) / 10_000);
  const platformFee = Math.round((net * cfg.platformShareBp) / 10_000);
  return {
    gross: net + vat,
    vat,
    net,
    platformFee,
    instructorNet: net - platformFee,
    vatRateBp,
    platformShareBp: cfg.platformShareBp,
  };
}

/** VAT owed on a net total; zero while the flag is off. */
export function vatOn(net: number, cfg: FinanceConfig): number {
  return cfg.vatEnabled ? Math.round((net * cfg.vatRateBp) / 10_000) : 0;
}
