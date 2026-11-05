import { pageMetadata } from "@/lib/seo";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Link } from "@/i18n/navigation";
import { priceSkus } from "@/lib/checkout";
import { pick } from "@/lib/content";
import { resolveCoupon } from "@/lib/coupon-resolve";
import { activeGateway } from "@/lib/gateway";
import { formatMoney } from "@/lib/format";
import { applyCoupon, PricingError } from "@/lib/pricing-engine";
import { PayForm } from "./PayForm";

type CouponError = "invalid" | "not_started" | "expired" | "used_up" | "used_by_you" | "currency";

const field = "min-h-11 rounded-sm border border-field bg-surface px-3 text-body text-ink";
const applyButton =
  "btn btn-outline";

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return pageMetadata(params, "/checkout", "checkout", { key: "title", noindex: true });
}

export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ sku?: string | string[]; coupon?: string }>;
}) {
  const { locale } = await params;
  const { sku, coupon } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("checkout");
  const skuIds = [sku ?? []].flat();

  const session = await auth();
  const user = session?.user;
  if (!user) {
    const query = new URLSearchParams();
    for (const id of skuIds) query.append("sku", id);
    if (coupon) query.set("coupon", coupon);
    redirect(`/${locale}/signin?next=${encodeURIComponent(`/${locale}/checkout?${query.toString()}`)}`);
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
      <main className="mx-auto grid max-w-xl gap-4 px-4 py-16">
        <h1 className="font-display text-h1 font-semibold">{t("unavailableTitle")}</h1>
        <p className="text-ink-muted">{t("unavailable")}</p>
        <Link href="/courses" className="btn btn-outline w-fit px-4 py-2 text-small">
          {t("backToCourses")}
        </Link>
      </main>
    );
  }

  // Re-resolve the code on every render; the API resolves it again before charging.
  let priced = result.priced;
  let appliedCode: string | null = null;
  let couponError: CouponError | null = null;
  if (coupon) {
    const resolved = await resolveCoupon(coupon, user.id);
    if (!resolved.ok) couponError = resolved.reason;
    else {
      try {
        priced = applyCoupon(priced, resolved.coupon);
        appliedCode = resolved.coupon.code;
      } catch (e) {
        if (e instanceof PricingError && e.message === "coupon_currency") couponError = "currency";
        else throw e;
      }
    }
  }

  // A 100% code needs no gateway (the API settles it without one), so the button still shows.
  const gateway = activeGateway(priced.currency) ?? (priced.total === 0 ? { gateway: "ZIINA" as const, methods: ["CARD" as const] } : null);

  // A parent pays for a linked child; with no child linked yet there is nobody to give the access to.
  const children =
    user.role === "PARENT"
      ? (await db.parentLink.findMany({ where: { parentId: user.id }, select: { student: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" } })).map((l) => l.student)
      : null;
  if (children && children.length === 0) {
    return (
      <main className="mx-auto grid max-w-xl gap-4 px-4 py-16">
        <h1 className="font-display text-h1 font-semibold">{t("title")}</h1>
        <p className="text-ink-muted">{t("noChildren")}</p>
        <Link href="/parent" className="btn btn-primary w-fit">
          {t("linkChild")}
        </Link>
      </main>
    );
  }

  const { skus } = result;
  const money = (n: number) => formatMoney(n, priced.currency, locale);
  const bundle = priced.discount - priced.couponDiscount;
  const title = (id: string) => {
    const s = skus.get(id)!;
    const name = s.liveSession ?? s.lesson ?? s.course;
    return `${pick(locale === "ar", name.titleAr, name.titleEn)} · ${t(`access.${s.accessType}`, { days: s.accessDays ?? 0 })}`;
  };

  return (
    <main className="mx-auto grid max-w-xl gap-6 px-4 py-12">
      <h1 className="font-display text-h1 font-semibold">{t("title")}</h1>
      <section className="card grid gap-4 p-6">
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
          {bundle > 0 && (
            <>
              <dt className="text-up">{t("bundle")}</dt>
              <dd className="num text-up">−{money(bundle)}</dd>
            </>
          )}
          {priced.couponDiscount > 0 && appliedCode && (
            <>
              <dt className="text-up">{t("couponRow", { code: appliedCode })}</dt>
              <dd className="num text-up">−{money(priced.couponDiscount)}</dd>
            </>
          )}
          <dt className="font-display font-semibold">{t("total")}</dt>
          <dd className="num font-semibold">{money(priced.total)}</dd>
        </dl>

        <form method="get" className="flex flex-wrap items-end gap-2 border-t border-hairline pt-4">
          {skuIds.map((id) => (
            <input key={id} type="hidden" name="sku" value={id} />
          ))}
          <label className="grid min-w-40 flex-1 gap-1 text-label text-ink-muted">
            {t("coupon")}
            <input name="coupon" defaultValue={coupon ?? ""} dir="ltr" autoComplete="off" maxLength={40} className={field} />
          </label>
          <button className={applyButton}>{t("apply")}</button>
        </form>
        {couponError && (
          <p role="alert" className="text-small text-down">
            {t(`couponErrors.${couponError}`)}
          </p>
        )}
        {appliedCode && (
          <p role="status" className="text-small text-up">
            {t("couponApplied", { code: appliedCode })}
          </p>
        )}
      </section>
      {gateway ? (
        <PayForm skuIds={skuIds} locale={locale} coupon={appliedCode ?? undefined} learners={children ?? undefined} {...gateway} />
      ) : (
        <p role="status" className="rounded-lg border border-hairline bg-surface shadow-paper p-4 text-small text-ink-muted">
          {t("errors.payments_unavailable")}
        </p>
      )}
      <p className="text-small text-ink-muted">
        {t.rich("agree", {
          terms: (c) => <Link href="/terms" className="text-pen underline">{c}</Link>,
          privacy: (c) => <Link href="/privacy" className="text-pen underline">{c}</Link>,
          refund: (c) => <Link href="/refund" className="text-pen underline">{c}</Link>,
          faq: (c) => <Link href="/faq" className="text-pen underline">{c}</Link>,
        })}
      </p>
    </main>
  );
}
