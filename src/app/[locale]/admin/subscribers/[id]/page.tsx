import { pick } from "@/lib/content";
import { pageMetadata } from "@/lib/seo";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { toDayInput } from "@/lib/admin-input";
import { db } from "@/lib/db";
import { courseZone, formatMoney } from "@/lib/format";
import { requireAdmin } from "@/lib/staff";
import { isCurrent } from "@/lib/subscribers";
import { extendAccess, grantAccess } from "../../actions";
import { AdminNav, panel, table } from "../../AdminNav";
import { field, label } from "../../styles";
import { ResetPasswordForm, SaveButton } from "../../ui";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return pageMetadata(params, "/admin/subscribers", "office", { key: "nav.subscribers", noindex: true });
}

export default async function SubscriberPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireAdmin();
  const t = await getTranslations("office");
  const tc = await getTranslations("catalog");
  const ar = locale === "ar";
  const now = new Date();

  const [u, skus] = await Promise.all([
    db.user.findUnique({
      where: { id },
      include: {
        grade: { include: { country: true } },
        device: true,
        entitlements: {
          orderBy: { startsAt: "desc" },
          include: {
            course: { select: { titleAr: true, titleEn: true, grade: { select: { country: { select: { timeZone: true } } } } } },
            lesson: { select: { titleAr: true, titleEn: true } },
            liveSession: { select: { titleAr: true, titleEn: true, startsAt: true } },
          },
        },
        orders: { orderBy: { createdAt: "desc" }, take: 30, include: { items: { include: { sku: { select: { accessType: true, course: { select: { titleAr: true, titleEn: true } } } } } } } },
        views: { orderBy: { completedAt: { sort: "desc", nulls: "last" } }, take: 10, include: { lesson: { select: { titleAr: true, titleEn: true } } } },
      },
    }),
    db.sku.findMany({
      where: { active: true, accessType: { not: "LIVE" } },
      orderBy: [{ courseId: "asc" }, { price: "asc" }],
      include: { course: { select: { titleAr: true, titleEn: true } }, lesson: { select: { titleAr: true, titleEn: true } } },
    }),
  ]);
  if (!u || u.role === "ADMIN") notFound();

  // Account events (signup, last seen, orders) use the office day; anything tied to a course uses that course's zone.
  const dateIn = (timeZone: string) => new Intl.DateTimeFormat(ar ? "ar-EG-u-nu-latn" : "en-GB", { dateStyle: "medium", timeZone });
  const date = dateIn("Africa/Cairo");
  const name = (x: { titleAr: string; titleEn: string }) => (pick(ar, x.titleAr, x.titleEn));
  const plan = (a: string | null, days?: number | null) => (a ? tc(`access.${a}`, { days: days ?? 0 }) : t("wholeCourse"));
  const access = u.entitlements.filter((e) => !e.liveSessionId);
  const seats = u.entitlements.filter((e) => e.liveSessionId);
  const byCourse = Map.groupBy(skus, (s) => name(s.course));

  return (
    <main className="mx-auto grid max-w-5xl gap-6 px-4 py-12">
      <AdminNav current="subscribers" title={u.name} />

      <section className={`${panel} sm:grid-cols-2`}>
        <dl className="grid gap-2 text-small [&_dt]:text-label [&_dt]:text-ink-muted">
          <dt>{t("contact")}</dt>
          <dd className="num" dir="ltr">{[u.phone, u.email].filter(Boolean).join(" · ")}</dd>
          <dt>{t("grade")}</dt>
          <dd>{u.grade ? `${pick(ar, u.grade.country.nameAr, u.grade.country.nameEn)} · ${pick(ar, u.grade.nameAr, u.grade.nameEn)}` : "—"}</dd>
          <dt>{t("joined")}</dt>
          <dd className="num">{date.format(u.createdAt)}</dd>
          {u.role === "INSTRUCTOR" && (
            <dd>
              <Link href={`/admin/teachers/${u.id}`} className="text-pen underline-offset-4 hover:underline">{t("nav.teachers")}</Link>
            </dd>
          )}
        </dl>
        <dl className="grid content-start gap-2 text-small [&_dt]:text-label [&_dt]:text-ink-muted">
          <dt>{t("device")}</dt>
          <dd>{u.device ? <span className="grid"><span dir="ltr" className="truncate">{u.device.userAgent ?? "—"}</span><span className="num text-label text-ink-muted">{date.format(u.device.lastSeenAt)}</span></span> : "—"}</dd>
        </dl>
      </section>

      <section className={panel}>
        <h2 className="font-display text-h3 font-semibold">{t("access")}</h2>
        {access.length ? (
          <div className="overflow-x-auto">
            <table className={table}>
              <thead>
                <tr>
                  <th scope="col">{t("course")}</th>
                  <th scope="col">{t("status")}</th>
                  <th scope="col">{t("endsAt")}</th>
                </tr>
              </thead>
              <tbody>
                {access.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <span className="grid">
                        <span>{name(e.course)}</span>
                        <span className="text-label text-ink-muted">
                          {e.lesson ? name(e.lesson) : plan(e.accessType)}
                          {e.term ? ` · ${t("termN", { n: e.term })}` : ""}
                          {e.month ? ` · ${t("monthN", { n: e.month })}` : ""}
                        </span>
                      </span>
                    </td>
                    <td className={`font-semibold ${isCurrent(e, now) ? "text-up" : "text-ink-muted"}`}>{t(isCurrent(e, now) ? "active" : "expired")}</td>
                    <td>
                      <form action={extendAccess} className="flex flex-wrap items-center gap-2">
                        <input type="hidden" name="id" value={e.id} />
                        <input
                          type="date"
                          name="endsAt"
                          defaultValue={toDayInput(e.endsAt, e.course.grade?.country.timeZone ?? "Asia/Dubai")}
                          aria-label={t("endsAt")}
                          className={`${field} num`}
                        />
                        <SaveButton>{t("setEnd")}</SaveButton>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-small text-ink-muted">{t("noAccess")}</p>
        )}

        <form action={grantAccess} className="flex flex-wrap items-end gap-3 border-t border-hairline pt-4">
          <input type="hidden" name="userId" value={u.id} />
          <label className={`${label} min-w-0 flex-[1_1_18rem]`}>
            {t("grantAccess")}
            <select name="skuId" required className={field}>
              {[...byCourse].map(([course, list]) => (
                <optgroup key={course} label={course}>
                  {list.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.lesson ? name(s.lesson) : plan(s.accessType, s.accessDays)}
                      {s.term ? ` · ${t("termN", { n: s.term })}` : ""}
                      {s.month ? ` · ${t("monthN", { n: s.month })}` : ""}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label className={label}>
            {t("endsAtOptional")}
            <input type="date" name="endsAt" className={`${field} num`} />
          </label>
          <SaveButton>{t("grant")}</SaveButton>
          <p className="basis-full text-label text-ink-muted">{t("grantHint")}</p>
        </form>
      </section>

      {seats.length > 0 && (
        <section className={panel}>
          <h2 className="font-display text-h3 font-semibold">{t("liveSeats")}</h2>
          <ul className="grid gap-1 text-small">
            {seats.map((e) => (
              <li key={e.id} className="flex justify-between gap-3">
                <span>{e.liveSession ? name(e.liveSession) : name(e.course)}</span>
                <span className="num text-ink-muted">{e.liveSession && dateIn(courseZone(e.course)).format(e.liveSession.startsAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={panel}>
        <h2 className="font-display text-h3 font-semibold">{t("nav.orders")}</h2>
        {u.orders.length ? (
          <div className="overflow-x-auto">
            <table className={table}>
              <thead>
                <tr>
                  <th scope="col">{t("date")}</th>
                  <th scope="col">{t("items")}</th>
                  <th scope="col">{t("status")}</th>
                  <th scope="col">{t("amount")}</th>
                </tr>
              </thead>
              <tbody>
                {u.orders.map((o) => (
                  <tr key={o.id}>
                    <td className="num">
                      <Link href={`/admin/orders/${o.id}`} className="text-pen underline-offset-4 hover:underline">{date.format(o.createdAt)}</Link>
                    </td>
                    <td>{o.items.map((i) => `${name(i.sku.course)} · ${plan(i.sku.accessType)}`).join("، ") || t("extension")}</td>
                    <td>{t(`orderStatus.${o.status}`)} · {o.gateway}</td>
                    <td className="num">{formatMoney(o.total, o.currency, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-small text-ink-muted">{t("noOrders")}</p>
        )}
      </section>

      <section className={panel}>
        <h2 className="font-display text-h3 font-semibold">{t("recentViews")}</h2>
        {u.views.length ? (
          <ul className="grid gap-1 text-small">
            {u.views.map((v) => (
              <li key={v.lessonId} className="flex justify-between gap-3">
                <span>{name(v.lesson)}</span>
                <span className="num text-ink-muted">{v.completedAt ? date.format(v.completedAt) : date.format(v.lastSeenAt)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-small text-ink-muted">{t("noViews")}</p>
        )}
      </section>

      <section className={panel}>
        <h2 className="font-display text-h3 font-semibold">{t("resetPassword")}</h2>
        <ResetPasswordForm userId={u.id} />
      </section>
    </main>
  );
}
