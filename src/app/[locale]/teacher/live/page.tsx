import { pageMetadata } from "@/lib/seo";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { EmptyState } from "@/components/brand/Mark";
import { Link } from "@/i18n/navigation";
import { toTimeInput } from "@/lib/admin-input";
import { db } from "@/lib/db";
import { courseZone, formatWhen, minorPerUnit } from "@/lib/format";
import { requireStaff } from "@/lib/staff";
import { field, label } from "../../admin/styles";
import { DeleteButton, SaveButton } from "../../admin/ui";
import { TeacherNav } from "../TeacherNav";
import { cancelLive, scheduleLive, setSeatPrice, updateLive } from "./actions";

export const dynamic = "force-dynamic";

const card = "grid gap-4 rounded-md border border-hairline bg-surface p-4";
const row = "grid gap-3 sm:grid-cols-2";

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return pageMetadata(params, "/teacher/live", "live", { key: "title", noindex: true });
}

export default async function TeacherLivePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { locale } = await params;
  const { error } = await searchParams;
  setRequestLocale(locale);
  const me = await requireStaff();
  const t = await getTranslations("live");
  const ar = locale === "ar";
  const now = new Date();
  const admin = me.role === "ADMIN";

  const courses = await db.course.findMany({
    where: admin ? {} : { instructorId: me.id },
    orderBy: { slug: "asc" },
    include: { grade: { include: { country: true } } },
  });
  const sessions = await db.liveSession.findMany({
    where: { courseId: { in: courses.map((c) => c.id) } },
    orderBy: { startsAt: "asc" },
    include: { sku: true, _count: { select: { entitlements: true } } },
  });
  const byId = new Map(courses.map((c) => [c.id, c]));
  const ends = (s: (typeof sessions)[number]) => new Date(s.startsAt.getTime() + s.durationMin * 60_000);
  const upcoming = sessions.filter((s) => !s.cancelledAt && ends(s) > now);
  const past = sessions.filter((s) => s.cancelledAt || ends(s) <= now).reverse().slice(0, 20);

  const text = (name: "titleAr" | "titleEn", value = "") => (
    <label className={label}>
      {t(name)}
      <input name={name} defaultValue={value} required maxLength={200} dir={name === "titleAr" ? "rtl" : "ltr"} className={field} />
    </label>
  );
  const timing = (zone: string | null, start = "", duration = 60) => (
    <>
      <label className={label}>
        {zone ? t("startsAtIn", { zone: t(`zone.${zone.split("/")[1]}`) }) : t("startsAt")}
        <input name="startsAt" type="datetime-local" defaultValue={start} required dir="ltr" className={`${field} num`} />
      </label>
      <label className={label}>
        {t("durationMin")}
        <input name="durationMin" type="number" min="15" max="300" step="5" defaultValue={duration} required dir="ltr" className={`${field} num w-28`} />
      </label>
    </>
  );

  return (
    <main className="mx-auto grid max-w-4xl gap-10 px-4 py-12">
      <div className="grid gap-4">
        <h1 className="font-display text-h1 font-semibold">{t("title")}</h1>
        <TeacherNav current="live" />
      </div>

      {courses.length === 0 && (
        <EmptyState>
          <p className="text-ink-muted">{t("noCourses")}</p>
        </EmptyState>
      )}
      {courses.length > 0 && (
        <form action={scheduleLive} className={card}>
          <h2 className="font-display text-h2 font-semibold">{t("schedule")}</h2>
          <input type="hidden" name="locale" value={locale} />
          {error === "past" && (
            <p role="alert" className="text-small text-down">
              {t("pastError")}
            </p>
          )}
          <label className={label}>
            {t("course")}
            <select name="courseId" required className={field}>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {ar ? c.titleAr : c.titleEn}
                </option>
              ))}
            </select>
          </label>
          <div className={row}>
            {text("titleAr")}
            {text("titleEn")}
          </div>
          <div className={row}>{timing(null)}</div>
          <p className="text-small text-ink-muted">{t("zoneHint")}</p>
          <div>
            <SaveButton>{t("scheduleCta")}</SaveButton>
          </div>
        </form>
      )}

      <section className="grid gap-3">
        <h2 className="font-display text-h2 font-semibold">{t("upcoming")}</h2>
        {upcoming.length === 0 ? (
          <EmptyState>
            <p className="text-ink-muted">{t("noUpcoming")}</p>
          </EmptyState>
        ) : (
          upcoming.map((s) => {
            const course = byId.get(s.courseId)!;
            const zone = courseZone(course);
            return (
              <div key={s.id} className={card}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="grid gap-1">
                    <span className="font-display font-semibold">{ar ? s.titleAr : s.titleEn}</span>
                    <span className="text-small text-ink-muted">
                      {ar ? course.titleAr : course.titleEn} · {formatWhen(s.startsAt, zone, locale)}
                    </span>
                  </span>
                  <span className="flex items-center gap-4 text-label">
                    <span className="num text-ink-muted">{t("seats", { count: s._count.entitlements })}</span>
                    <Link href={`/live/${s.id}`} className="font-semibold text-pen underline underline-offset-4">
                      {t("openRoom")}
                    </Link>
                  </span>
                </div>
                <form action={updateLive} className="grid gap-3">
                  <input type="hidden" name="id" value={s.id} />
                  <div className={row}>
                    {text("titleAr", s.titleAr)}
                    {text("titleEn", s.titleEn)}
                  </div>
                  <div className={row}>{timing(zone, toTimeInput(s.startsAt, zone), s.durationMin)}</div>
                  <div className="flex flex-wrap gap-3">
                    <SaveButton />
                    <DeleteButton action={cancelLive} label={t("cancel")} confirmText={t("confirmCancel")} />
                  </div>
                </form>
                {s.sku && (
                  <form action={setSeatPrice} className="flex flex-wrap items-end gap-3 border-t border-hairline pt-4">
                    <input type="hidden" name="id" value={s.sku.id} />
                    <label className={label}>
                      {t("seatPrice", { currency: s.sku.currency })}
                      <input name="price" type="number" min="0" step="0.01" defaultValue={s.sku.price / minorPerUnit(s.sku.currency)} required dir="ltr" className={`${field} num w-28`} />
                    </label>
                    <label className="flex min-h-11 items-center gap-2 text-label text-ink-muted">
                      <input type="checkbox" name="active" defaultChecked={s.sku.active} className="size-4" />
                      {t("seatOn")}
                    </label>
                    <SaveButton />
                  </form>
                )}
              </div>
            );
          })
        )}
      </section>

      {past.length > 0 && (
        <section className="grid gap-3">
          <h2 className="font-display text-h2 font-semibold">{t("past")}</h2>
          <ul className="grid gap-2">
            {past.map((s) => {
              const course = byId.get(s.courseId)!;
              return (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-hairline bg-surface p-4 text-small">
                  <span className="grid gap-1">
                    <span className="font-display font-semibold">{ar ? s.titleAr : s.titleEn}</span>
                    <span className="text-ink-muted">{formatWhen(s.startsAt, courseZone(course), locale)}</span>
                  </span>
                  <span className={s.cancelledAt ? "text-down" : "num text-ink-muted"}>
                    {s.cancelledAt ? t("cancelled") : t("seats", { count: s._count.entitlements })}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </main>
  );
}
