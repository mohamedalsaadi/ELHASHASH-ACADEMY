import { pick } from "@/lib/content";
import { getTranslations } from "next-intl/server";
import { VdoUpload } from "@/components/admin/VdoUpload";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { courseZone, formatWhen } from "@/lib/format";
import { inLiveWindow } from "@/lib/premiere";
import { sourceCounts, watchingNow } from "@/lib/premiere-stats";
import { panel } from "../AdminNav";
import { field, label } from "../styles";
import { DeleteButton, SaveButton } from "../ui";
import { cancelPremiere, createPremiere, invitePastViewers, setPremiereReplay } from "./actions";

/** The free live streams form and list: the admin sees every course, a teacher only the courses they teach. */
export async function PremiereManager({ locale, me, error, invited }: { locale: string; me: { id: string; role: string }; error?: string; invited?: string }) {
  const t = await getTranslations("premiere.admin");
  const ar = locale === "ar";
  const mine = me.role === "ADMIN" ? {} : { instructorId: me.id };

  const [rows, courses] = await Promise.all([
    db.premiere.findMany({
      where: { course: mine },
      orderBy: { startsAt: "desc" },
      take: 50,
      include: { course: { select: { titleAr: true, titleEn: true, grade: { select: { country: { select: { timeZone: true } } } } } }, video: { select: { durationSec: true } }, _count: { select: { rsvps: true } } },
    }),
    db.course.findMany({
      where: { published: true, ...mine },
      orderBy: { createdAt: "desc" },
      select: { id: true, titleAr: true, titleEn: true, grade: { select: { country: { select: { timeZone: true } } } } },
    }),
  ]);
  const now = new Date();
  const sources = await sourceCounts(rows.map((p) => p.slug));
  const live = new Map(
    await Promise.all(rows.filter((p) => !p.cancelledAt && inLiveWindow(now, p.startsAt, p.video.durationSec)).map(async (p) => [p.id, await watchingNow(p.id, now)] as const)),
  );

  return (
    <>
      <p className="max-w-[70ch] text-small text-ink-muted">{t("intro")}</p>

      {courses.length > 0 && (
        <section className={panel}>
          <h2 className="font-display text-h3 font-semibold">{t("new")}</h2>
          {error === "slug" && (
            <p role="alert" className="text-small font-medium text-down">
              {t("slugTaken")}
            </p>
          )}
          <form action={createPremiere} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="locale" value={locale} />
            <label className={`${label} sm:col-span-2`}>
              {t("course")}
              <select name="courseId" required className={field}>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {pick(ar, c.titleAr, c.titleEn)}
                  </option>
                ))}
              </select>
            </label>
            <label className={label}>
              {t("titleAr")}
              <input name="titleAr" required maxLength={200} className={field} />
            </label>
            <label className={label}>
              {t("titleEn")}
              <input name="titleEn" required maxLength={200} dir="ltr" className={field} />
            </label>
            <label className={label}>
              {t("blurbAr")}
              <input name="blurbAr" maxLength={300} className={field} />
            </label>
            <label className={label}>
              {t("blurbEn")}
              <input name="blurbEn" maxLength={300} dir="ltr" className={field} />
            </label>
            <label className={label}>
              {t("startsAtIn", { zone: courses[0]?.grade?.country.timeZone ?? "Asia/Dubai" })}
              <input name="startsAt" type="datetime-local" required dir="ltr" className={field} />
            </label>
            <label className={label}>
              {t("link")}
              <input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={80} placeholder="math-12-free" dir="ltr" className={field} />
            </label>
            <label className={label}>
              {t("videoId")}
              <input name="externalId" required dir="ltr" className={field} />
            </label>
            <label className={label}>
              {t("lengthMin")}
              <input name="lengthMin" type="number" min="1" max="600" required dir="ltr" className={`${field} num`} />
            </label>
            <div className="sm:col-span-2">
              <VdoUpload title="Free live stream" labels={{ pick: t("uploadPick"), sending: t("uploading"), done: t("uploadDone"), failed: t("uploadFailed") }} />
            </div>
            <label className="flex min-h-11 items-center gap-2 text-label text-ink-muted sm:col-span-2">
              <input type="checkbox" name="replay" defaultChecked className="size-4" />
              {t("replay")}
            </label>
            <div className="sm:col-span-2">
              <SaveButton>{t("create")}</SaveButton>
            </div>
          </form>
        </section>
      )}

      {invited != null && /^\d+$/.test(invited) && (
        <p role="status" className="text-small font-medium">
          {t("invited", { count: Number(invited) })}
        </p>
      )}
      {rows.length === 0 && <p className="text-small text-ink-muted">{t("empty")}</p>}
      {rows.map((p) => (
        <section key={p.id} className={panel}>
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <span className="grid gap-0.5">
              <span className="font-display font-semibold">{pick(ar, p.titleAr, p.titleEn)}</span>
              <span className="text-label text-ink-muted">{pick(ar, p.course.titleAr, p.course.titleEn)}</span>
            </span>
            <span className="grid gap-0.5 text-label sm:justify-items-end">
              <span className="num">{formatWhen(p.startsAt, courseZone(p.course), locale)}</span>
              <span className={p.cancelledAt ? "font-semibold text-down" : "text-ink-muted"}>
                {p.cancelledAt ? t("cancelled") : t("reminders", { count: p._count.rsvps })}
              </span>
            </span>
          </div>
          {(() => {
            const src = sources.get(p.slug) ?? [];
            const sum = (k: "visits" | "joined") => src.reduce((n, r) => n + r[k], 0);
            return (
              <div className="grid gap-1 text-label text-ink-muted">
                <span className="num">
                  {t("stats", { visits: sum("visits"), joined: sum("joined") })}
                  {live.has(p.id) && <span className="font-semibold text-down"> · {t("watchingNow", { count: live.get(p.id)! })}</span>}
                </span>
                {src.length > 0 && (
                  <span className="num">
                    {t("bySource")}{" "}
                    {src.map((r) => (
                      <span key={r.src} className="me-3 inline-block">
                        <bdi dir="ltr">{r.src}</bdi> {r.visits}/{r.joined}
                      </span>
                    ))}
                  </span>
                )}
              </div>
            );
          })()}
          <div className="flex flex-wrap items-center gap-3 border-t border-hairline pt-3 text-small">
            <Link href={`/premiere/${p.slug}`} className="text-pen underline underline-offset-4" dir="ltr">
              /premiere/{p.slug}
            </Link>
            {!p.cancelledAt && (
              <>
                <form action={setPremiereReplay}>
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="replay" value={p.replay ? "off" : "on"} />
                  <SaveButton showSaved={false}>{p.replay ? t("replayOn") : t("replayOff")}</SaveButton>
                </form>
                {p.startsAt > now && (
                  <form action={invitePastViewers}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="locale" value={locale} />
                    <SaveButton showSaved={false}>{t("invite")}</SaveButton>
                  </form>
                )}
                <form>
                  <input type="hidden" name="id" value={p.id} />
                  <DeleteButton action={cancelPremiere} label={t("cancel")} />
                </form>
              </>
            )}
          </div>
        </section>
      ))}
    </>
  );
}
