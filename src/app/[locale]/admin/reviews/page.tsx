import { getTranslations, setRequestLocale } from "next-intl/server";
import { EmptyState } from "@/components/brand/Mark";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { field } from "@/components/ui/form";
import { pick } from "@/lib/content";
import { db } from "@/lib/db";
import { rateState } from "@/lib/reviews";
import { pageMetadata } from "@/lib/seo";
import { requireAdmin } from "@/lib/staff";
import { AdminNav, panel } from "../AdminNav";
import { decideReview } from "./actions";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return pageMetadata(params, "/admin/reviews", "office", { key: "nav.reviews", noindex: true });
}

const include = {
  course: { select: { titleAr: true, titleEn: true, instructor: { select: { name: true } } } },
  student: { select: { name: true, grade: { select: { nameAr: true, nameEn: true } } } },
} as const;

/** Low ratings wait here for the admin; below them, the decisions already made. */
export default async function AdminReviewsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdmin();
  const t = await getTranslations("reviews");
  const ar = locale === "ar";
  const date = new Intl.DateTimeFormat(ar ? "ar-EG-u-nu-latn" : "en-GB", { dateStyle: "medium", timeZone: "Asia/Dubai" });

  const [held, decided] = await Promise.all([
    db.courseReview.findMany({ where: { status: "HELD" }, orderBy: { createdAt: "asc" }, take: 100, include }),
    db.courseReview.findMany({ where: { decidedAt: { not: null } }, orderBy: { decidedAt: "desc" }, take: 20, include }),
  ]);
  const progress = new Map(await Promise.all(held.map(async (r) => [r.id, (await rateState(r.studentId, r.courseId)).pct] as const)));
  const grade = (r: (typeof held)[number]) => pick(ar, r.student.grade?.nameAr, r.student.grade?.nameEn) || "-";

  return (
    <main className="mx-auto grid max-w-4xl gap-6 px-4 py-12">
      <AdminNav current="reviews" />
      <p className="text-small text-ink-muted">{t("adminHint")}</p>

      {held.length === 0 ? (
        <EmptyState>
          <p className="text-ink-muted">{t("adminEmpty")}</p>
        </EmptyState>
      ) : (
        held.map((r) => (
          <section key={r.id} className={panel}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-display text-h3 font-semibold">{pick(ar, r.course.titleAr, r.course.titleEn)}</span>
              <span className="num font-display text-h3 font-semibold">{r.stars} / 5</span>
            </div>
            <p className="num text-label text-ink-muted">
              {r.course.instructor.name} · {t("by", { grade: grade(r) })} · {t("progress", { pct: String(progress.get(r.id) ?? 0) })} · {t("waitingSince", { date: date.format(r.createdAt) })}
            </p>
            {r.text && <p dir="auto" className="whitespace-pre-line rounded-sm bg-raised p-3 text-small">{r.text}</p>}
            <div className="flex flex-wrap items-start gap-3">
              <form action={decideReview}>
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="decision" value="publish" />
                <SubmitButton showSaved={false} className="btn btn-primary w-fit text-small">{t("publish")}</SubmitButton>
              </form>
              <form action={decideReview} className="grid flex-1 gap-2 sm:min-w-64">
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="decision" value="remove" />
                <input name="reason" required minLength={3} maxLength={1000} dir="auto" placeholder={t("reason")} aria-label={t("reason")} className={field} />
                <SubmitButton showSaved={false} className="btn btn-outline w-fit border-down text-small text-down">{t("remove")}</SubmitButton>
              </form>
            </div>
          </section>
        ))
      )}

      {decided.length > 0 && (
        <section className="grid gap-2">
          <h2 className="font-display text-h3 font-semibold">{t("decided")}</h2>
          <ul className="grid gap-2">
            {decided.map((r) => (
              <li key={r.id} className="grid gap-1 rounded-sm border border-hairline p-3 text-small">
                <span className="num">
                  {pick(ar, r.course.titleAr, r.course.titleEn)} · {r.stars} / 5 · {r.status === "PUBLISHED" ? t("publish") : t("remove")} · {date.format(r.decidedAt!)}
                </span>
                {r.adminNote && <span dir="auto" className="text-ink-muted">{r.adminNote}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
