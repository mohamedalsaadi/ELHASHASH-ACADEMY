import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { requireAdmin } from "@/lib/staff";
import { teacherStats } from "@/lib/teachers";
import { disableTeacher } from "../../actions";
import { AdminNav, panel, stat } from "../../AdminNav";
import { DeleteButton, ResetPasswordForm } from "../../ui";

export const dynamic = "force-dynamic";

export default async function TeacherPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireAdmin();
  const t = await getTranslations("office");
  const ta = await getTranslations("admin");
  const ar = locale === "ar";

  const x = await db.user.findUnique({
    where: { id },
    select: { id: true, name: true, phone: true, email: true, role: true, courses: { orderBy: { slug: "asc" }, select: { id: true, titleAr: true, titleEn: true, published: true } } },
  });
  if (!x || (x.role !== "INSTRUCTOR" && x.role !== "ADMIN")) notFound();
  const s = await teacherStats(x.id);

  return (
    <main className="mx-auto grid max-w-4xl gap-6 px-4 py-12">
      <AdminNav current="teachers" title={x.name} />
      <p className="num text-small text-ink-muted" dir="ltr">{[x.phone, x.email].filter(Boolean).join(" · ")}</p>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          [t("lessonsRecorded"), String(s.lessons)],
          [t("activeStudents"), String(s.students)],
          [t("earningsMonth"), [...s.earnings].map(([cur, n]) => formatMoney(n, cur, locale)).join(" · ") || "—"],
        ].map(([k, v]) => (
          <li key={k} className={stat}>
            <span className="num font-display text-h3 font-semibold">{v}</span>
            <span className="text-label text-ink-muted">{k}</span>
          </li>
        ))}
      </ul>

      <section className={panel}>
        <h2 className="font-display text-h3 font-semibold">{ta("courses")}</h2>
        {x.courses.length ? (
          <ul className="grid gap-1 text-small">
            {x.courses.map((c) => (
              <li key={c.id} className="flex justify-between gap-3">
                <Link href={`/admin/courses/${c.id}`} className="text-pen underline-offset-4 hover:underline">{ar ? c.titleAr : c.titleEn}</Link>
                <span className={c.published ? "text-up" : "text-ink-muted"}>{ta(c.published ? "published" : "hidden")}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-small text-ink-muted">—</p>
        )}
      </section>

      {x.role === "INSTRUCTOR" ? (
        <>
          <section className={panel}>
            <h2 className="font-display text-h3 font-semibold">{t("resetPassword")}</h2>
            <ResetPasswordForm userId={x.id} />
          </section>
          <section className={panel}>
            <h2 className="font-display text-h3 font-semibold">{t("disableTeacher")}</h2>
            <p className="text-small text-ink-muted">{t("disableHint")}</p>
            <form>
              <input type="hidden" name="id" value={x.id} />
              <input type="hidden" name="locale" value={locale} />
              <DeleteButton action={disableTeacher} label={t("disableTeacher")} confirmText={t("confirmDisable", { name: x.name })} />
            </form>
          </section>
        </>
      ) : (
        <p className="text-small text-ink-muted">{t("ownerLocked")}</p>
      )}
    </main>
  );
}
