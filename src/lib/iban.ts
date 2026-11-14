// Bank account numbers for teacher payouts. Checked on entry so the owner never pays a mistyped account.

/** Lengths of the IBANs of the countries Dhirwa works in; any other country is checked by its checksum only. */
const LENGTHS: Record<string, number> = { AE: 23, SA: 24, KW: 30, QA: 29, BH: 22, OM: 23, EG: 29 };

/** Upper case, no spaces or dashes. */
export const normalizeIban = (v: string) => v.replace(/[\s-]/g, "").toUpperCase();

/** ISO 13616: shape, known length for the home countries, and the mod-97 checksum. */
export function isValidIban(input: string): boolean {
  const iban = normalizeIban(input);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  const want = LENGTHS[iban.slice(0, 2)];
  if (want && iban.length !== want) return false;
  const moved = iban.slice(4) + iban.slice(0, 4);
  let rem = 0;
  for (const ch of moved) rem = (rem * (ch >= "A" ? 100 : 10) + (ch >= "A" ? ch.charCodeAt(0) - 55 : Number(ch))) % 97;
  return rem === 1;
}

/** Country code and the last four characters; the rest is hidden. */
export const maskIban = (iban: string) => {
  const n = normalizeIban(iban);
  return n.length <= 6 ? "••••" : `${n.slice(0, 2)}•• •••• ${n.slice(-4)}`;
};
