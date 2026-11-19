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
    referralWelcomePercentOff: row.referralWelcomePercentOff,
    referralRewardPercentOff: row.referralRewardPercentOff,
    corporateTaxEnabled: row.corporateTaxEnabled,
    corporateTaxBp: row.corporateTaxBp,
    sellerLegalName: row.sellerLegalName,
    sellerAddress: row.sellerAddress,
    sellerLicenceNo: row.sellerLicenceNo,
  };
}

/** The home-page invite-a-friend popup switch. A field of its own, so saving it never touches the finance rates. */
export async function saveReferralPopup(enabled: boolean, updatedById: string) {
  await db.platformSetting.upsert({
    where: { id: SINGLETON },
    create: { id: SINGLETON, referralPopupEnabled: enabled, updatedById },
    update: { referralPopupEnabled: enabled, updatedById },
  });
}

export async function saveFinanceConfig(input: FinanceConfig, updatedById: string) {
  await db.platformSetting.upsert({
    where: { id: SINGLETON },
    create: { id: SINGLETON, ...input, updatedById },
    update: { ...input, updatedById },
  });
}
