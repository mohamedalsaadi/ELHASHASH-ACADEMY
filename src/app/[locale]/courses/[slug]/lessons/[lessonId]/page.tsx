import { notFound, redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { Mark } from "@/components/brand/Mark";
import { Notice, oneDevice, secondaryButton } from "@/components/OneDevice";
import { Link } from "@/i18n/navigation";
import { hasLessonAccess } from "@/lib/catalog";
import { db } from "@/lib/db";
import { getPlayback, playerUrl } from "@/lib/vdocipher";

export const dynamic = "force-dynamic";

/** DRM player: signed-in only, one device per account, watermark with name · phone · IP. */
async function SecurePlayer({ videoId, title, path }: { videoId: string; title: string; path: string }) {
  const t = await getTranslations("player");
  const session = await auth();
  if (!session?.user) {
    return (
      <Notice>
        <p>{t("signIn")}</p>
        <Link href={{ pathname: "/signin", query: { next: path } }} className={secondaryButton}>
          {t("signInCta")}
        </Link>
      </Notice>
    );
  }
  const userId = session.user.id;
  const device = await oneDevice(userId, path);
  if ("block" in device) return device.block;
  const { ip } = device;

  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true, phone: true } });
  let src: string;
  try {
    src = playerUrl(await getPlayback(videoId, [user.name, user.phone, ip].filter(Boolean).join(" · ")));
  } catch (e) {
    console.error(e);
    return <Notice>{t("unavailable")}</Notice>;
  }
  return <iframe src={src} title={title} allow="encrypted-media; fullscreen" allowFullScreen className="size-full" />;
}

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
    include: { video: true, instructor: { select: { name: true } }, unit: { include: { course: { include: { instructor: { select: { name: true } } } } } } },
  });
  if (!lesson) notFound();
  const { unit } = lesson;
  const course = unit.course;

  // Unit 1 is open to everyone; every other lesson needs an active subscription or a rental of this lesson.
  if (!unit.isFree) {
    const session = await auth();
    if (!(await hasLessonAccess(session?.user?.id, course.id, lesson.id))) redirect(`/${locale}/courses/${slug}#packages`);
  }

  const video = lesson.video;
  const title = ar ? lesson.titleAr : lesson.titleEn;
  return (
    <main className="mx-auto grid max-w-3xl gap-6 px-4 py-12">
      <Link href={`/courses/${slug}`} className="flex w-fit items-center gap-2 text-small text-ink-muted hover:text-ink">
        <Mark size={16} />
        {ar ? course.titleAr : course.titleEn} · {ar ? unit.titleAr : unit.titleEn}
      </Link>
      <div className="grid gap-1">
        <h1 className="font-display text-h1 font-semibold">{title}</h1>
        <p className="text-small text-ink-muted">
          {t(`kind.${lesson.kind}`)} · {t("recordedBy", { name: (lesson.instructor ?? course.instructor).name })}
        </p>
      </div>
      <div className="aspect-video overflow-hidden rounded-md border border-hairline bg-surface">
        {video?.provider === "YOUTUBE" ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(video.externalId)}?rel=0`}
            title={title}
            allow="encrypted-media; picture-in-picture; fullscreen"
            className="size-full"
          />
        ) : video?.provider === "VDOCIPHER" ? (
          <SecurePlayer videoId={video.externalId} title={title} path={`/${locale}/courses/${slug}/lessons/${lesson.id}`} />
        ) : (
          <Notice>{t("videoSoon")}</Notice>
        )}
      </div>
    </main>
  );
}
