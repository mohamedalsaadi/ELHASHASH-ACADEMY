import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { courseZone, formatMoney, formatWhen, minorPerUnit } from "@/lib/format";
import { requireAdmin } from "@/lib/staff";
import { setSeatPrice } from "../../teacher/live/actions";
import { AdminNav, panel } from "../AdminNav";
import { field, label } from "../styles";
import { SaveButton } from "../ui";

export const dynamic = "force-dynamic";

export default async function AdminLivePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdmin();
  const t = await getTranslations("office");
  const tl = await getTranslations("live");
  const ar = locale === "ar";
  const now = new Date();

  // ponytail: newest 100 sessions; page them once the archive outgrows that.
  const sessions = await db.liveSession.findMany({
    orderBy: { startsAt: "desc" },
    take: 100,
    include: {
      course: { select: { titleAr: true, titleEn: true, instructor: { select: { name: true } }, grade: { select: { country: { select: { code: true, timeZone: true } } } } } },
      sku: true,
      entitlements: { orderBy: { startsAt: "asc" }, select: { id: true, user: { select: { id: true, name: true } } } },
    },
  });

  return (
    <main className="mx-auto grid max-w-5xl gap-6 px-4 py-12">
      <AdminNav current="live" />
      {sessions.length === 0 && <p className="text-small text-ink-muted">{t("noLive")}</p>}
      {sessions.map((s) => {
        const upcoming = s.startsAt > now && !s.cancelledAt;
        return (
          <section key={s.id} className={panel}>
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <span className="grid gap-0.5">
                <span className="font-display font-semibold">{ar ? s.titleAr : s.titleEn}</span>
                <span className="text-label text-ink-muted">
                  {ar ? s.course.titleAr : s.course.titleEn} · {s.course.instructor.name}
                </span>
              </span>
              <span className="grid gap-0.5 text-label sm:justify-items-end">
                <span className="num">{formatWhen(s.startsAt, courseZone(s.course), locale)}</span>
                <span className={s.cancelledAt ? "font-semibold text-down" : upcoming ? "" : "text-ink-muted"}>
                  {s.cancelledAt ? t("cancelled") : t("seatsSold", { count: s.entitlements.length })}
                  {s.sku && !s.cancelledAt ? ` · ${formatMoney(s.sku.price, s.sku.currency, locale)}` : ""}
                </span>
              </span>
            </div>
            {upcoming && s.sku && (
              <form action={setSeatPrice} className="flex flex-wrap items-end gap-3 border-t border-hairline pt-3">
                <input type="hidden" name="id" value={s.sku.id} />
                <label className={label}>
                  {tl("seatPrice", { currency: s.sku.currency })}
                  <input name="price" type="number" min="0" step="0.01" defaultValue={s.sku.price / minorPerUnit(s.sku.currency)} required dir="ltr" className={`${field} num w-28`} />
                </label>
                <label className="flex min-h-11 items-center gap-2 text-label text-ink-muted">
                  <input type="checkbox" name="active" defaultChecked={s.sku.active} className="size-4" />
                  {tl("seatOn")}
                </label>
                <SaveButton />
              </form>
            )}
            {s.entitlements.length > 0 && (
              <details className="text-small">
                <summary className="cursor-pointer text-pen">{t("attendees", { count: s.entitlements.length })}</summary>
                <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                  {s.entitlements.map((e) => (
                    <li key={e.id}>
                      <Link href={`/admin/subscribers/${e.user.id}`} className="underline-offset-4 hover:underline">
                        {e.user.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>
        );
      })}
    </main>
  );
}
