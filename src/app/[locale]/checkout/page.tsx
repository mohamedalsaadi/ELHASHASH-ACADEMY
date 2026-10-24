import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Link } from "@/i18n/navigation";
import { activeGateway, priceSkus } from "@/lib/checkout";
import { formatMoney } from "@/lib/format";
import { PricingError } from "@/lib/pricing-engine";
import { PayForm } from "./PayForm";

export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ sku?: string | string[] }>;
}) {
  const { locale } = await params;
  const { sku } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("checkout");
  const skuIds = [sku ?? []].flat();

  const session = await auth();
  if (!session?.user) {
    const back = `/${locale}/checkout?${skuIds.map((s) => `sku=${encodeURIComponent(s)}`).join("&")}`;
    redirect(`/${locale}/signin?next=${encodeURIComponent(back)}`);
  }

  let result;
  try {
    result = skuIds.length ? await priceSkus(skuIds) : null;
  } catch (e) {
    if (!(e instanceof PricingError)) throw e;
    result = null;
  }
  if (!result || result.missing) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16">
        <p className="text-ink-muted">{t("unavailable")}</p>
      </main>
    );
  }

  const { priced, skus } = result;
  const money = (n: number) => formatMoney(n, priced.currency, locale);
  const title = (id: string) => {
    const s = skus.get(id)!;
    const name = s.liveSession ?? s.lesson ?? s.course;
    return `${locale === "ar" ? name.titleAr : name.titleEn} · ${t(`access.${s.accessType}`, { days: s.accessDays ?? 0 })}`;
  };

  return (
    <main className="mx-auto grid max-w-xl gap-6 px-4 py-12">
      <h1 className="font-display text-h1 font-semibold">{t("title")}</h1>
      <section className="grid gap-4 rounded-md border border-hairline bg-surface p-4">
        <ul className="grid gap-2">
          {priced.lines.map((l) => (
            <li key={l.skuId} className="flex justify-between gap-4">
              <span>{title(l.skuId)}</span>
              <span className="num">{money(l.price)}</span>
            </li>
          ))}
        </ul>
        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 border-t border-hairline pt-3">
          <dt className="text-ink-muted">{t("subtotal")}</dt>
          <dd className="num">{money(priced.subtotal)}</dd>
          {priced.discount > 0 && (
            <>
              <dt className="text-up">{t("bundle")}</dt>
              <dd className="num text-up">−{money(priced.discount)}</dd>
            </>
          )}
          <dt className="font-display font-semibold">{t("total")}</dt>
          <dd className="num font-semibold">{money(priced.total)}</dd>
        </dl>
      </section>
      <PayForm skuIds={skuIds} locale={locale} {...activeGateway()} />
      <p className="text-small text-ink-muted">
        {t.rich("agree", {
          terms: (c) => <Link href="/terms" className="text-pen underline">{c}</Link>,
          refund: (c) => <Link href="/refund" className="text-pen underline">{c}</Link>,
        })}
      </p>
    </main>
  );
}
