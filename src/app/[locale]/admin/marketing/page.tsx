import { pageMetadata } from "@/lib/seo";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { EmptyState } from "@/components/brand/Mark";
import { toDayInput } from "@/lib/admin-input";
import { db } from "@/lib/db";
import { formatMoney, minorPerUnit } from "@/lib/format";
import { requireAdmin } from "@/lib/staff";
import { deleteCoupon, deletePromotion, saveCoupon, savePromotion } from "../actions";
import { AdminNav, panel, table } from "../AdminNav";
import { field, label } from "../styles";
import { DeleteButton, SaveButton } from "../ui";

export const dynamic = "force-dynamic";

const check = "flex min-h-11 items-center gap-2 text-small text-ink-muted";
const CURRENCIES = ["EGP", "SAR", "AED", "KWD", "QAR", "BHD", "OMR"] as const;

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return pageMetadata(params, "/admin/marketing", "office", { key: "nav.marketing", noindex: true });
}

export default async function MarketingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdmin();
  const t = await getTranslations("admin");

  const [promotions, coupons, referrals] = await Promise.all([
    db.promotion.findMany({ orderBy: [{ order: "asc" }, { createdAt: "desc" }] }),
    db.coupon.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { orders: { where: { status: "PAID" } } } } },
    }),
    db.referral.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        createdAt: true,
        status: true,
        discount: true,
        currency: true,
        rewardedAt: true,
        referrer: { select: { name: true, phone: true } },
        referredUser: { select: { name: true, phone: true } },
        code: { select: { code: true } },
        rewardCoupon: { select: { code: true } },
      },
    }),
  ]);
  const date = new Intl.DateTimeFormat(locale === "ar" ? "ar-EG-u-nu-latn" : "en-GB", { dateStyle: "medium", timeZone: "UTC" });

  const promoFields = (p?: (typeof promotions)[number]) => (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={label}>
          {t("titleAr")}
          <input name="titleAr" required maxLength={120} dir="rtl" defaultValue={p?.titleAr} className={field} />
        </label>
        <label className={label}>
          {t("titleEn")}
          <input name="titleEn" required maxLength={120} dir="ltr" defaultValue={p?.titleEn} className={field} />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={label}>
          {t("promoBodyAr")}
          <textarea name="bodyAr" maxLength={400} rows={2} dir="rtl" defaultValue={p?.bodyAr ?? ""} className={`${field} py-2`} />
        </label>
        <label className={label}>
          {t("promoBodyEn")}
          <textarea name="bodyEn" maxLength={400} rows={2} dir="ltr" defaultValue={p?.bodyEn ?? ""} className={`${field} py-2`} />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <label className={label}>
          {t("promoPlacement")}
          <select name="placement" defaultValue={p?.placement ?? "BAR"} className={field}>
            <option value="BAR">{t("promoPlacements.BAR")}</option>
            <option value="CARD">{t("promoPlacements.CARD")}</option>
          </select>
        </label>
        <label className={label}>
          {t("promoHref")}
          <input name="href" maxLength={500} dir="ltr" defaultValue={p?.href ?? ""} placeholder="/courses" className={field} />
        </label>
        <label className={label}>
          {t("startsAt")}
          <input name="startsAt" type="date" defaultValue={toDayInput(p?.startsAt ?? null)} className={field} />
        </label>
        <label className={label}>
          {t("endsAt")}
          <input name="endsAt" type="date" defaultValue={toDayInput(p?.endsAt ?? null)} className={field} />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={label}>
          {t("promoOrder")}
          <input name="order" type="number" min="0" max="999" step="1" defaultValue={p?.order ?? 0} dir="ltr" className={`${field} num`} />
        </label>
        <label className={check}>
          <input type="checkbox" name="active" defaultChecked={p?.active ?? true} className="size-4" />
          {t("promoActive")}
        </label>
      </div>
    </>
  );

  const couponFields = (c?: (typeof coupons)[number]) => (
    <>
      <div className="grid gap-3 sm:grid-cols-4">
        <label className={label}>
          {t("couponCode")}
          <input name="code" required minLength={3} maxLength={32} pattern="[A-Za-z0-9_-]{3,32}" dir="ltr" defaultValue={c?.code} className={field} />
        </label>
        <label className={label}>
          {t("couponPercent")}
          <input name="percentOff" type="number" min="1" max="100" step="1" defaultValue={c?.percentOff ?? ""} dir="ltr" className={`${field} num`} />
        </label>
        <label className={label}>
          {t("couponAmount")}
          <input
            name="amountOff"
            type="number"
            min="0"
            step="0.001"
            defaultValue={c?.amountOff != null ? c.amountOff / minorPerUnit(c.currency ?? "EGP") : ""}
            dir="ltr"
            className={`${field} num`}
          />
        </label>
        <label className={label}>
          {t("couponCurrency")}
          <select name="currency" defaultValue={c?.currency ?? "EGP"} className={field}>
            {CURRENCIES.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <label className={label}>
          {t("startsAt")}
          <input name="startsAt" type="date" defaultValue={toDayInput(c?.startsAt ?? null)} className={field} />
        </label>
        <label className={label}>
          {t("endsAt")}
          <input name="endsAt" type="date" defaultValue={toDayInput(c?.endsAt ?? null)} className={field} />
        </label>
        <label className={label}>
          {t("couponMax")}
          <input name="maxRedemptions" type="number" min="1" max="100000" step="1" defaultValue={c?.maxRedemptions ?? ""} dir="ltr" className={`${field} num`} />
        </label>
        <label className={label}>
          {t("couponPerUser")}
          <input name="perUser" type="number" min="1" max="100" step="1" defaultValue={c?.perUser ?? 1} dir="ltr" className={`${field} num`} />
        </label>
      </div>
      <label className={check}>
        <input type="checkbox" name="active" defaultChecked={c?.active ?? true} className="size-4" />
        {t("couponActive")}
      </label>
    </>
  );

  return (
    <main className="mx-auto grid max-w-4xl gap-12 px-4 py-12">
      <AdminNav current="marketing" />

      <section className="grid gap-4">
        <div className="grid gap-1">
          <h2 className="font-display text-h2 font-semibold">{t("promotionsTitle")}</h2>
          <p className="text-small text-ink-muted">{t("promotionsHint")}</p>
        </div>
        {promotions.map((p) => (
          <form key={p.id} action={savePromotion} className={panel}>
            <input type="hidden" name="id" value={p.id} />
            {promoFields(p)}
            <div className="flex flex-wrap gap-3">
              <SaveButton />
              <DeleteButton action={deletePromotion} confirmText={t("confirmDeletePromo")} />
            </div>
          </form>
        ))}
        {promotions.length === 0 && (
          <EmptyState>
            <p className="text-ink-muted">{t("noPromotions")}</p>
          </EmptyState>
        )}
        <form action={savePromotion} className={panel}>
          <h3 className="font-display text-h3 font-semibold">{t("addPromotion")}</h3>
          {promoFields()}
          <div>
            <SaveButton>{t("addPromotion")}</SaveButton>
          </div>
        </form>
      </section>

      <section className="grid gap-4">
        <div className="grid gap-1">
          <h2 className="font-display text-h2 font-semibold">{t("couponsTitle")}</h2>
          <p className="text-small text-ink-muted">{t("couponsHint")}</p>
        </div>
        {coupons.map((c) => (
          <form key={c.id} action={saveCoupon} className={panel}>
            <input type="hidden" name="id" value={c.id} />
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-display font-semibold" dir="ltr">
                {c.code}
              </span>
              <span className="text-label text-ink-muted">
                {t("couponUsed", { count: c._count.orders })}
                {c.maxRedemptions != null ? ` / ${c.maxRedemptions}` : ""}
              </span>
            </div>
            {couponFields(c)}
            <div className="flex flex-wrap gap-3">
              <SaveButton />
              <DeleteButton action={deleteCoupon} confirmText={t("confirmDeleteCoupon")} />
            </div>
          </form>
        ))}
        {coupons.length === 0 && (
          <EmptyState>
            <p className="text-ink-muted">{t("noCoupons")}</p>
          </EmptyState>
        )}
        <form action={saveCoupon} className={panel}>
          <h3 className="font-display text-h3 font-semibold">{t("addCoupon")}</h3>
          {couponFields()}
          <div>
            <SaveButton>{t("addCoupon")}</SaveButton>
          </div>
        </form>
      </section>

      <section className="grid gap-4">
        <div className="grid gap-1">
          <h2 className="font-display text-h2 font-semibold">{t("referralsTitle")}</h2>
          <p className="text-small text-ink-muted">{t("referralsHint")}</p>
        </div>
        {referrals.length === 0 ? (
          <EmptyState>
            <p className="text-ink-muted">{t("noReferrals")}</p>
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className={table}>
              <thead>
                <tr>
                  <th>{t("referralDate")}</th>
                  <th>{t("referrer")}</th>
                  <th>{t("referred")}</th>
                  <th>{t("referralCode")}</th>
                  <th>{t("referralStatus")}</th>
                  <th>{t("referralDiscount")}</th>
                  <th>{t("referralRewarded")}</th>
                  <th>{t("referralCoupon")}</th>
                </tr>
              </thead>
              <tbody>
                {referrals.map((r) => (
                  <tr key={r.id}>
                    <td>{date.format(r.createdAt)}</td>
                    <td>
                      {r.referrer.name}
                      <span className="block text-label text-ink-muted" dir="ltr">
                        {r.referrer.phone ?? ""}
                      </span>
                    </td>
                    <td>
                      {r.referredUser.name}
                      <span className="block text-label text-ink-muted" dir="ltr">
                        {r.referredUser.phone ?? ""}
                      </span>
                    </td>
                    <td className="num" dir="ltr">
                      {r.code.code}
                    </td>
                    <td>{t(`referralStatuses.${r.status}`)}</td>
                    <td className="num">{formatMoney(r.discount, r.currency, locale)}</td>
                    <td>{r.rewardedAt ? date.format(r.rewardedAt) : ""}</td>
                    <td className="num" dir="ltr">
                      {r.rewardCoupon?.code ?? ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
