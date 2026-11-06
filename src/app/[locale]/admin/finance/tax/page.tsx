import { pageMetadata } from "@/lib/seo";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { formatMoney } from "@/lib/format";
import { requireAdmin } from "@/lib/staff";
import { defaultPeriod, isPeriod, loadTaxReport } from "@/lib/tax-report-data";
import { AdminNav, panel, table } from "../../AdminNav";
import { field, label } from "../../styles";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return pageMetadata(params, "/admin/finance/tax", "office", { key: "nav.finance", noindex: true });
}

export default async function TaxPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ period?: string }>;
}) {
  const { locale } = await params;
  const { period: requested } = await searchParams;
  setRequestLocale(locale);
  await requireAdmin();
  const t = await getTranslations("office");
  const period = isPeriod(requested) ? requested : defaultPeriod();
  const report = await loadTaxReport(period);
  const money = (n: number, currency: Parameters<typeof formatMoney>[1]) => formatMoney(n, currency, locale);

  return (
    <main className="mx-auto grid max-w-6xl gap-6 px-4 py-12">
      <AdminNav current="finance" />
      <p className="max-w-[70ch] text-small text-ink-muted">{t("taxHint")}</p>

      <form method="get" className={`${panel} flex flex-wrap items-end gap-3`}>
        <label className={label}>
          {t("taxPeriod")}
          <input type="month" name="period" defaultValue={period} className={field} />
        </label>
        <button className="btn btn-outline w-fit">{t("taxShow")}</button>
        <a href={`/${locale}/admin/finance/tax/export?period=${period}`} className="btn btn-outline w-fit">
          {t("taxExport")}
        </a>
        <a href={`/${locale}/admin/finance/tax/pdf?period=${period}`} className="btn btn-outline w-fit">
          {t("taxExportPdf")}
        </a>
      </form>

      {report.length === 0 ? (
        <p className="text-small text-ink-muted">{t("taxEmpty")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className={table}>
            <thead>
              <tr>
                <th>{t("taxPeriod")}</th>
                <th>Country</th>
                <th>Currency</th>
                <th>{t("taxSalesStandard")}</th>
                <th>{t("taxOutputVat")}</th>
                <th>{t("taxSalesZero")}</th>
                <th>{t("taxCreditNotes")}</th>
                <th>{t("taxDue")}</th>
                <th>{t("taxPlatformFee")}</th>
                <th>{t("taxCorporate")}</th>
                <th>{t("taxInstructor")}</th>
                <th>{t("taxOrders")}</th>
                <th>TRN</th>
              </tr>
            </thead>
            <tbody>
              {report.map((r) => (
                <tr key={`${r.countryCode}-${r.currency}`}>
                  <td className="num">{r.period}</td>
                  <td>{r.countryCode}</td>
                  <td>{r.currency}</td>
                  <td className="num">{money(r.salesNetStandard, r.currency)}</td>
                  <td className="num">{money(r.vatOutput, r.currency)}</td>
                  <td className="num">{money(r.salesNetZero, r.currency)}</td>
                  <td className="num">
                    {money(r.creditNotesNet, r.currency)} / {money(r.creditNotesVat, r.currency)}
                  </td>
                  <td className="num font-semibold">{money(r.netVatDue, r.currency)}</td>
                  <td className="num">{money(r.platformFee, r.currency)}</td>
                  <td className="num">{money(r.corporateTax, r.currency)}</td>
                  <td className="num">{money(r.instructorNet, r.currency)}</td>
                  <td className="num">
                    {r.orders} / {r.refunds}
                  </td>
                  <td className="num" dir="ltr">
                    {r.sellerTrn ?? "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="max-w-[70ch] text-small text-ink-muted">{t("taxOff")}</p>
      <p className="max-w-[70ch] text-small text-ink-muted">{t("taxNote")}</p>
    </main>
  );
}
