import { pageMetadata } from "@/lib/seo";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ImageUpload } from "@/components/ImageUpload";
import { PdfUpload } from "@/components/admin/PdfUpload";
import { KindOnly } from "@/components/admin/KindOnly";
import { VdoUpload } from "@/components/admin/VdoUpload";
import { Link } from "@/i18n/navigation";
import { toDayInput } from "@/lib/admin-input";
import { pick } from "@/lib/content";
import { db } from "@/lib/db";
import { formatWhen, minorPerUnit } from "@/lib/format";
import { canPublishLive } from "@/lib/live";
import { courseReadiness } from "@/lib/publish-check";
import { lecturesIn } from "@/lib/plans";
import { assertCourse, requireStaff } from "@/lib/staff";
import { addLesson, addRental, addSku, addUnit, copyUnit, deleteCourse, deleteLesson, setTeacher, updateCourse, updateLesson, updateSku, updateUnit } from "../../actions";
import { addRecording, scheduleLive } from "../../../teacher/live/actions";
import { field, label } from "../../styles";
import { DeleteButton, PlanPrice, SaveButton } from "../../ui";

export const dynamic = "force-dynamic";

const card = "grid gap-4 rounded-lg border border-hairline bg-surface shadow-paper p-4";
const tile = "grid gap-3 rounded-sm bg-raised p-3";
const check = "flex items-center gap-2 text-small";

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return pageMetadata(params, "/admin/courses", "office", { key: "nav.courses", noindex: true });
}

export default async function AdminCoursePage({ params, searchParams }: { params: Promise<{ locale: string; id: string }>; searchParams: Promise<{ error?: string; publishError?: string }> }) {
  const { locale, id } = await params;
  const { error: liveError, publishError } = await searchParams;
  setRequestLocale(locale);
  const me = await requireStaff();
  await assertCourse(me, id);
  const isAdmin = me.role === "ADMIN";
  const t = await getTranslations("admin");
  const tc = await getTranslations("catalog");
  const tl = await getTranslations("live");

  const course = await db.course.findUnique({
    where: { id },
    include: {
      grade: { include: { country: true } },
      units: { orderBy: { order: "asc" }, include: { lessons: { orderBy: { order: "asc" }, include: { video: true } } } },
      skus: { orderBy: { accessType: "asc" } },
    },
  });
  if (!course) notFound();
  const readiness = await courseReadiness(id);
  const zone = course.grade?.country.timeZone ?? "Asia/Dubai";
  // Where a topic can be copied to: the other courses this person may edit.
  const otherCourses = await db.course.findMany({
    where: { id: { not: id }, ...(isAdmin ? {} : { instructorId: me.id }) },
    orderBy: [{ gradeId: "asc" }, { titleEn: "asc" }],
    select: { id: true, titleAr: true, titleEn: true },
    take: 200,
  });
  const teachers = isAdmin
    ? await db.user.findMany({ where: { role: { in: ["INSTRUCTOR", "ADMIN"] } }, orderBy: { name: "asc" }, select: { id: true, name: true } })
    : [];
  const [questions, quizzes, exams] = await Promise.all([
    db.questionItem.count({ where: { courseId: id } }),
    db.assignment.count({ where: { courseId: id } }),
    db.examPaper.count({ where: { courseId: id } }),
  ]);
  const counts = { questions, quizzes, exams };
  const canLive = await canPublishLive(me);
  const liveNow = new Date();
  const sessions = await db.liveSession.findMany({ where: { courseId: id }, orderBy: { startsAt: "desc" }, take: 30 });
  const sessionEnd = (x: (typeof sessions)[number]) => new Date(x.startsAt.getTime() + x.durationMin * 60_000);
  const upcomingLive = sessions.filter((x) => !x.cancelledAt && sessionEnd(x) > liveNow).reverse();
  const pastLive = sessions.filter((x) => !x.cancelledAt && sessionEnd(x) <= liveNow).slice(0, 10);
  const packages = course.skus.filter((s) => !s.lessonId && !s.liveSessionId);
  const rentalOf = new Map(course.skus.filter((s) => s.lessonId).map((s) => [s.lessonId!, s]));
  // Skill courses sell for a number of days; school subjects by term or year.
  const packageTypes = course.kind === "SKILL" ? (["FIXED_DAYS"] as const) : (["SEMESTER", "MONTHLY", "YEARLY", "REVISION"] as const);
  // Plans are compared with the cheapest lecture rental, as on the course page.
  const single = course.skus.filter((s) => s.lessonId && s.active).sort((a, b) => a.price - b.price)[0]?.price ?? null;
  const numbers = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
  // React resets a form after its action runs, and a reset <select> falls back to its first option.
  // A key that changes on every render remounts lesson forms with the saved values instead.
  const renderedAt = Date.now();

  return (
    <main className="mx-auto grid max-w-4xl gap-10 px-4 py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={isAdmin ? "/admin/courses" : "/teacher"} className="link-tap text-small text-ink-muted hover:text-ink">
          {t("back")}
        </Link>
        <Link href={`/courses/${course.slug}`} className="link-tap text-small text-ink-muted hover:text-ink">
          {t("viewPage")}
        </Link>
      </div>

      <section className={`${card} sm:grid-cols-[1fr_auto] sm:items-center`}>
        <div className="grid gap-1">
          <h2 className="font-display text-h3 font-semibold">{t("questionsCardTitle")}</h2>
          <p className="text-small text-ink-muted">{t("questionsCardHint")}</p>
          <p className="num text-label text-ink-muted">{t("questionsCardCounts", { questions: counts.questions, quizzes: counts.quizzes, exams: counts.exams })}</p>
        </div>
        <Link href={`/admin/courses/${course.id}/questions`} className="btn btn-primary px-4 py-2 text-small">{t("openQuestions")}</Link>
      </section>

      <section className={card} aria-labelledby="ready">
        <h2 id="ready" className="font-display text-h3 font-semibold">{t("ready.heading")}</h2>
        {publishError && (
          <p role="alert" className="text-small text-down">
            {t("ready.blocked")}
          </p>
        )}
        <ul className="grid gap-1 text-small">
          {(["title", "description", "content", "package"] as const).map((k) => (
            <li key={k} className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full border border-hairline px-2 text-label ${readiness.blocking.includes(k) ? "text-down" : "text-up"}`}>{readiness.blocking.includes(k) ? `▼ ${t("ready.missing")}` : `▲ ${t("ready.ok")}`}</span>
              {t(`ready.${k}`)}
            </li>
          ))}
          {(["cover", "teacher"] as const).map((k) => (
            <li key={k} className="flex flex-wrap items-center gap-2 text-ink-muted">
              <span className="rounded-full border border-hairline px-2 text-label">{readiness.warnings.includes(k) ? t("ready.missing") : t("ready.ok")}</span>
              {t(`ready.${k}`)}
            </li>
          ))}
        </ul>
      </section>

      <form action={updateCourse} className={card}>
        <h1 className="font-display text-h2 font-semibold">{t("course")}</h1>
        <input type="hidden" name="id" value={course.id} />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={label}>
            {t("titleAr")}
            <input name="titleAr" defaultValue={course.titleAr} required dir="rtl" className={field} />
          </label>
          <label className={label}>
            {t("titleEn")}
            <input name="titleEn" defaultValue={course.titleEn} required dir="ltr" className={field} />
          </label>
          <label className={label}>
            {t("headlineAr")}
            <input name="headlineAr" defaultValue={course.headlineAr ?? ""} maxLength={200} dir="rtl" className={field} />
          </label>
          <label className={label}>
            {t("headlineEn")}
            <input name="headlineEn" defaultValue={course.headlineEn ?? ""} maxLength={200} dir="ltr" className={field} />
          </label>
          <label className={label}>
            {t("descAr")}
            <textarea name="descAr" defaultValue={course.descAr ?? ""} rows={3} dir="rtl" className={`${field} py-2`} />
          </label>
          <label className={label}>
            {t("descEn")}
            <textarea name="descEn" defaultValue={course.descEn ?? ""} rows={3} dir="ltr" className={`${field} py-2`} />
          </label>
        </div>
        <ImageUpload
          pathPrefix={`covers/${course.id}/`}
          clientPayload={JSON.stringify({ purpose: "cover", courseId: course.id })}
          name="coverKey"
          defaultPath={course.coverKey}
          currentSrc={course.coverKey ? `/api/covers/${course.id}?v=${course.coverKey.split("/").pop()}` : null}
          label={t("cover")}
          failedLabel={t("coverFailed")}
          removeLabel={t("coverRemove")}
        />
        <label className={check}>
          <input type="checkbox" name="published" defaultChecked={course.published} className="size-4" />
          {t("publishedHint")}
        </label>
        <label className={check}>
          <input type="checkbox" name="aiGrading" defaultChecked={course.aiGrading} className="size-4" />
          {t("aiGradingHint")}
        </label>
        <label className={check}>
          <input type="checkbox" name="aiAssistant" defaultChecked={course.aiAssistant} className="size-4" />
          {t("aiAssistantHint")}
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className={label}>
            {t("maxPlays")}
            <input name="maxPlays" type="number" min="1" max="1000" step="1" defaultValue={course.maxPlays ?? ""} dir="ltr" className={`${field} num`} />
          </label>
          <label className={label}>
            {t("maxIps")}
            <input name="maxIps" type="number" min="1" max="50" step="1" defaultValue={course.maxIps ?? ""} dir="ltr" className={`${field} num`} />
          </label>
          <label className={label}>
            {t("maxDevices")}
            <input name="maxDevices" type="number" min="1" max="20" step="1" defaultValue={course.maxDevices ?? ""} dir="ltr" className={`${field} num`} />
          </label>
        </div>
        <p className="text-label text-ink-muted">{t("limitsHint")}</p>
        <div>
          <SaveButton />
        </div>
      </form>

      {isAdmin && (
        <form key={`teacher:${renderedAt}`} action={setTeacher} className={`${card} sm:grid-cols-[1fr_auto] sm:items-end`}>
          <input type="hidden" name="id" value={course.id} />
          <label className={label}>
            {t("teacher")}
            <select name="instructorId" defaultValue={course.instructorId} className={field}>
              {teachers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
          <SaveButton>{t("saveTeacher")}</SaveButton>
        </form>
      )}

      <section className="grid gap-4">
        <h2 className="font-display text-h2 font-semibold">{t("units")}</h2>
        {course.units.map((u) => (
          <div key={u.id} className={card}>
            <form action={updateUnit} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
              <input type="hidden" name="id" value={u.id} />
              <label className={label}>
                {t("titleAr")}
                <input name="titleAr" defaultValue={u.titleAr} required dir="rtl" className={field} />
              </label>
              <label className={label}>
                {t("titleEn")}
                <input name="titleEn" defaultValue={u.titleEn} required dir="ltr" className={field} />
              </label>
              <label className={label}>
                {t("term")}
                <select name="term" defaultValue={u.term} className={field}>
                  {numbers(1, 2).map((n) => (
                    <option key={n} value={n}>
                      {tc("plans.termN", { n })}
                    </option>
                  ))}
                </select>
              </label>
              <label className={label}>
                {t("unitMonth")}
                <select name="month" defaultValue="" className={field}>
                  <option value="">{t("keepMonths")}</option>
                  {numbers(1, 12).map((n) => (
                    <option key={n} value={n}>
                      {tc("plans.monthN", { n })}
                    </option>
                  ))}
                </select>
              </label>
              <SaveButton />
            </form>
            {otherCourses.length > 0 && (
              <form action={copyUnit} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="unitId" value={u.id} />
                <label className={label}>
                  {t("copyUnitTo")}
                  <select name="courseId" className={field}>
                    {otherCourses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {pick(locale === "ar", c.titleAr, c.titleEn)}
                      </option>
                    ))}
                  </select>
                </label>
                <SaveButton>{t("copyUnit")}</SaveButton>
              </form>
            )}

            {u.lessons.map((l) => (
              <form key={`${l.id}:${renderedAt}`} action={updateLesson} className={tile}>
                <input type="hidden" name="id" value={l.id} />
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className={label}>
                    {t("titleAr")}
                    <input name="titleAr" defaultValue={l.titleAr} required dir="rtl" className={field} />
                  </label>
                  <label className={label}>
                    {t("titleEn")}
                    <input name="titleEn" defaultValue={l.titleEn} required dir="ltr" className={field} />
                  </label>
                  <label className={label}>
                    {t("kind")}
                    <select name="kind" defaultValue={l.kind} className={field}>
                      {(["VIDEO", "EXAM_STRUCTURE", "PAST_QUESTIONS", "PDF"] as const).map((k) => (
                        <option key={k} value={k}>
                          {tc(`kind.${k}`)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <KindOnly kinds={["VIDEO"]} savedKind={l.kind}>
                <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
                  <label className={label}>
                    {t("videoSource")}
                    <select name="provider" defaultValue={l.video?.provider ?? ""} className={field}>
                      <option value="">{t("noVideo")}</option>
                      <option value="VDOCIPHER">{t("vdocipher")}</option>
                      <option value="YOUTUBE">{t("youtube")}</option>
                    </select>
                  </label>
                  <label className={label}>
                    {t("videoId")}
                    <input name="externalId" defaultValue={l.video?.externalId ?? ""} dir="ltr" className={field} />
                  </label>
                </div>
                <VdoUpload title={`${course.titleEn} · ${l.titleEn}`} labels={{ pick: t("uploadPick"), sending: t("uploading"), done: t("uploadDone"), failed: t("uploadFailed") }} />
                </KindOnly>
                <KindOnly kinds={["EXAM_STRUCTURE", "PAST_QUESTIONS"]} savedKind={l.kind}>
                  <p className="text-small text-ink-muted">
                    {t("questionsKindHint")}{" "}
                    <Link href={`/admin/courses/${course.id}/questions`} className="text-pen underline underline-offset-4">{t("openQuestions")}</Link>
                  </p>
                </KindOnly>
                <PdfUpload
                    courseId={course.id}
                    savedKind={l.kind}
                    defaultPages={l.pdfPages}
                    labels={{ pick: t("pdfPick"), sending: t("pdfSending"), done: t("pdfDone"), failed: t("pdfFailed"), pages: t("pdfPages") }}
                  />
                <label className={label}>
                  {t("lessonNotes")}
                  <textarea name="notes" defaultValue={l.notes ?? ""} rows={4} maxLength={20000} dir="auto" className={`${field} py-2`} />
                  <span className="text-label font-normal text-ink-muted">{t("lessonNotesHint")}</span>
                </label>
                <Link href={`/courses/${course.slug}/lessons/${l.id}`} className="link-tap w-fit text-small text-pen underline underline-offset-4">
                  {t("viewLesson")}
                </Link>
                <label className={label}>
                  {t("lessonMonth")}
                  <select name="month" defaultValue={l.month ?? ""} className={field}>
                    <option value="">{t("noMonth")}</option>
                    {numbers(1, 12).map((n) => (
                      <option key={n} value={n}>
                        {tc("plans.monthN", { n })}
                      </option>
                    ))}
                  </select>
                </label>
                {isAdmin && (
                  <label className={label}>
                    {t("lessonTeacher")}
                    <select name="instructorId" defaultValue={l.instructorId ?? ""} className={field}>
                      <option value="">{teachers.find((u) => u.id === course.instructorId)?.name}</option>
                      {teachers
                        .filter((u) => u.id !== course.instructorId)
                        .map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                    </select>
                  </label>
                )}
                <div className="flex flex-wrap gap-3">
                  <SaveButton />
                  <DeleteButton action={deleteLesson} />
                </div>
              </form>
            ))}

            <form action={addLesson}>
              <input type="hidden" name="unitId" value={u.id} />
              <SaveButton>{t("addLesson")}</SaveButton>
            </form>
          </div>
        ))}
        <form action={addUnit}>
          <input type="hidden" name="courseId" value={course.id} />
          <SaveButton>{t("addUnit")}</SaveButton>
        </form>
      </section>

      <section className="grid gap-4" id="live">
        <h2 className="font-display text-h2 font-semibold">{tl("courseSection")}</h2>
        <p className="text-small text-ink-muted">{tl("courseSectionHint")}</p>
        {liveError && (
          <p role="alert" className="text-small text-down">
            {liveError === "past" ? tl("pastError") : liveError === "link" ? tl("linkError") : liveError === "notApproved" ? tl("notApproved") : liveError === "noVideo" ? tl("noVideoError") : tl("noUnitError")}
          </p>
        )}
        {canLive ? (
          <form action={scheduleLive} className={card}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="courseId" value={course.id} />
            <input type="hidden" name="back" value="course" />
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={label}>
                {tl("titleAr")}
                <input name="titleAr" required maxLength={200} dir="rtl" className={field} />
              </label>
              <label className={label}>
                {tl("titleEn")}
                <input name="titleEn" required maxLength={200} dir="ltr" className={field} />
              </label>
              <label className={label}>
                {tl("startsAtIn", { zone: tl(`zone.${zone.split("/")[1]}`) })}
                <input name="startsAt" type="datetime-local" required dir="ltr" className={`${field} num`} />
              </label>
              <label className={label}>
                {tl("durationMin")}
                <input name="durationMin" type="number" min="15" max="300" step="5" defaultValue={60} required dir="ltr" className={`${field} num w-28`} />
              </label>
            </div>
            <label className={label}>
              {tl("meetingUrl")}
              <input name="meetingUrl" type="url" placeholder="https://…" dir="ltr" className={`${field} text-small`} />
              <span className="text-small text-ink-muted">{tl("meetingUrlHint")}</span>
            </label>
            <div>
              <SaveButton>{tl("scheduleCta")}</SaveButton>
            </div>
          </form>
        ) : (
          <p role="status" className="rounded-lg border border-hairline bg-raised p-4 text-small text-ink-muted">{tl("notApproved")}</p>
        )}
        {upcomingLive.map((x) => (
          <div key={x.id} className="flex flex-wrap items-center justify-between gap-3 rounded-sm bg-raised p-3 text-small">
            <span className="grid gap-1">
              <span className="font-semibold">{pick(locale === "ar", x.titleAr, x.titleEn)}</span>
              <span className="text-ink-muted">{formatWhen(x.startsAt, zone, locale)}</span>
            </span>
            <Link href="/teacher/live" className="link-tap font-semibold text-pen underline underline-offset-4">{tl("manageLive")}</Link>
          </div>
        ))}
        {pastLive.map((x) => (
          <form key={x.id} action={addRecording} className={tile}>
            <input type="hidden" name="id" value={x.id} />
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="provider" value="VDOCIPHER" />
            <input type="hidden" name="externalId" value="" />
            <span className="grid gap-1 text-small">
              <span className="font-semibold">{pick(locale === "ar", x.titleAr, x.titleEn)}</span>
              <span className="text-ink-muted">{formatWhen(x.startsAt, zone, locale)} · {tl("recordingHint")}</span>
            </span>
            <VdoUpload title={`${course.titleEn} · ${x.titleEn}`} labels={{ pick: t("uploadPick"), sending: t("uploading"), done: t("uploadDone"), failed: t("uploadFailed") }} />
            <div>
              <SaveButton>{tl("addRecording")}</SaveButton>
            </div>
          </form>
        ))}
      </section>

      <section className="grid gap-4">
        <h2 className="font-display text-h2 font-semibold">{t("packages")}</h2>
        <p className="max-w-[65ch] text-small text-ink-muted">{t("packagesHint")}</p>
          {packages.map((s) => (
            <form key={s.id} action={updateSku} className={card}>
              <input type="hidden" name="id" value={s.id} />
              <h3 className="font-display text-h3 font-semibold">{tc(`access.${s.accessType}`, { days: s.accessDays ?? 0 })}</h3>
              <div className="grid gap-3 sm:grid-cols-4">
                <PlanPrice
                  label={t("price", { currency: s.currency })}
                  defaultValue={s.price / minorPerUnit(s.currency)}
                  currency={s.currency}
                  locale={locale}
                  lectures={lecturesIn(course.units, s)}
                  single={single}
                />
                <label className={label}>
                  {t("aedPrice")}
                  <input
                    name="aedPrice"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={s.aedPrice != null ? s.aedPrice / minorPerUnit("AED") : ""}
                    dir="ltr"
                    className={`${field} num`}
                  />
                  {s.currency !== "AED" && (
                    <span className="flex items-center gap-2 text-label font-normal">
                      <input type="checkbox" name="useRate" className="size-4" />
                      {t("useRate")}
                    </span>
                  )}
                </label>
                {s.accessType === "SEMESTER" && (
                  <label className={label}>
                    {t("term")}
                    <select name="term" defaultValue={s.term ?? 1} className={field}>
                      {numbers(1, 2).map((n) => (
                        <option key={n} value={n}>
                          {tc("plans.termN", { n })}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {s.accessType === "MONTHLY" && (
                  <label className={label}>
                    {t("lessonMonth")}
                    <select name="month" defaultValue={s.month ?? 1} className={field}>
                      {numbers(1, 12).map((n) => (
                        <option key={n} value={n}>
                          {tc("plans.monthN", { n })}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label className={label}>
                  {t("accessDays")}
                  <input name="accessDays" type="number" min="1" max="3650" step="1" defaultValue={s.accessDays ?? 30} required dir="ltr" className={`${field} num`} />
                </label>
                <label className={label}>
                  {t("saleFrom")}
                  <input name="saleFrom" type="date" defaultValue={toDayInput(s.saleFrom, zone)} className={field} />
                </label>
                <label className={label}>
                  {t("saleTo")}
                  <input name="saleTo" type="date" defaultValue={toDayInput(s.saleTo, zone)} className={field} />
                </label>
                <label className={label}>
                  {t("discountPrice", { currency: s.currency })}
                  <input
                    name="discountPrice"
                    type="number"
                    min="0"
                    step="0.001"
                    defaultValue={s.discountPrice != null ? s.discountPrice / minorPerUnit(s.currency) : ""}
                    dir="ltr"
                    className={`${field} num`}
                  />
                </label>
                <label className={label}>
                  {t("discountFrom")}
                  <input name="discountFrom" type="date" defaultValue={toDayInput(s.discountFrom, zone)} className={field} />
                </label>
                <label className={label}>
                  {t("discountTo")}
                  <input name="discountTo" type="date" defaultValue={toDayInput(s.discountTo, zone)} className={field} />
                </label>
              </div>
              <p className="text-label text-ink-muted">{t("discountHint")}</p>
              <p className="text-label text-ink-muted">{t("aedHint")}</p>
              <label className={check}>
                <input type="checkbox" name="active" defaultChecked={s.active} className="size-4" />
                {t("activeHint")}
              </label>
              <div>
                <SaveButton />
              </div>
            </form>
          ))}
          <form action={addSku} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="courseId" value={course.id} />
            <label className={label}>
              {t("packageType")}
              <select name="accessType" className={field}>
                {packageTypes.map((a) => (
                  <option key={a} value={a}>
                    {a === "FIXED_DAYS" ? t("accessDays") : tc(`access.${a}`)}
                  </option>
                ))}
              </select>
            </label>
            <SaveButton>{t("addPackage")}</SaveButton>
          </form>
      </section>

      <section className="grid gap-4">
        <h2 className="font-display text-h2 font-semibold">{t("rentals")}</h2>
          <p className="max-w-[65ch] text-small text-ink-muted">{t("rentalsHint")}</p>
          {course.units
            .filter((u) => !u.isFree)
            .map((u) => (
              <div key={u.id} className={card}>
                <h3 className="font-display text-h3 font-semibold">{pick(locale === "ar", u.titleAr, u.titleEn)}</h3>
                {u.lessons.map((l) => {
                  const s = rentalOf.get(l.id);
                  const title = <span className="font-semibold">{pick(locale === "ar", l.titleAr, l.titleEn)}</span>;
                  return s ? (
                    <form key={`${s.id}:${renderedAt}`} action={updateSku} className={`${tile} sm:grid-cols-[1fr_auto_auto_auto_auto_auto] sm:items-end`}>
                      <input type="hidden" name="id" value={s.id} />
                      <input type="hidden" name="saleFrom" value="" />
                      <input type="hidden" name="saleTo" value="" />
                      {title}
                      <label className={label}>
                        {t("price", { currency: s.currency })}
                        <input name="price" type="number" min="0" step="0.01" defaultValue={s.price / minorPerUnit(s.currency)} required dir="ltr" className={`${field} num w-28`} />
                      </label>
                      <label className={label}>
                        {t("aedPrice")}
                        <input
                          name="aedPrice"
                          type="number"
                          min="0"
                          step="0.01"
                          defaultValue={s.aedPrice != null ? s.aedPrice / minorPerUnit("AED") : ""}
                          dir="ltr"
                          className={`${field} num w-28`}
                        />
                        {s.currency !== "AED" && (
                          <span className="flex items-center gap-2 text-label font-normal">
                            <input type="checkbox" name="useRate" className="size-4" />
                            {t("useRate")}
                          </span>
                        )}
                      </label>
                      <label className={label}>
                        {t("accessDays")}
                        <input name="accessDays" type="number" min="1" max="365" step="1" defaultValue={s.accessDays ?? 7} required dir="ltr" className={`${field} num w-20`} />
                      </label>
                      <label className={`${check} min-h-11`}>
                        <input type="checkbox" name="active" defaultChecked={s.active} className="size-4" />
                        {t("rentalOn")}
                      </label>
                      <SaveButton />
                    </form>
                  ) : (
                    <form key={l.id} action={addRental} className={`${tile} sm:grid-cols-[1fr_auto] sm:items-center`}>
                      <input type="hidden" name="lessonId" value={l.id} />
                      {title}
                      <SaveButton>{t("addRental")}</SaveButton>
                    </form>
                  );
                })}
              </div>
            ))}
      </section>

      <section className={card}>
        <h2 className="font-display text-h2 font-semibold">{t("deleteCourse")}</h2>
        <p className="max-w-[65ch] text-small text-ink-muted">{t("deleteCourseHint")}</p>
        <form>
          <input type="hidden" name="id" value={course.id} />
          <input type="hidden" name="locale" value={locale} />
          <DeleteButton
            action={deleteCourse}
            label={t("deleteCourse")}
            confirmText={t("confirmDeleteCourse", { title: pick(locale === "ar", course.titleAr, course.titleEn) })}
          />
        </form>
      </section>
    </main>
  );
}
