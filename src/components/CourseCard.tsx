import { useTranslations } from "next-intl";
import { pick } from "@/lib/content";
import { SubjectIcon } from "@/components/brand/SubjectIcon";
import { Link } from "@/i18n/navigation";
import type { cardInclude } from "@/lib/catalog";
import { formatMoney } from "@/lib/format";
import { canCharge } from "@/lib/gateway";
import { cheapestSku, discountPercent, effectivePrice } from "@/lib/pricing-engine";
import type { Prisma } from "@/generated/prisma/client";

export type CardCourse = Prisma.CourseGetPayload<{ include: ReturnType<typeof cardInclude> }>;

/** Course card: the cover, a trail in its country's colour, the grade, the title and teacher, then the price. */
export function CourseCard({ course: c, locale }: { course: CardCourse; locale: string }) {
  const t = useTranslations("catalog");
  const ar = locale === "ar";
  const now = new Date();
  const from = cheapestSku(c.skus, now);
  // Only a sale the SKU really carries right now; never a made-up "was" price.
  const off = from ? discountPercent(from, now) : null;
  const sessions = c.units.reduce((n, u) => n + u._count.lessons, 0);
  const line = c.grade ? `var(--color-line-${c.grade.country.code.toLowerCase()}, var(--color-primary))` : "var(--color-primary)";
  return (
    <Link href={`/courses/${c.slug}`} className="grid h-full grid-rows-[auto_auto_1fr_auto] overflow-hidden card hover-lift">
      {/* The picture headline: the teacher's cover, or the subject's icon on survey paper until one is uploaded. */}
      {c.coverKey ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/api/covers/${c.id}?v=${c.coverKey.split("/").pop()}`} alt="" width={640} height={360} loading="lazy" decoding="async" className="aspect-[16/9] w-full object-cover" />
      ) : (
        <span aria-hidden="true" className="grid aspect-[16/9] w-full place-items-center bg-raised">
          <SubjectIcon icon={c.subject?.icon ?? "book"} size={56} muted />
        </span>
      )}
      {/* The country's trail along the cover's foot. Not mirrored: a map is never flipped. */}
      <svg aria-hidden="true" viewBox="0 0 240 12" preserveAspectRatio="none" className="-mt-1.5 h-3 w-full">
        <path d="M0 9C40 8 70 3 120 4S200 10 240 6" fill="none" strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" style={{ stroke: line }} />
      </svg>
      <span className="grid content-start gap-1.5 px-5 pt-3 pb-4">
        <span className="flex items-center gap-2 text-small text-ink-muted">
          <i aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ background: line }} />
          {c.grade ? pick(ar, c.grade.nameAr, c.grade.nameEn) : t("skill")}
        </span>
        <span className="line-clamp-2 min-w-0 font-display text-h3 font-bold">{pick(ar, c.titleAr, c.titleEn)}</span>
        {pick(ar, c.headlineAr, c.headlineEn) && <span className="line-clamp-2 text-small text-ink-muted">{pick(ar, c.headlineAr, c.headlineEn)}</span>}
        <span className="mt-1 flex flex-wrap gap-x-3 text-small">
          <span className="font-semibold">{c.instructor.name}</span>
          {sessions > 0 && <span className="text-ink-muted">{t("sessions", { count: sessions })}</span>}
        </span>
      </span>
      {from && (
        <span className="mx-5 mb-5 flex flex-wrap items-end justify-between gap-2 border-t border-hairline pt-3">
          <span className="grid gap-0.5">
            <span className="text-label text-ink-muted">
              {from.accessDays ? t("access.FIXED_DAYS", { days: from.accessDays }) : t("from")}
            </span>
            <span className="flex flex-wrap items-baseline gap-2">
              <span className="num font-display text-h2 leading-none font-bold">{formatMoney(effectivePrice(from, now), from.currency, locale)}</span>
              {off !== null && <s className="num text-small text-ink-muted">{formatMoney(from.price, from.currency, locale)}</s>}
            </span>
            {!canCharge(from.currency) && <span className="text-label text-ink-muted">{t("paySoon")}</span>}
          </span>
          {off !== null && (
            <span className="rounded-full bg-marker px-2.5 py-0.5 text-label font-bold text-ink">{t("percentOff", { pct: off })}</span>
          )}
        </span>
      )}
    </Link>
  );
}
