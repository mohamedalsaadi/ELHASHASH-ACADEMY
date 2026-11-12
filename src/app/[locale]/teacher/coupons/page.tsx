import { getTranslations, setRequestLocale } from "next-intl/server";
import { Block } from "@/components/homework/AttachmentList";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusChip } from "@/components/ui/StatusChip";
import { toDayInput } from "@/lib/admin-input";
import { pick } from "@/lib/content";
import { db } from "@/lib/db";
import { pageMetadata } from "@/lib/seo";
import { TeacherNav } from "../TeacherNav";
import { CouponForm } from "./CouponForm";
import { couponManager } from "@/lib/coupon-manager";
import { setTeacherCouponActive } from "./actions";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return pageMetadata(params, "/teacher/coupons", "teacher", { key: "couponsTitle", noindex: true });
}

/** A teacher the admin has allowed manages discount codes for their own courses here. Everyone else gets a not-found page. */
export default async function TeacherCouponsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { me, cap } = await couponManager();
  const t = await getTranslations("teacher");
  const ar = locale === "ar";

  const [courses, coupons] = await Promise.all([
    db.course.findMany({ where: { instructorId: me.id }, orderBy: { slug: "asc" }, select: { id: true, titleAr: true, titleEn: true } }),
    db.coupon.findMany({
      where: { instructorId: me.id },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { orders: { where: { status: "PAID" } } } }, course: { select: { titleAr: true, titleEn: true } } },
    }),
  ]);
  const options = courses.map((c) => ({ id: c.id, title: pick(ar, c.titleAr, c.titleEn) }));
  const labels = {
    code: t("couponCode"), course: t("couponCourse"), percent: t("couponPercent"), start: t("couponStart"), end: t("couponEnd"), max: t("couponMax"),
    perUser: t("couponPerUser"), active: t("couponActive"), save: t("couponSave"), invalid: t("couponErrInvalid"), cap: t("couponErrCap", { cap }),
    taken: t("couponErrTaken"), saved: t("couponSaved"),
  };

  return (
    <main className="mx-auto grid max-w-4xl gap-6 px-4 py-12">
      <PageHeader title={t("couponsTitle")} meta={t("couponsCap", { cap })} />
      <TeacherNav current="coupons" />
      <p className="text-small text-ink-muted">{t("couponsHint")}</p>

      {options.length === 0 ? (
        <p className="text-small text-ink-muted">{t("couponsNoCourse")}</p>
      ) : (
        <Block title={t("couponAdd")}>
          <CouponForm courses={options} cap={cap} labels={labels} />
        </Block>
      )}

      <Block title={t("couponsTitle")}>
        {coupons.length === 0 ? (
          <p className="text-small text-ink-muted">{t("couponNone")}</p>
        ) : (
          <ul className="grid gap-3">
            {coupons.map((c) => (
              <li key={c.id} className="grid gap-2 rounded-md border border-hairline p-3 text-small">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold" dir="ltr">{c.code} · {c.percentOff}%</span>
                  <span className="flex items-center gap-2">
                    <StatusChip tone={c.active ? "active" : "neutral"}>{c.active ? t("couponOn") : t("couponOff")}</StatusChip>
                    <span className="num text-label text-ink-muted">{t("couponUsed", { count: c._count.orders })}{c.maxRedemptions != null ? ` / ${c.maxRedemptions}` : ""}</span>
                  </span>
                </div>
                {c.course && <span className="text-label text-ink-muted">{pick(ar, c.course.titleAr, c.course.titleEn)}</span>}
                <details>
                  <summary className="w-fit cursor-pointer text-label underline underline-offset-4">{t("couponEdit")}</summary>
                  <div className="mt-2">
                    <CouponForm
                      courses={options}
                      cap={cap}
                      labels={labels}
                      values={{
                        id: c.id,
                        code: c.code,
                        courseId: c.courseId ?? undefined,
                        percentOff: c.percentOff ?? undefined,
                        startsAt: toDayInput(c.startsAt),
                        endsAt: toDayInput(c.endsAt),
                        maxRedemptions: c.maxRedemptions,
                        perUser: c.perUser,
                        active: c.active,
                      }}
                    />
                  </div>
                </details>
                <form action={setTeacherCouponActive}>
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="active" value={c.active ? "off" : "on"} />
                  <button className="text-label underline underline-offset-4">{c.active ? t("couponTurnOff") : t("couponTurnOn")}</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Block>
    </main>
  );
}
