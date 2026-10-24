import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { requireAdmin } from "@/lib/staff";
import { teacherStats } from "@/lib/teachers";
import { AdminNav, panel, table } from "../AdminNav";
import { TeacherForm } from "../ui";

export const dynamic = "force-dynamic";

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

  return (
    <main className="mx-auto grid max-w-5xl gap-6 px-4 py-12">
      <AdminNav current="teachers" />

      <section className={`${panel} overflow-x-auto`}>
        <table className={table}>
          <thead>
            <tr>
              <th>{t("teacher")}</th>
              <th>{ta("courses")}</th>
              <th>{t("lessonsRecorded")}</th>
              <th>{t("activeStudents")}</th>
              <th>{t("earningsMonth")}</th>
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
      </section>

      <section className="grid gap-3">
        <h2 className="font-display text-h2 font-semibold">{ta("addTeacher")}</h2>
        <TeacherForm />
      </section>
    </main>
  );
}
