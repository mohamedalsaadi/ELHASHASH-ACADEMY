import Image from "next/image";
import { useTranslations } from "next-intl";
import { StatusChip } from "@/components/ui/StatusChip";
import type { Rating } from "@/lib/reviews";
import { pick } from "@/lib/content";
import { SubjectIcon } from "@/components/brand/SubjectIcon";
import { Link } from "@/i18n/navigation";
import type { cardInclude } from "@/lib/catalog";
import { formatMoney } from "@/lib/format";
import { canCharge } from "@/lib/gateway";
import { aedPriceOf, cheapestSku, discountPercent, effectivePrice } from "@/lib/pricing-engine";
import type { Prisma } from "@/generated/prisma/client";

export type CardCourse = Prisma.CourseGetPayload<{ include: ReturnType<typeof cardInclude> }>;

/**
 * Course card: the cover, the grade with its country's colour, the title and teacher, then the price.
 * `owned` is only passed on the student home: true marks a course the student has, false one they have not
 * (grey cover that lights up on hover or tap, dashed edge, a lock chip), so state shows by shape and word, not colour alone.
 * `rating` is a real average of published reviews, passed only when there are enough of them.
 */
export function CourseCard({ course: c, locale, owned, rating }: { course: CardCourse; locale: string; owned?: boolean; rating?: Rating | null }) {
  const t = useTranslations("catalog");
  const tr = useTranslations("reviews");
  const locked = owned === false;
  const ar = locale === "ar";
  const now = new Date();
  const from = cheapestSku(c.skus, now);
  // Only a sale the SKU really carries right now; never a made-up "was" price.
  const off = from ? discountPercent(from, now) : null;
  // Model 1: every market is charged in AED. A non-AED package needs an explicit AED price.
  const aed = from ? aedPriceOf(from, now) : null;
  const buyable = canCharge("AED") && aed != null;
  const sessions = c.units.reduce((n, u) => n + u._count.lessons, 0);
  const line = c.grade ? `var(--color-line-${c.grade.country.code.toLowerCase()}, var(--color-primary))` : "var(--color-primary)";
  return (
    <Link href={`/courses/${c.slug}`} className={`group grid h-full grid-rows-[auto_1fr_auto] overflow-hidden card hover-lift ${locked ? "border-dashed" : ""}`}>
      {/* The picture headline: the teacher's cover, or the subject's icon until one is uploaded. */}
      {c.coverKey && locked ? (
        <span className="relative block aspect-[16/9] w-full">
          {/* Two layers: the colour picture underneath, a grey copy on top that fades away on hover, focus or tap. */}
          <Image src={`/api/covers/${c.id}?v=${c.coverKey.split("/").pop()}`} alt="" fill sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw" className="object-cover" />
          <Image src={`/api/covers/${c.id}?v=${c.coverKey.split("/").pop()}`} alt="" fill sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw" className="object-cover grayscale transition-opacity duration-(--dur-fast) ease-(--ease-out) group-hover:opacity-0 group-focus-visible:opacity-0 group-active:opacity-0" />
        </span>
      ) : c.coverKey ? (
        <span className="relative block aspect-[16/9] w-full">
          <Image src={`/api/covers/${c.id}?v=${c.coverKey.split("/").pop()}`} alt="" fill sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw" className="object-cover" />
        </span>
      ) : (
        <span aria-hidden="true" className="grid aspect-[16/9] w-full place-items-center bg-raised">
          <SubjectIcon icon={c.subject?.icon ?? "book"} size={56} muted />
        </span>
      )}
      <span className="grid content-start gap-1.5 px-5 pt-4 pb-4">
        <span className="flex items-center gap-2 text-small text-ink-muted">
          <i aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ background: line }} />
          {c.grade ? pick(ar, c.grade.nameAr, c.grade.nameEn) : t("skill")}
          {owned !== undefined && (
            <StatusChip tone={locked ? "locked" : "active"} className="ms-auto">
              {locked ? t("lockedChip") : t("ownedChip")}
            </StatusChip>
          )}
        </span>
        <span className="line-clamp-2 min-w-0 font-display text-h3 font-bold">{pick(ar, c.titleAr, c.titleEn)}</span>
        {pick(ar, c.headlineAr, c.headlineEn) && <span className="line-clamp-2 text-small text-ink-muted">{pick(ar, c.headlineAr, c.headlineEn)}</span>}
        <span className="mt-1 flex flex-wrap gap-x-3 text-small">
          <span className="font-semibold">{c.instructor.name}</span>
          {sessions > 0 && <span className="text-ink-muted">{t("sessions", { count: sessions })}</span>}
          {rating && <span className="num text-ink-muted">{tr("ratingLine", { avg: String(rating.avg), count: String(rating.count) })}</span>}
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
            {!buyable && <span className="text-label text-ink-muted">{t("paySoon")}</span>}
            {aed != null && aed !== effectivePrice(from, now) && (
              <span className="text-label text-ink-muted">{t("chargedInAed", { price: formatMoney(aed, "AED", locale) })}</span>
            )}
          </span>
          {off !== null && (
            <span className="rounded-full bg-marker px-2.5 py-0.5 text-label font-bold text-on-summit">{t("percentOff", { pct: off })}</span>
          )}
        </span>
      )}
    </Link>
  );
}
