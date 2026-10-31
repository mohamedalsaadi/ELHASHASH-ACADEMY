import { pageMetadata } from "@/lib/seo";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { EmptyState } from "@/components/brand/Mark";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { requireAdmin } from "@/lib/staff";
import { teacherStats } from "@/lib/teachers";
import { cancelInvite } from "../actions";
import { AdminNav, panel, table } from "../AdminNav";
import { DeleteButton, InviteTeacherForm, type SlotOption, TeacherForm } from "../ui";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return pageMetadata(params, "/admin/teachers", "office", { key: "nav.teachers", noindex: true });
}

export default async function TeachersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdmin();
  const t = await getTranslations("office");
  const ta = await getTranslations("admin");
  const ar = locale === "ar";

  const teachers = await db.user.findMany({
    where: { role: { in: ["INSTRUCTOR", "ADMIN"] } },
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: { id: true, name: true, role: true, courses: { orderBy: { slug: "asc" }, select: { id: true, titleAr: true, titleEn: true } } },
  });
  const stats = await Promise.all(teachers.map((x) => teacherStats(x.id)));

  const gradeSubjects = await db.gradeSubject.findMany({
    orderBy: [{ grade: { level: "asc" } }, { order: "asc" }],
    select: {
      gradeId: true,
      subjectId: true,
      grade: { select: { nameAr: true, nameEn: true, country: { select: { nameAr: true, nameEn: true } } } },
      subject: { select: { nameAr: true, nameEn: true } },
    },
  });
  const slots: SlotOption[] = gradeSubjects.map((g) => ({
    value: `${g.gradeId}:${g.subjectId}`,
    group: ar ? g.grade.country.nameAr : g.grade.country.nameEn,
    label: `${ar ? g.grade.nameAr : g.grade.nameEn} · ${ar ? g.subject.nameAr : g.subject.nameEn}`,
  }));

  const invites = await db.teacherInvite.findMany({
    where: { usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    include: { slots: { include: { grade: true, subject: true } } },
  });
  const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  return (
    <main className="mx-auto grid max-w-5xl gap-6 px-4 py-12">
      <AdminNav current="teachers" />

      <div className="flex justify-end">
        <Link href="/admin/teachers/export" prefetch={false} className="text-small text-pen underline underline-offset-4">
          {t("exportTeachers")}
        </Link>
      </div>

      <section className={`${panel} overflow-x-auto`}>
        <table className={table}>
          <thead>
            <tr>
              <th scope="col">{t("teacher")}</th>
              <th scope="col">{ta("courses")}</th>
              <th scope="col">{t("lessonsRecorded")}</th>
              <th scope="col">{t("activeStudents")}</th>
              <th scope="col">{t("earningsMonth")}</th>
            </tr>
          </thead>
          <tbody>
            {teachers.map((x, i) => (
              <tr key={x.id}>
                <td>
                  <Link href={`/admin/teachers/${x.id}`} className="font-medium text-pen underline-offset-4 hover:underline">{x.name}</Link>
                  {x.role === "ADMIN" && <span className="ms-2 text-label text-ink-muted">{t("owner")}</span>}
                </td>
                <td>{x.courses.map((c) => (ar ? c.titleAr : c.titleEn)).join("، ") || "—"}</td>
                <td className="num">{stats[i].lessons}</td>
                <td className="num">{stats[i].students}</td>
                <td className="num">{[...stats[i].earnings].map(([cur, n]) => formatMoney(n, cur, locale)).join(" · ") || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {teachers.length === 0 && (
          <EmptyState>
            <p className="text-ink-muted">{t("noTeachers")}</p>
          </EmptyState>
        )}
      </section>

      <section className="grid gap-3">
        <h2 className="font-display text-h2 font-semibold">{ta("inviteTeacher")}</h2>
        <p className="text-small text-ink-muted">{ta("inviteHint")}</p>
        <InviteTeacherForm locale={locale} slots={slots} />
      </section>

      {invites.length > 0 && (
        <section className="grid gap-3">
          <h2 className="font-display text-h2 font-semibold">{ta("pendingInvites")}</h2>
          <ul className="grid gap-2">
            {invites.map((inv) => (
              <li key={inv.id} className={`${panel} flex flex-wrap items-center justify-between gap-3`}>
                <div className="grid gap-0.5">
                  <span className="font-medium">{inv.name}</span>
                  <span className="num text-small text-ink-muted" dir="ltr">{inv.email ?? inv.phone}</span>
                  <span className="text-small text-ink-muted">
                    {inv.slots.map((s) => `${ar ? s.subject.nameAr : s.subject.nameEn} · ${ar ? s.grade.nameAr : s.grade.nameEn}`).join("، ")}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-small text-ink-muted">{dateFmt.format(inv.expiresAt)}</span>
                  <form>
                    <input type="hidden" name="id" value={inv.id} />
                    <DeleteButton action={cancelInvite} label={ta("cancelInvite")} confirmText={ta("confirmCancelInvite")} />
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="grid gap-3">
        <h2 className="font-display text-h2 font-semibold">{ta("addTeacher")}</h2>
        <TeacherForm />
      </section>
    </main>
  );
}
