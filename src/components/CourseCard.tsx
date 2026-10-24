import { useTranslations } from "next-intl";
import { TeacherPhoto } from "@/components/TeacherPhoto";
import { Link } from "@/i18n/navigation";
import type { cardInclude } from "@/lib/catalog";
import { formatMoney } from "@/lib/format";
import type { Prisma } from "@/generated/prisma/client";

export type CardCourse = Prisma.CourseGetPayload<{ include: ReturnType<typeof cardInclude> }>;

/** Course card: a navy header band like the top of an exam paper, then teacher and price. */
export function CourseCard({ course: c, locale }: { course: CardCourse; locale: string }) {
  const t = useTranslations("catalog");
  const ar = locale === "ar";
  const from = c.skus[0];
  return (
    <Link
      href={`/courses/${c.slug}`}
      className="grid h-full grid-rows-[auto_1fr] overflow-hidden rounded-lg border border-hairline bg-surface shadow-paper transition-transform duration-(--dur-fast) ease-(--ease-out) hover:-translate-y-0.5"
    >
      <span className="grid content-start gap-1 bg-primary p-5 text-on-primary">
        {c.units.length > 0 && (
          <span className="mb-1 justify-self-start rounded-full bg-marker px-2.5 py-0.5 text-label font-semibold text-ink">{t("freeUnit")}</span>
        )}
        <span className="text-small opacity-80">{c.grade ? (ar ? c.grade.nameAr : c.grade.nameEn) : t("skill")}</span>
        <span className="font-display text-h3 font-extrabold">{ar ? c.titleAr : c.titleEn}</span>
      </span>
      <span className="grid content-between gap-4 p-5">
        <span className="flex items-center gap-3">
          <TeacherPhoto name={c.instructor.name} url={c.instructor.photoUrl} size={36} />
          <span className="text-small">{t("teacher", { name: c.instructor.name })}</span>
        </span>
        {from && (
          <span className="flex flex-wrap items-baseline justify-between gap-2 border-t border-dashed border-rule pt-3">
            <span className="text-small text-ink-muted">
              {from.accessDays ? t("access.FIXED_DAYS", { days: from.accessDays }) : t("from")}
            </span>
            <span className="num font-display text-h3 font-bold">{formatMoney(from.price, from.currency, locale)}</span>
          </span>
        )}
      </span>
    </Link>
  );
}
