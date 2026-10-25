import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { toDayInput } from "@/lib/admin-input";
import { db } from "@/lib/db";
import { minorPerUnit } from "@/lib/format";
import { lecturesIn } from "@/lib/plans";
import { assertCourse, requireStaff } from "@/lib/staff";
import { addLesson, addRental, addSku, addUnit, deleteLesson, setTeacher, updateCourse, updateLesson, updateSku, updateUnit } from "../../actions";
import { field, label } from "../../styles";
import { DeleteButton, PlanPrice, SaveButton } from "../../ui";

export const dynamic = "force-dynamic";

const card = "grid gap-4 rounded-md border border-hairline bg-surface p-4";
const tile = "grid gap-3 rounded-sm bg-raised p-3";
const check = "flex items-center gap-2 text-small";

export default async function AdminCoursePage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const me = await requireStaff();
  await assertCourse(me, id);
  const isAdmin = me.role === "ADMIN";
  const t = await getTranslations("admin");
  const tc = await getTranslations("catalog");

  const course = await db.course.findUnique({
    where: { id },
    include: {
      grade: { include: { country: true } },
      units: { orderBy: { order: "asc" }, include: { lessons: { orderBy: { order: "asc" }, include: { video: true } } } },
      skus: { orderBy: { accessType: "asc" } },
    },
  });
  if (!course) notFound();
  const zone = course.grade?.country.timeZone ?? "Asia/Dubai";
  const teachers = isAdmin
    ? await db.user.findMany({ where: { role: { in: ["INSTRUCTOR", "ADMIN"] } }, orderBy: { name: "asc" }, select: { id: true, name: true } })
    : [];
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
        <Link href={isAdmin ? "/admin/courses" : "/teacher"} className="text-small text-ink-muted hover:text-ink">
          {t("back")}
        </Link>
        <Link href={`/courses/${course.slug}`} className="text-small text-ink-muted hover:text-ink">
          {t("viewPage")}
        </Link>
      </div>

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
            {t("descAr")}
            <textarea name="descAr" defaultValue={course.descAr ?? ""} rows={3} dir="rtl" className={`${field} py-2`} />
          </label>
          <label className={label}>
            {t("descEn")}
            <textarea name="descEn" defaultValue={course.descEn ?? ""} rows={3} dir="ltr" className={`${field} py-2`} />
          </label>
        </div>
        <label className={check}>
          <input type="checkbox" name="published" defaultChecked={course.published} className="size-4" />
          {t("publishedHint")}
        </label>
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
              <label className={`${check} min-h-11`}>
                <input type="checkbox" name="isFree" defaultChecked={u.isFree} className="size-4" />
                {t("freeUnit")}
              </label>
              <SaveButton />
            </form>

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

      {isAdmin && (
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
                {s.accessType === "FIXED_DAYS" || s.accessType === "MONTHLY" ? (
                  <label className={label}>
                    {t("accessDays")}
                    <input name="accessDays" type="number" min="1" max="3650" step="1" defaultValue={s.accessDays ?? 30} required dir="ltr" className={`${field} num`} />
                  </label>
                ) : (
                  <label className={label}>
                    {t("accessEndsAt")}
                    <input name="accessEndsAt" type="date" defaultValue={toDayInput(s.accessEndsAt, zone)} className={field} />
                  </label>
                )}
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
      )}

      {isAdmin && (
        <section className="grid gap-4">
          <h2 className="font-display text-h2 font-semibold">{t("rentals")}</h2>
          <p className="max-w-[65ch] text-small text-ink-muted">{t("rentalsHint")}</p>
          {course.units
            .filter((u) => !u.isFree)
            .map((u) => (
              <div key={u.id} className={card}>
                <h3 className="font-display text-h3 font-semibold">{locale === "ar" ? u.titleAr : u.titleEn}</h3>
                {u.lessons.map((l) => {
                  const s = rentalOf.get(l.id);
                  const title = <span className="font-semibold">{locale === "ar" ? l.titleAr : l.titleEn}</span>;
                  return s ? (
                    <form key={`${s.id}:${renderedAt}`} action={updateSku} className={`${tile} sm:grid-cols-[1fr_auto_auto_auto_auto] sm:items-end`}>
                      <input type="hidden" name="id" value={s.id} />
                      <input type="hidden" name="saleFrom" value="" />
                      <input type="hidden" name="saleTo" value="" />
                      {title}
                      <label className={label}>
                        {t("price", { currency: s.currency })}
                        <input name="price" type="number" min="0" step="0.01" defaultValue={s.price / minorPerUnit(s.currency)} required dir="ltr" className={`${field} num w-28`} />
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
      )}
    </main>
  );
}
