import { pageMetadata } from "@/lib/seo";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getFinanceConfig } from "@/lib/platform-settings";
import { requireAdmin } from "@/lib/staff";
import { saveFinanceSettings } from "../actions";
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

        <p className="max-w-[65ch] text-small text-ink-muted">{t("financeHistoryHint")}</p>

        <div>
          <SaveButton />
        </div>
      </form>

      <div className={panel}>
        <MailTest title={t("mailTest")} hint={t("mailTestHint")} button={t("mailTestButton")} />
      </div>
    </main>
  );
}
