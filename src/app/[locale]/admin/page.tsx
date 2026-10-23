import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/staff";
import { PasswordForm } from "./ui";

export const dynamic = "force-dynamic";

export default async function AdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireStaff();
  const t = await getTranslations("admin");
  const ar = locale === "ar";
  const courses = await db.course.findMany({ orderBy: { slug: "asc" }, include: { grade: true } });

  return (
    <main className="mx-auto grid max-w-3xl gap-10 px-4 py-12">
      <h1 className="font-display text-h1 font-semibold">{t("title")}</h1>
      <section className="grid gap-3">
        <h2 className="font-display text-h2 font-semibold">{t("courses")}</h2>
        <ul className="grid gap-2">
          {courses.map((c) => (
            <li key={c.id}>
              <Link
                href={`/admin/courses/${c.id}`}
                className="flex items-center justify-between gap-3 rounded-md border border-hairline bg-surface p-4 transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-raised"
              >
                <span className="grid gap-1">
                  <span className="font-display font-semibold">{ar ? c.titleAr : c.titleEn}</span>
                  <span className="text-small text-ink-muted">{ar ? c.grade.nameAr : c.grade.nameEn}</span>
                </span>
                <span className={`text-label ${c.published ? "text-up" : "text-ink-muted"}`}>
                  {c.published ? t("published") : t("hidden")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section className="grid gap-3">
        <h2 className="font-display text-h2 font-semibold">{t("changePassword")}</h2>
        <PasswordForm />
      </section>
    </main>
  );
}
