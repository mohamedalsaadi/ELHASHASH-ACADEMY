import Image from "next/image";
import { useTranslations } from "next-intl";
import { Landmark } from "@/components/brand/Landmark";
import { Link } from "@/i18n/navigation";
import { KNOWN_COUNTRIES } from "@/lib/countries";

type Country = {
  code: string;
  nameAr: string;
  nameEn: string;
  currency: string;
  _count: { grades: number };
};

/** A country in the catalog: its landmark drawn in pen, its flag as a badge, and the currency it pays in. */
export function CountryTile({ country: c, locale }: { country: Country; locale: string }) {
  const t = useTranslations("catalog");
  const ar = locale === "ar";
  return (
    <Link
      href={`/courses/c/${c.code.toLowerCase()}`}
      className="grid h-full content-between gap-4 rounded-lg border border-hairline bg-surface p-5 shadow-paper transition-transform duration-(--dur-fast) ease-(--ease-out) hover:-translate-y-0.5"
    >
      <span className="flex items-start justify-between gap-3">
        <Landmark code={c.code} size={72} />
        {KNOWN_COUNTRIES.has(c.code) ? (
          <Image src={`/flags/${c.code.toLowerCase()}.svg`} alt="" width={36} height={27} className="rounded-[3px] ring-1 ring-hairline" />
        ) : (
          <span aria-hidden="true" className="rounded-[3px] px-2 py-1 text-label font-semibold ring-1 ring-hairline">
            {c.code}
          </span>
        )}
      </span>
      <span className="grid gap-0.5">
        <span className="font-display text-h3 font-bold">{ar ? c.nameAr : c.nameEn}</span>
        {/* No letter-spacing on Arabic (DESIGN.md §4), so only the English second name is tracked. */}
        <span className={ar ? "text-label tracking-[.08em] text-ink-muted uppercase" : "text-small text-ink-muted"} lang={ar ? "en" : "ar"}>
          {ar ? c.nameEn : c.nameAr}
        </span>
      </span>
      <span className="flex justify-between border-t border-dashed border-rule pt-3 text-small">
        <span className="text-ink-muted">{t("gradeCount", { count: c._count.grades })}</span>
        <span className="num font-semibold">{c.currency}</span>
      </span>
    </Link>
  );
}
