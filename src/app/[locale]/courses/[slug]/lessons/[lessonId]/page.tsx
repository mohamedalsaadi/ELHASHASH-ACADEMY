import { notFound, redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { Mark } from "@/components/brand/Mark";
import { Notice, oneDevice, secondaryButton } from "@/components/OneDevice";
import { Link } from "@/i18n/navigation";
import { canAsk, hasLessonAccess, lessonScope } from "@/lib/catalog";
import { db } from "@/lib/db";
import { getPlayback, playerUrl } from "@/lib/vdocipher";
import { AskForm } from "./AskForm";
import { markLessonComplete } from "./actions";

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

  // Unit 1 is open to everyone; every other lesson needs a plan that opens it or a rental of this lesson.
  const session = await auth();
  const userId = session?.user?.id;
  if (!unit.isFree && !(await hasLessonAccess(userId, course.id, lessonScope(lesson)))) redirect(`/${locale}/courses/${slug}#packages`);
  if (userId) {
    await db.lessonView.upsert({
      where: { userId_lessonId: { userId, lessonId: lesson.id } },
      create: { userId, lessonId: lesson.id },
      update: { lastSeenAt: new Date() },
    });
  }
  const [mayAsk, mine, tq, view] = await Promise.all([
    canAsk(userId, course.id, lessonScope(lesson)),
    userId
      ? db.question.findMany({ where: { lessonId: lesson.id, userId }, orderBy: { createdAt: "desc" }, include: { answeredBy: { select: { name: true } } } })
      : [],
    getTranslations("questions"),
    userId ? db.lessonView.findUnique({ where: { userId_lessonId: { userId, lessonId: lesson.id } }, select: { completedAt: true } }) : null,
  ]);

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

      {userId && (
        <form action={markLessonComplete} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="lessonId" value={lesson.id} />
          {view?.completedAt ? (
            <span className="w-fit rounded-full border border-up px-3 py-1 text-label text-up">{t("completed")}</span>
          ) : (
            <button className="w-fit rounded-sm border border-ink-muted px-4 py-2 font-display text-small font-semibold transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-raised">
              {t("markComplete")}
            </button>
          )}
        </form>
      )}

      {userId && (mayAsk || mine.length > 0) && (
        <section className="grid gap-4 border-t border-hairline pt-6">
          <h2 className="font-display text-h2 font-semibold">{tq("title")}</h2>
          {mayAsk ? <AskForm lessonId={lesson.id} /> : <p className="text-small text-ink-muted">{tq("plansOnly")}</p>}
          <ul className="grid gap-3">
            {mine.map((q) => (
              <li key={q.id} className="grid gap-2 rounded-md border border-hairline bg-surface p-4">
                <p dir="auto" className="whitespace-pre-line">{q.body}</p>
                {q.answer ? (
                  <div className="grid gap-1 border-s-2 border-pen ps-3">
                    <p className="text-label font-semibold text-pen">{tq("answeredBy", { name: q.answeredBy?.name ?? "" })}</p>
                    <p dir="auto" className="whitespace-pre-line">{q.answer}</p>
                  </div>
                ) : (
                  <p className="text-label text-ink-muted">{tq("waiting")}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
