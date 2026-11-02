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
