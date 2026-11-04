import { pageMetadata } from "@/lib/seo";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { requireAdmin } from "@/lib/staff";
import { teacherStats } from "@/lib/teachers";
import { addTeacherSlot, disableTeacher, removeTeacherSlot, setTeacherLive } from "../../actions";
import { AdminNav, panel, stat } from "../../AdminNav";
import { field, label } from "../../styles";
import { DeleteButton, ResetPasswordForm, SaveButton } from "../../ui";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return pageMetadata(params, "/admin/teachers", "office", { key: "nav.teachers", noindex: true });
}

export default async function TeacherPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireAdmin();
  const t = await getTranslations("office");
  const ta = await getTranslations("admin");
  const ar = locale === "ar";

  const x = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      role: true,
      liveApproved: true,
      courses: { orderBy: { slug: "asc" }, select: { id: true, titleAr: true, titleEn: true, published: true } },
      teacherSlots: {
        orderBy: { createdAt: "asc" },
        select: { id: true, gradeId: true, subjectId: true, grade: { select: { nameAr: true, nameEn: true } }, subject: { select: { nameAr: true, nameEn: true } } },
      },
    },
  });
  if (!x || (x.role !== "INSTRUCTOR" && x.role !== "ADMIN")) notFound();
  const s = await teacherStats(x.id);

  const gradeSubjects = await db.gradeSubject.findMany({
    orderBy: [{ grade: { level: "asc" } }, { order: "asc" }],
    select: { gradeId: true, subjectId: true, grade: { select: { nameAr: true, nameEn: true } }, subject: { select: { nameAr: true, nameEn: true } } },
  });
  const taken = new Set(x.teacherSlots.map((s) => `${s.gradeId}:${s.subjectId}`));
  const freeSlots = gradeSubjects.filter((g) => !taken.has(`${g.gradeId}:${g.subjectId}`));

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

      <section className={panel}>
        <h2 className="font-display text-h3 font-semibold">{t("slots")}</h2>
        <p className="text-small text-ink-muted">{t("slotsHint")}</p>
        {x.teacherSlots.length ? (
          <ul className="grid gap-1 text-small">
            {x.teacherSlots.map((slot) => (
              <li key={slot.id} className="flex items-center justify-between gap-3">
                <span>
                  {ar ? slot.subject.nameAr : slot.subject.nameEn} · {ar ? slot.grade.nameAr : slot.grade.nameEn}
                </span>
                <form>
                  <input type="hidden" name="id" value={slot.id} />
                  <DeleteButton action={removeTeacherSlot} label={t("removeSlot")} confirmText={t("confirmRemoveSlot")} />
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-small text-ink-muted">{t("noSlots")}</p>
        )}
        {freeSlots.length > 0 && (
          <form action={addTeacherSlot} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="userId" value={x.id} />
            <label className={label}>
              {t("addSlot")}
              <select name="slot" required className={field}>
                {freeSlots.map((g) => (
                  <option key={`${g.gradeId}:${g.subjectId}`} value={`${g.gradeId}:${g.subjectId}`}>
                    {ar ? g.grade.nameAr : g.grade.nameEn} · {ar ? g.subject.nameAr : g.subject.nameEn}
                  </option>
                ))}
              </select>
            </label>
            <SaveButton>{t("addSlot")}</SaveButton>
          </form>
        )}
      </section>

      {x.role === "INSTRUCTOR" ? (
        <>
          <section className={panel}>
            <h2 className="font-display text-h3 font-semibold">{t("resetPassword")}</h2>
            <ResetPasswordForm userId={x.id} />
          </section>
          <section className={panel}>
            <h2 className="font-display text-h3 font-semibold">{t("liveStreaming")}</h2>
            <p className="text-small text-ink-muted">{t("liveHint")}</p>
            <p className="text-small font-medium">
              {x.liveApproved ? t("liveOn", { name: x.name }) : t("liveOff", { name: x.name })}
            </p>
            <form action={setTeacherLive}>
              <input type="hidden" name="id" value={x.id} />
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="live" value={x.liveApproved ? "off" : "on"} />
              <SaveButton>{x.liveApproved ? t("liveTurnOff") : t("liveTurnOn")}</SaveButton>
            </form>
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
