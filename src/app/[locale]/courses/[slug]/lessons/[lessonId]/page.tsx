import { notFound, redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { Link } from "@/i18n/navigation";
import { hasAccess } from "@/lib/catalog";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function LessonPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string; lessonId: string }>;
}) {
  const { locale, slug, lessonId } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("catalog");
  const ar = locale === "ar";

  const lesson = await db.lesson.findFirst({
    where: { id: lessonId, unit: { course: { slug, published: true } } },
    include: { video: true, unit: { include: { course: true } } },
  });
  if (!lesson) notFound();
  const { unit } = lesson;
  const course = unit.course;

  // Unit 1 is open to everyone; every other unit needs an active subscription.
  if (!unit.isFree) {
    const session = await auth();
    if (!(await hasAccess(session?.user?.id, course.id))) redirect(`/${locale}/courses/${slug}#packages`);
  }

  const video = lesson.video;
  return (
    <main className="mx-auto grid max-w-3xl gap-6 px-4 py-12">
      <Link href={`/courses/${slug}`} className="w-fit text-small text-ink-muted hover:text-ink">
        {ar ? course.titleAr : course.titleEn} · {ar ? unit.titleAr : unit.titleEn}
      </Link>
      <div className="grid gap-1">
        <h1 className="font-display text-h1 font-semibold">{ar ? lesson.titleAr : lesson.titleEn}</h1>
        <p className="text-small text-ink-muted">{t(`kind.${lesson.kind}`)}</p>
      </div>
      <div className="aspect-video overflow-hidden rounded-md border border-hairline bg-surface">
        {video?.provider === "YOUTUBE" ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(video.externalId)}?rel=0`}
            title={ar ? lesson.titleAr : lesson.titleEn}
            allow="encrypted-media; picture-in-picture; fullscreen"
            className="size-full"
          />
        ) : (
          // VdoCipher lessons get the secure player in the next step; until then they show the same notice.
          <div className="grid size-full place-items-center p-6 text-center text-ink-muted">{t("videoSoon")}</div>
        )}
      </div>
    </main>
  );
}
