import { pick } from "@/lib/content";
import { pageMetadata } from "@/lib/seo";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/staff";
import { PageHeader } from "@/components/ui/PageHeader";
import { TeacherNav } from "../../TeacherNav";
import { AssignmentForm } from "../AssignmentForm";
import { createAssignment } from "../actions";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return pageMetadata(params, "/teacher/assignments", "homework", { key: "new", noindex: true });
}

export default async function NewAssignmentPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const me = await requireStaff();
  const t = await getTranslations("homework");
  const ar = locale === "ar";

  const courses = await db.course.findMany({
    where: me.role === "ADMIN" ? {} : { instructorId: me.id },
    orderBy: { slug: "asc" },
    select: {
      id: true,
      titleAr: true,
      titleEn: true,
      units: { orderBy: { order: "asc" }, select: { lessons: { orderBy: { order: "asc" }, select: { id: true, titleAr: true, titleEn: true } } } },
    },
  });

  const options = courses.map((c) => ({
    id: c.id,
    title: pick(ar, c.titleAr, c.titleEn),
    lessons: c.units.flatMap((u) => u.lessons).map((l) => ({ id: l.id, title: pick(ar, l.titleAr, l.titleEn) })),
  }));

  return (
    <main className="mx-auto grid max-w-3xl gap-6 px-4 py-12">
      <PageHeader title={t("new")} />
      <TeacherNav current="assignments" />
      {options.length === 0 ? (
        <p className="text-small text-ink-muted">{t("noAssignments")}</p>
      ) : (
        <AssignmentForm
          mode="new"
          action={createAssignment}
          courses={options}
          labels={{
            course: t("course"),
            lesson: t("lesson"),
            lessonNone: t("lessonNone"),
            title: t("name"),
            instructions: t("instructions"),
            linkUrl: t("linkUrl"),
            rubric: t("rubric"),
            due: t("due"),
            maxScore: t("maxScore"),
            allowResubmit: t("allowResubmit"),
            files: t("files"),
            attach: t("attach"),
            removeFile: t("removeFile"),
            uploadFailed: t("uploadFailed"),
            kind: t("kind"),
            kindHomework: t("kindHomework"),
            kindQuiz: t("kindQuiz"),
            save: t("create"),
            invalid: t("invalid"),
          }}
        />
      )}
    </main>
  );
}
