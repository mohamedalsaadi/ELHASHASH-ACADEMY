import { pageMetadata } from "@/lib/seo";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { FX_CURRENCIES } from "@/lib/fx";
import { getFinanceConfig } from "@/lib/platform-settings";
import { requireAdmin } from "@/lib/staff";
import { saveFinanceSettings, saveFxRates } from "../actions";
import { AdminNav, panel } from "../AdminNav";
import { field, label } from "../styles";
import { SaveButton } from "../ui";
import { MailTest } from "./MailTest";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return pageMetadata(params, "/admin/settings", "office", { key: "nav.settings", noindex: true });
}

export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdmin();
  const t = await getTranslations("office");
  const cfg = await getFinanceConfig();
  const rates = await db.fxRate.findMany({ select: { currency: true, aedPerUnit: true } });
  const rateMap = new Map(rates.map((r) => [r.currency, Number(r.aedPerUnit)]));

  return (
    <main className="mx-auto grid max-w-3xl gap-6 px-4 py-12">
      <AdminNav current="settings" />

      <form action={saveFinanceSettings} className={panel}>
        <h2 className="font-display text-h3 font-semibold">{t("finance")}</h2>
        <p className="text-small text-ink-muted">{t("financeHint")}</p>

        <label className={label}>
          {t("platformShare")}
          <input
            name="platformShare"
            type="number"
            min="0"
            max="100"
            step="0.01"
            defaultValue={cfg.platformShareBp / 100}
            required
            dir="ltr"
            className={`${field} num w-32`}
          />
        </label>

        <label className="flex min-h-11 items-center gap-2 text-small">
          <input type="checkbox" name="vatEnabled" defaultChecked={cfg.vatEnabled} className="size-4" />
          {t("vatEnabled")}
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className={label}>
            {t("vatRate")}
            <input
              name="vatRate"
              type="number"
              min="0"
              max="50"
              step="0.01"
              defaultValue={cfg.vatRateBp / 100}
              required
              dir="ltr"
              className={`${field} num w-32`}
            />
          </label>
          <label className={label}>
            {t("vatTrn")}
            <input name="vatTrn" defaultValue={cfg.vatTrn ?? ""} maxLength={40} dir="ltr" className={field} />
          </label>
        </div>

        <p className="max-w-[65ch] text-small text-ink-muted">{t("vatHint")}</p>

        <fieldset className="grid gap-3 border-t border-hairline pt-4">
          <legend className="text-small font-semibold">{t("referrals")}</legend>
          <p className="max-w-[65ch] text-small text-ink-muted">{t("referralsHint")}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={label}>
              {t("referralWelcome")}
              <input
                name="referralWelcome"
                type="number"
                min="0"
                max="100"
                step="1"
                defaultValue={cfg.referralWelcomePercentOff}
                required
                dir="ltr"
                className={`${field} num w-32`}
              />
            </label>
            <label className={label}>
              {t("referralReward")}
              <input
                name="referralReward"
                type="number"
                min="0"
                max="100"
                step="1"
                defaultValue={cfg.referralRewardPercentOff}
                required
                dir="ltr"
                className={`${field} num w-32`}
              />
            </label>
          </div>
        </fieldset>

        <fieldset className="grid gap-3 border-t border-hairline pt-4">
          <legend className="text-small font-semibold">{t("corporateTax")}</legend>
          <p className="max-w-[65ch] text-small text-ink-muted">{t("corporateTaxHint")}</p>
          <label className="flex min-h-11 items-center gap-2 text-small">
            <input type="checkbox" name="corporateTaxEnabled" defaultChecked={cfg.corporateTaxEnabled} className="size-4" />
            {t("corporateTaxEnabled")}
          </label>
          <label className={label}>
            {t("corporateTaxRate")}
            <input
              name="corporateTax"
              type="number"
              min="0"
              max="50"
              step="0.01"
              defaultValue={cfg.corporateTaxBp / 100}
              required
              dir="ltr"
              className={`${field} num w-32`}
            />
          </label>
        </fieldset>

        <fieldset className="grid gap-3 border-t border-hairline pt-4">
          <legend className="text-small font-semibold">{t("sellerTitle")}</legend>
          <p className="max-w-[65ch] text-small text-ink-muted">{t("sellerHint")}</p>
          <label className={label}>
            {t("sellerLegalName")}
            <input name="sellerLegalName" defaultValue={cfg.sellerLegalName ?? ""} maxLength={200} className={field} />
          </label>
          <label className={label}>
            {t("sellerAddress")}
            <input name="sellerAddress" defaultValue={cfg.sellerAddress ?? ""} maxLength={500} className={field} />
          </label>
          <label className={label}>
            {t("sellerLicence")}
            <input name="sellerLicenceNo" defaultValue={cfg.sellerLicenceNo ?? ""} maxLength={80} dir="ltr" className={field} />
          </label>
        </fieldset>

        <p className="max-w-[65ch] text-small text-ink-muted">{t("financeHistoryHint")}</p>

        <div>
          <SaveButton />
        </div>
      </form>

      <div className={panel}>
        <MailTest title={t("mailTest")} hint={t("mailTestHint")} button={t("mailTestButton")} />
      </div>

      <form action={saveFxRates} className={panel}>
        <h2 className="font-display text-h3 font-semibold">{t("fxTitle")}</h2>
        <p className="max-w-[65ch] text-small text-ink-muted">{t("fxHint")}</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {FX_CURRENCIES.map((currency) => (
            <label key={currency} className={label}>
              {currency} → AED
              <input
                name={`rate_${currency}`}
                type="number"
                min="0"
                step="0.000001"
                defaultValue={rateMap.get(currency) ?? ""}
                dir="ltr"
                className={`${field} num`}
              />
            </label>
          ))}
        </div>
        <div>
          <SaveButton />
        </div>
      </form>
    </main>
  );
}
