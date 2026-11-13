import { pick } from "@/lib/content";
import { pageMetadata } from "@/lib/seo";
import { notFound, redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cookies, headers } from "next/headers";
import { auth } from "@/auth";
import { Notice, oneDevice, secondaryButton } from "@/components/OneDevice";
import { LessonRow } from "@/components/learning/LessonRow";
import { Link } from "@/i18n/navigation";
import { logEventLater } from "@/lib/analytics";
import { canAsk, grantsFor, isCourseStaff, learnerFor, lessonScope } from "@/lib/catalog";
import { db } from "@/lib/db";
import { DEVICE_COOKIE } from "@/lib/device";
import { courseZone, formatDate } from "@/lib/format";
import { getPlayback, playerUrl } from "@/lib/vdocipher";
import { neighbours, nextOpenLesson, orderedLessons } from "@/lib/learning";
import { opensLesson } from "@/lib/plans";
import { blockerFor, itemHref } from "@/lib/gate-data";
import { DEVICE_WINDOW_MS, IP_WINDOW_MS, judgePlay, REPLAY_WINDOW_MS } from "@/lib/play-limits";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusChip } from "@/components/ui/StatusChip";
import { AskForm } from "./AskForm";
import { AskLesson } from "./AskLesson";
import { aiEnabled } from "@/lib/ai";
import { hasLessonSource } from "@/lib/ai-lesson";
import { PdfPages } from "@/components/learning/PdfPages";
import { VdoFrame } from "@/components/learning/VdoFrame";
import { completeFromPlayer, markLessonComplete, setConfidence } from "./actions";

export const dynamic = "force-dynamic";

/** DRM player: signed-in only, one device per account, watermark with name · phone · IP. */
type Limits = { lessonId: string; learnerId: string; maxPlays: number | null; maxIps: number | null; maxDevices: number | null };

type Onward = { href: string; label: string; doneLabel: string } | null;

async function SecurePlayer({ videoId, title, path, limits, onward }: { videoId: string; title: string; path: string; limits: Limits | null; onward: Onward }) {
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

  // Staff pass `limits = null`. Caps count per learner, so a parent watching for a child under 13 shares the child's plays,
  // IPs and "one person at a time" rule. A student is stopped at the first limit hit.
  if (limits) {
    const now = Date.now();
    const country = (await headers()).get("x-vercel-ip-country")?.slice(0, 2).toUpperCase() || null;
    const deviceId = (await cookies()).get(DEVICE_COOKIE)?.value ?? null;
    const [lessonPlays, recent, devices] = await Promise.all([
      db.playEvent.count({ where: { learnerId: limits.learnerId, lessonId: limits.lessonId } }),
      db.playEvent.findMany({
        where: { learnerId: limits.learnerId, at: { gt: new Date(now - IP_WINDOW_MS) } },
        select: { userId: true, lessonId: true, ip: true, country: true, at: true },
      }),
      limits.maxDevices == null
        ? []
        : db.playEvent.findMany({
            where: { learnerId: limits.learnerId, deviceId: { not: null }, at: { gt: new Date(now - DEVICE_WINDOW_MS) } },
            distinct: ["deviceId"],
            select: { deviceId: true },
          }),
    ]);
    const events = recent.map((e) => ({ ...e, at: e.at.getTime() }));
    const verdict = judgePlay({ now, viewerId: userId, lessonId: limits.lessonId, ip, country, events, lessonPlays, maxPlays: limits.maxPlays, maxIps: limits.maxIps, deviceId, knownDevices: devices.map((d) => d.deviceId!), maxDevices: limits.maxDevices });
    if (verdict === "plays") return <Notice>{t("playsUsed", { count: limits.maxPlays ?? 0 })}</Notice>;
    if (verdict !== "ok") return <Notice>{t(verdict)}</Notice>;
    // A refresh is the same play: only a play that is not a repeat is stored.
    const repeat = events.some((e) => e.userId === userId && e.lessonId === limits.lessonId && e.ip === ip && now - e.at < REPLAY_WINDOW_MS);
    if (!repeat) await db.playEvent.create({ data: { userId, learnerId: limits.learnerId, lessonId: limits.lessonId, ip, country, deviceId } });
  }

  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true, phone: true } });
  let src: string;
  try {
    src = playerUrl(await getPlayback(videoId, [user.name, user.phone, ip].filter(Boolean).join(" · ")));
  } catch (e) {
    console.error(e);
    return <Notice>{t("unavailable")}</Notice>;
  }
  // A student finishing the video completes the lesson; staff previews do not touch progress.
  return <VdoFrame key={limits?.lessonId ?? path} src={src} title={title} onWatched={limits ? completeFromPlayer.bind(null, limits.lessonId) : undefined} next={onward} />;
}

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return pageMetadata(params, "/courses", "player", { key: "title", noindex: true });
}

export default async function LessonPage({ params }: { params: Promise<{ locale: string; slug: string; lessonId: string }> }) {
  const { locale, slug, lessonId } = await params;
  setRequestLocale(locale);
  const [tc, tp, tq] = await Promise.all([getTranslations("catalog"), getTranslations("player"), getTranslations("questions")]);
  const th = await getTranslations("homework");
  const tpr = await getTranslations("practice");
  const ar = locale === "ar";
  const now = new Date();
  const early = await auth();
  // The owner and the course's teacher can open a draft course's lessons; everyone else only published ones.
  const visible = early?.user?.role === "ADMIN" ? {} : early?.user ? { OR: [{ published: true }, { instructorId: early.user.id }] } : { published: true };

  const [lesson, outline] = await Promise.all([
    db.lesson.findFirst({
      where: { id: lessonId, unit: { course: { slug, ...visible } } },
      include: {
        video: true,
        instructor: { select: { name: true } },
        _count: { select: { questionItems: { where: { active: true } } } },
        unit: {
          include: {
            course: {
              include: {
                instructor: { select: { name: true } },
                grade: { select: { country: { select: { timeZone: true } } } },
              },
            },
          },
        },
      },
    }),
    db.course.findFirst({
      where: { slug, ...visible },
      select: {
        id: true,
        instructorId: true,
        titleAr: true,
        titleEn: true,
        units: {
          orderBy: { order: "asc" },
          select: {
            id: true,
            order: true,
            isFree: true,
            term: true,
            titleAr: true,
            titleEn: true,
            lessons: { orderBy: { order: "asc" }, select: { id: true, order: true, month: true, titleAr: true, titleEn: true, kind: true } },
          },
        },
      },
    }),
  ]);
  if (!lesson || !outline) notFound();
  const { unit } = lesson;
  const course = unit.course;

  const session = early;
  const userId = session?.user?.id;
  const staff = isCourseStaff(session?.user, { instructorId: outline.instructorId });
  // A parent of a child under 13 watches on the child's plans.
  const learnerId = await learnerFor(session?.user, course.id, now);
  const grants = await grantsFor(learnerId, course.id, now, { includeEnded: true });
  const active = grants.filter((g) => !g.endsAt || g.endsAt > now);

  // Unit 1 is open to everyone; every other lesson needs a plan that opens it, a rental, or staff.
  const scope = lessonScope(lesson);
  const openable = (l: { id: string; month: number | null }, term: number, free: boolean) =>
    staff || free || active.some((g) => opensLesson(g, { id: l.id, month: l.month, term }, now));
  if (!openable(lesson, unit.term, unit.isFree)) redirect(`/${locale}/courses/${slug}#packages`);

  // Mandatory homework and exams: this lesson stays closed until the work on an earlier lesson is handed in. Staff are never gated.
  const blocked = learnerId && !staff ? await blockerFor(learnerId, course.id, lesson.id, now) : null;
  if (blocked) {
    const tg = await getTranslations("gate");
    return (
      <main className="mx-auto grid max-w-3xl gap-6 px-4 py-12">
        <PageHeader back={{ href: `/courses/${slug}`, label: pick(ar, outline.titleAr, outline.titleEn) }} title={pick(ar, lesson.titleAr, lesson.titleEn)} />
        <div className="card grid gap-3 p-6">
          <h2 className="font-display text-h3 font-semibold">{tg("closedTitle")}</h2>
          <p className="text-body text-ink-muted" dir="auto">{tg(blocked.kind === "exam" ? "finishExam" : "finishHomework", { title: blocked.title })}</p>
          <Link href={itemHref(slug, blocked)} className="btn btn-primary w-fit">{tg("go")}</Link>
        </div>
      </main>
    );
  }

  if (userId && learnerId) {
    await db.lessonView.upsert({
      where: { userId_lessonId: { userId: learnerId, lessonId: lesson.id } },
      create: { userId: learnerId, lessonId: lesson.id },
      update: { lastSeenAt: now },
    });
  }
  void logEventLater({ name: "lesson_opened", userId, courseId: course.id, dedupeScope: lesson.id });

  const outlineLessonIds = outline.units.flatMap((u) => u.lessons.map((l) => l.id));
  const [mayAsk, mine, view, completedRows, homework] = await Promise.all([
    canAsk(userId, course.id, scope),
    userId
      ? db.question.findMany({ where: { lessonId: lesson.id, userId }, orderBy: { createdAt: "desc" }, include: { answeredBy: { select: { name: true } } } })
      : [],
    learnerId ? db.lessonView.findUnique({ where: { userId_lessonId: { userId: learnerId, lessonId: lesson.id } }, select: { completedAt: true, confidence: true } }) : null,
    learnerId
      ? db.lessonView.findMany({ where: { userId: learnerId, lessonId: { in: outlineLessonIds }, completedAt: { not: null } }, select: { lessonId: true } })
      : [],
    userId
      ? db.assignment.findMany({
          where: { lessonId: lesson.id },
          orderBy: { dueAt: "asc" },
          select: { id: true, title: true, dueAt: true },
        })
      : [],
  ]);
  const completed = new Set(completedRows.map((v) => v.lessonId));

  const video = lesson.video;
  const entries = outline.units.flatMap((u) =>
    u.lessons.map((l) => ({ lesson: l, term: u.term, isFree: u.isFree })),
  );
  const ordered = orderedLessons(outline.units);
  const { prev, next } = neighbours(ordered, lesson.id);
  const termOf = (id: string) => outline.units.find((u) => u.lessons.some((l) => l.id === id))!;
  const isOpen = (id: string) => {
    const u = termOf(id);
    const l = u.lessons.find((x) => x.id === id)!;
    return openable(l, u.term, u.isFree);
  };
  const onward = nextOpenLesson(entries, active, completed, now, lesson.id, staff);
  // A later lesson exists but this plan does not open it: say so instead of "last lesson".
  const lockedNext = !onward && entries.slice(entries.findIndex((e) => e.lesson.id === lesson.id) + 1).some((e) => !completed.has(e.lesson.id));
  // The student finishes by watching; staff and anyone without a learner use the button.
  const autoDone = video?.provider === "VDOCIPHER" && !staff && !!learnerId;

  const viewer = userId && lesson.kind === "PDF" ? await db.user.findUnique({ where: { id: userId }, select: { name: true, phone: true } }) : null;
  const pdfMark = [viewer?.name, viewer?.phone].filter(Boolean).join(" · ");
  const title = pick(ar, lesson.titleAr, lesson.titleEn);
  const courseTitle = pick(ar, outline.titleAr, outline.titleEn);
  const courseHref = `/courses/${slug}`;
  const lessonHref = (id: string) => `/courses/${slug}/lessons/${id}`;

  return (
    <main className="mx-auto grid max-w-5xl gap-6 px-4 py-12 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      <div className="grid gap-6">
        <PageHeader
          back={{ href: courseHref, label: `${courseTitle} · ${pick(ar, unit.titleAr, unit.titleEn)}` }}
          title={title}
          meta={`${tc(`kind.${lesson.kind}`)} · ${tc("recordedBy", { name: (lesson.instructor ?? course.instructor).name })}`}
          actions={
            lesson._count.questionItems > 0 ? (
              <Link href={`/courses/${slug}/lessons/${lesson.id}/practice`} className="btn btn-outline px-4 py-2 text-small">
                {tpr("practice")}
              </Link>
            ) : null
          }
        />

        <div className={lesson.kind === "PDF" ? "card overflow-hidden" : "aspect-video overflow-hidden card"}>
          {lesson.kind === "PDF" ? (
            lesson.pdfPages.length > 0 && !userId ? (
              <Notice>{tp("signIn")}</Notice>
            ) : lesson.pdfPages.length > 0 ? (
              <PdfPages lessonId={lesson.id} count={lesson.pdfPages.length} mark={pdfMark} title={title} />
            ) : (
              <Notice>{tp("pdfUnavailable")}</Notice>
            )
          ) : video?.provider === "YOUTUBE" ? (
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(video.externalId)}?rel=0`}
              title={title}
              allow="encrypted-media; picture-in-picture; fullscreen"
              className="size-full"
            />
          ) : video?.provider === "VDOCIPHER" ? (
            <SecurePlayer
              videoId={video.externalId}
              title={title}
              path={`/${locale}/courses/${slug}/lessons/${lesson.id}`}
              limits={staff || !learnerId ? null : { lessonId: lesson.id, learnerId, maxPlays: course.maxPlays, maxIps: course.maxIps, maxDevices: course.maxDevices }}
              onward={onward ? { href: lessonHref(onward.lesson.id), label: tp("nextAfterComplete"), doneLabel: tp("completed") } : { href: "", label: "", doneLabel: tp("completed") }}
            />
          ) : (
            <Notice>{tc("videoSoon")}</Notice>
          )}
        </div>

        {userId && (
          <form action={markLessonComplete} className="flex flex-wrap items-center gap-3">
            <input type="hidden" name="lessonId" value={lesson.id} />
            {view?.completedAt ? (
              <>
                <StatusChip tone="active">{tp("completed")}</StatusChip>
                {onward ? (
                  <Link href={lessonHref(onward.lesson.id)} className="btn btn-outline px-4 py-2 text-small">
                    {tp("nextAfterComplete")}
                  </Link>
                ) : lockedNext ? (
                  <Link href={`${courseHref}#packages`} className="text-small font-semibold text-pen">
                    {tp("nextLocked")}
                  </Link>
                ) : (
                  <span className="text-small text-ink-muted">{tp("lastLesson")}</span>
                )}
              </>
            ) : autoDone ? (
              <span className="text-small text-ink-muted">{tp("autoComplete")}</span>
            ) : (
              <SubmitButton className="btn btn-outline w-fit px-4 py-2 text-small">{tp("markComplete")}</SubmitButton>
            )}
          </form>
        )}

        {/* One tap, once the lesson is finished. No text box, no streak pressure: it only feeds
            the readiness index and the teacher's class pulse. */}
        {userId && course.aiAssistant && aiEnabled() && hasLessonSource(lesson) && <AskLesson lessonId={lesson.id} />}

        {userId && view?.completedAt && (
          <form action={setConfidence} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="lessonId" value={lesson.id} />
            <span className="text-small text-ink-muted">{tp("confidenceQuestion")}</span>
            {(["GOT_IT", "SHAKY", "LOST"] as const).map((c) => (
              <button
                key={c}
                name="confidence"
                value={c}
                aria-pressed={view.confidence === c}
                className={`btn px-3 py-2 text-small ${view.confidence === c ? "btn-primary" : "btn-outline"}`}
              >
                {tp(`confidenceChoice.${c}`)}
              </button>
            ))}
          </form>
        )}

        {(prev || next) && (
        <nav className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-4">
          {prev ? (
            isOpen(prev.id) ? (
              <Link href={lessonHref(prev.id)} className="flex items-center gap-1 text-small font-semibold text-pen">
                <ChevronLeft aria-hidden="true" className="size-4 rtl:-scale-x-100" />
                {tp("prevLesson")}
              </Link>
            ) : (
              <span className="flex items-center gap-1 text-small text-ink-muted">
                <ChevronLeft aria-hidden="true" className="size-4 rtl:-scale-x-100" />
                {tp("locked")}
              </span>
            )
          ) : (
            <span />
          )}
          {next &&
            (isOpen(next.id) ? (
              <Link href={lessonHref(next.id)} className="flex items-center gap-1 text-small font-semibold text-pen">
                {tp("nextLesson")}
                <ChevronRight aria-hidden="true" className="size-4 rtl:-scale-x-100" />
              </Link>
            ) : (
              <span className="flex items-center gap-1 text-small text-ink-muted">
                {tp("locked")}
                <ChevronRight aria-hidden="true" className="size-4 rtl:-scale-x-100" />
              </span>
            ))}
        </nav>
        )}

        {homework.length > 0 && (
          <section className="grid gap-2 card p-4">
            <h2 className="font-display text-h3 font-semibold">{th("title")}</h2>
            <ul className="grid gap-1 text-small">
              {homework.map((a) => (
                <li key={a.id}>
                  <Link href={`/courses/${slug}/assignments/${a.id}`} className="flex flex-wrap items-center justify-between gap-2 underline-offset-4 hover:underline">
                    <span className="min-w-0 truncate" dir="auto">{a.title}</span>
                    <span className="num text-label text-ink-muted">
                      {a.dueAt ? formatDate(a.dueAt, courseZone(course), locale) : th("noDue")}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {userId && (mayAsk || mine.length > 0) && (
          <section id="questions" className="grid gap-4 border-t border-hairline pt-6">
            <h2 className="font-display text-h2 font-semibold">{tq("title")}</h2>
            {mayAsk ? <AskForm lessonId={lesson.id} /> : <p className="text-small text-ink-muted">{tq("plansOnly")}</p>}
            <ul className="grid gap-3">
              {mine.map((q) => (
                <li key={q.id} className="grid gap-2 card p-4">
                  <p dir="auto" className="break-words whitespace-pre-line">{q.body}</p>
                  {q.answer ? (
                    <div className="grid gap-1 border-s-2 border-pen ps-3">
                      <p className="text-label font-semibold text-pen">{tq("answeredBy", { name: q.answeredBy?.name ?? "" })}</p>
                      <p dir="auto" className="break-words whitespace-pre-line">{q.answer}</p>
                    </div>
                  ) : (
                    <p className="text-label text-ink-muted">{tq("waiting")}</p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <aside className="grid gap-3 card p-4 lg:sticky lg:top-6">
        <h2 className="font-display text-h3 font-semibold">{tp("courseLessons")}</h2>
        {outline.units.map((u) => (
          <details key={u.id} open={u.id === unit.id}>
            <summary className="cursor-pointer py-1 font-semibold">{pick(ar, u.titleAr, u.titleEn)}</summary>
            <ul className="grid">
              {u.lessons.map((l) => {
                const open = openable(l, u.term, u.isFree);
                const done = completed.has(l.id);
                return (
                  <li key={l.id}>
                    <LessonRow
                      href={open ? lessonHref(l.id) : undefined}
                      title={pick(ar, l.titleAr, l.titleEn)}
                      state={l.id === lesson.id ? "current" : done ? "done" : open ? "open" : "locked"}
                      stateLabel={l.id === lesson.id ? tc("lessonState.current") : done ? tc("lessonState.done") : open ? tc("lessonState.ahead") : undefined}
                      active={l.id === lesson.id}
                    />
                  </li>
                );
              })}
            </ul>
          </details>
        ))}
      </aside>
    </main>
  );
}
