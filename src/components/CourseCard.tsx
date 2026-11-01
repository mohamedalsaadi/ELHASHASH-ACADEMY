import { useTranslations } from "next-intl";
import { SubjectIcon } from "@/components/brand/SubjectIcon";
import { Link } from "@/i18n/navigation";
import type { cardInclude } from "@/lib/catalog";
import { formatMoney } from "@/lib/format";
import { cheapestSku, discountPercent, effectivePrice } from "@/lib/pricing-engine";
import type { Prisma } from "@/generated/prisma/client";

export type CardCourse = Prisma.CourseGetPayload<{ include: ReturnType<typeof cardInclude> }>;

/** Course card: topped by its country's line colour (ink for skill courses), then the title, then the price. */
export function CourseCard({ course: c, locale }: { course: CardCourse; locale: string }) {
  const t = useTranslations("catalog");
  const ar = locale === "ar";
  const now = new Date();
  const from = cheapestSku(c.skus, now);
  const off = from ? discountPercent(from, now) : null;
  const sessions = c.units.reduce((n, u) => n + u._count.lessons, 0);
  return (
    <Link
      href={`/courses/${c.slug}`}
      className="grid h-full grid-rows-[auto_1fr] overflow-hidden border-2 border-ink bg-surface hover-lift"
    >
      {/* The picture headline: the teacher's cover, or the subject's icon on a plain panel until one is uploaded. */}
      {c.coverKey ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/api/covers/${c.id}?v=${c.coverKey.split("/").pop()}`} alt="" className="aspect-[16/9] w-full object-cover" />
      ) : (
        <span aria-hidden="true" className="grid aspect-[16/9] w-full place-items-center bg-raised text-ink-muted">
          <SubjectIcon icon={c.subject?.icon ?? "book"} size={56} muted />
        </span>
      )}
      <span
        className="grid content-start gap-1 border-t-(length:--line) p-5"
        style={{ borderColor: c.grade ? `var(--color-line-${c.grade.country.code.toLowerCase()}, var(--color-ink))` : "var(--color-ink)" }}
      >
        {c.units.some((u) => u.isFree) && (
          <span className="mb-1 justify-self-start bg-marker px-2 py-0.5 text-label font-bold text-ink">{t("freeUnit")}</span>
        )}
        <span className="text-small text-ink-muted">{c.grade ? (ar ? c.grade.nameAr : c.grade.nameEn) : t("skill")}</span>
        <span className="line-clamp-2 min-w-0 font-display text-h3 font-extrabold">{ar ? c.titleAr : c.titleEn}</span>
        {(ar ? c.headlineAr : c.headlineEn) && <span className="line-clamp-2 text-small text-ink-muted">{ar ? c.headlineAr : c.headlineEn}</span>}
        <span className="mt-1 flex flex-wrap gap-x-3 text-small">
          <span className="font-semibold">{c.instructor.name}</span>
          {sessions > 0 && <span className="text-ink-muted">{t("sessions", { count: sessions })}</span>}
        </span>
      </span>
      <span className="grid content-end gap-4 p-5">
        {from && (
          <span className="flex flex-wrap items-baseline justify-between gap-2 border-t border-dashed border-rule pt-3">
            <span className="text-small text-ink-muted">
              {from.accessDays ? t("access.FIXED_DAYS", { days: from.accessDays }) : t("from")}
            </span>
            <span className="flex flex-wrap items-baseline gap-2">
              {off !== null && <s className="num text-small text-ink-muted">{formatMoney(from.price, from.currency, locale)}</s>}
              <span className="num font-display text-h3 font-bold">{formatMoney(effectivePrice(from, now), from.currency, locale)}</span>
              {off !== null && (
                <span className="bg-marker px-2 py-0.5 text-label font-bold text-ink">{t("percentOff", { pct: off })}</span>
              )}
            </span>
          </span>
        )}
      </span>
    </Link>
  );
}
