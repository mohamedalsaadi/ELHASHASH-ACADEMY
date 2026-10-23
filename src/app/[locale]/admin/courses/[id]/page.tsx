import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { toDayInput } from "@/lib/admin-input";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/staff";
import { addLesson, addSku, addUnit, deleteLesson, updateCourse, updateLesson, updateSku, updateUnit } from "../../actions";
import { field, label } from "../../styles";
import { DeleteButton, SaveButton } from "../../ui";

export const dynamic = "force-dynamic";

const card = "grid gap-4 rounded-md border border-hairline bg-surface p-4";
const tile = "grid gap-3 rounded-sm bg-raised p-3";
const check = "flex items-center gap-2 text-small";

export default async function AdminCoursePage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireStaff();
  const t = await getTranslations("admin");
  const tc = await getTranslations("catalog");

  const course = await db.course.findUnique({
    where: { id },
    include: {
      units: { orderBy: { order: "asc" }, include: { lessons: { orderBy: { order: "asc" }, include: { video: true } } } },
      skus: { orderBy: { accessType: "asc" } },
    },
  });
  if (!course) notFound();
  // React resets a form after its action runs, and a reset <select> falls back to its first option.
  // A key that changes on every render remounts lesson forms with the saved values instead.
  const renderedAt = Date.now();

  return (
    <main className="mx-auto grid max-w-4xl gap-10 px-4 py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/admin" className="text-small text-ink-muted hover:text-ink">
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

      <section className="grid gap-4">
        <h2 className="font-display text-h2 font-semibold">{t("packages")}</h2>
        <p className="max-w-[65ch] text-small text-ink-muted">{t("packagesHint")}</p>
        {course.skus.map((s) => (
          <form key={s.id} action={updateSku} className={card}>
            <input type="hidden" name="id" value={s.id} />
            <h3 className="font-display text-h3 font-semibold">{tc(`access.${s.accessType}`)}</h3>
            <div className="grid gap-3 sm:grid-cols-4">
              <label className={label}>
                {t("price", { currency: s.currency })}
                <input name="price" type="number" min="0" step="0.01" defaultValue={s.price / 100} required dir="ltr" className={`${field} num`} />
              </label>
              <label className={label}>
                {t("accessEndsAt")}
                <input name="accessEndsAt" type="date" defaultValue={toDayInput(s.accessEndsAt)} className={field} />
              </label>
              <label className={label}>
                {t("saleFrom")}
                <input name="saleFrom" type="date" defaultValue={toDayInput(s.saleFrom)} className={field} />
              </label>
              <label className={label}>
                {t("saleTo")}
                <input name="saleTo" type="date" defaultValue={toDayInput(s.saleTo)} className={field} />
              </label>
            </div>
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
              {(["SEMESTER", "YEARLY", "REVISION"] as const).map((a) => (
                <option key={a} value={a}>
                  {tc(`access.${a}`)}
                </option>
              ))}
            </select>
          </label>
          <SaveButton>{t("addPackage")}</SaveButton>
        </form>
      </section>
    </main>
  );
}
