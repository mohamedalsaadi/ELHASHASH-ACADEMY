import { unstable_cache } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import type { Currency } from "@/lib/pricing-engine";

type Item = {
  kind: "course" | "discount" | "offer";
  id: string;
  at: number;
  titleAr: string;
  titleEn: string;
  href: string | null;
  price?: { was: number; now: number; currency: Currency };
};

const inWindow = (from: string, to: string, now: Date) => ({
  AND: [{ OR: [{ [from]: null }, { [from]: { lte: now } }] }, { OR: [{ [to]: null }, { [to]: { gt: now } }] }],
});

/** The five newest things in the catalogue: published courses, running discounts and owner offers, newest first. */
const latest = unstable_cache(
  async (): Promise<Item[]> => {
    const now = new Date();
    const [courses, skus, promos] = await Promise.all([
      db.course.findMany({ where: { published: true }, orderBy: { createdAt: "desc" }, take: 5, select: { id: true, slug: true, titleAr: true, titleEn: true, createdAt: true } }),
      db.sku.findMany({
        where: { active: true, discountPrice: { not: null }, course: { published: true }, ...inWindow("discountFrom", "discountTo", now) },
        orderBy: { discountFrom: "desc" },
        take: 20,
        select: { id: true, price: true, discountPrice: true, currency: true, discountFrom: true, course: { select: { id: true, slug: true, titleAr: true, titleEn: true, createdAt: true } } },
      }),
      db.promotion.findMany({
        where: { active: true, placement: "BAR", ...inWindow("startsAt", "endsAt", now) },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);
    // One discount per course: the deepest one.
    const best = new Map<string, (typeof skus)[number]>();
    for (const s of skus) {
      const cur = best.get(s.course.id);
      if (!cur || s.price - s.discountPrice! > cur.price - cur.discountPrice!) best.set(s.course.id, s);
    }
    const items: Item[] = [
      ...courses.map((c) => ({ kind: "course" as const, id: c.id, at: c.createdAt.getTime(), titleAr: c.titleAr, titleEn: c.titleEn, href: `/courses/${c.slug}` })),
      ...[...best.values()].map((s) => ({
        kind: "discount" as const,
        id: s.id,
        at: (s.discountFrom ?? s.course.createdAt).getTime(),
        titleAr: s.course.titleAr,
        titleEn: s.course.titleEn,
        href: `/courses/${s.course.slug}`,
        price: { was: s.price, now: s.discountPrice!, currency: s.currency as Currency },
      })),
      ...promos.map((p) => ({ kind: "offer" as const, id: p.id, at: (p.startsAt ?? p.createdAt).getTime(), titleAr: p.titleAr, titleEn: p.titleEn, href: p.href })),
    ];
    return items.sort((a, b) => b.at - a.at).slice(0, 5);
  },
  ["news-banner"],
  { revalidate: 300 },
);

/** A static strip above the header. No autoplay or marquee: on a phone the row scrolls sideways under the finger. */
export async function NewsBanner() {
  const items = await latest();
  if (!items.length) return null;
  const [t, locale] = await Promise.all([getTranslations("news"), getLocale()]);
  const ar = locale === "ar";
  return (
    <aside aria-label={t("label")} className="bg-night text-night-text">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4">
        <span className="shrink-0 bg-marker px-2 py-1 font-display text-label font-bold text-ink">{t("label")}</span>
        <ul className="flex snap-x gap-6 overflow-x-auto text-small [scrollbar-width:none]">
          {items.map((it) => {
            const body = (
              <>
                <span className="text-night-muted">{t(it.kind)}</span>
                <span className="font-semibold">{ar ? it.titleAr : it.titleEn}</span>
                {it.price && (
                  <span className="num">
                    <s className="text-night-muted">{formatMoney(it.price.was, it.price.currency, locale)}</s>{" "}
                    <span className="text-marker">{formatMoney(it.price.now, it.price.currency, locale)}</span>
                  </span>
                )}
              </>
            );
            const cls = "flex min-h-11 shrink-0 snap-start items-center gap-2 whitespace-nowrap";
            return (
              <li key={`${it.kind}-${it.id}`} className="shrink-0">
                {!it.href ? (
                  <span className={cls}>{body}</span>
                ) : it.href.startsWith("/") ? (
                  <Link href={it.href} className={`${cls} underline-offset-4 hover:underline`}>{body}</Link>
                ) : (
                  <a href={it.href} target="_blank" rel="noopener noreferrer" className={`${cls} underline-offset-4 hover:underline`}>{body}</a>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
