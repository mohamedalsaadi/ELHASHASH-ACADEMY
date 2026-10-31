import { db } from "@/lib/db";
import { DEFAULT_FINANCE, type FinanceConfig } from "@/lib/finance";

const SINGLETON = "singleton";

/** The one settings row; defaults apply until an admin saves it. */
export async function getFinanceConfig(): Promise<FinanceConfig> {
  const row = await db.platformSetting.findUnique({ where: { id: SINGLETON } });
  if (!row) return { ...DEFAULT_FINANCE };
  return {
    vatEnabled: row.vatEnabled,
    vatRateBp: row.vatRateBp,
    vatTrn: row.vatTrn,
    platformShareBp: row.platformShareBp,
  };
}

export async function saveFinanceConfig(input: FinanceConfig, updatedById: string) {
  await db.platformSetting.upsert({
    where: { id: SINGLETON },
    create: { id: SINGLETON, ...input, updatedById },
    update: { ...input, updatedById },
  });
}

export type BankDetails = {
  bankName: string | null;
  bankAccountName: string | null;
  bankIban: string | null;
  bankInstructionsAr: string | null;
  bankInstructionsEn: string | null;
  bankAutoApprove: boolean;
};

/** The raw settings row, for the admin form that must show saved bank details even before an IBAN exists. */
export function getSettingsRow() {
  return db.platformSetting.findUnique({ where: { id: SINGLETON } });
}

/** Null when no IBAN is configured: transfer is then not offered at all. */
export async function getBankDetails(): Promise<BankDetails | null> {
  const row = await db.platformSetting.findUnique({
    where: { id: SINGLETON },
    select: {
      bankName: true,
      bankAccountName: true,
      bankIban: true,
      bankInstructionsAr: true,
      bankInstructionsEn: true,
      bankAutoApprove: true,
    },
  });
  return row?.bankIban ? row : null;
}

export async function saveBankDetails(input: BankDetails, updatedById: string) {
  await db.platformSetting.upsert({
    where: { id: SINGLETON },
    create: { id: SINGLETON, ...input, updatedById },
    update: { ...input, updatedById },
  });
}
