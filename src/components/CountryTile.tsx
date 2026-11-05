import { pick } from "@/lib/content";
import { ArrowLeft, ArrowRight } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Landmark } from "@/components/brand/Landmark";
import { LineBadge } from "@/components/brand/Network";
import { Link } from "@/i18n/navigation";
import { KNOWN_COUNTRIES } from "@/lib/countries";

type Country = {
  code: string;
  nameAr: string;
  nameEn: string;
  currency: string;
  _count: { grades: number };
};

/** A country as a trail on the map: two contour lines and its trail in its own colour, its landmark and flag, its trail sign, grades and currency. */
export function CountryTile({
  country: c,
  locale,
}: {
  country: Country;
  locale: string;
}) {
  const t = useTranslations("catalog");
  const ar = locale === "ar";
  const Arrow = ar ? ArrowLeft : ArrowRight;
  return (
    <Link
      href={`/courses/c/${c.code.toLowerCase()}`}
      className="group relative isolate grid h-full content-between gap-5 overflow-hidden card p-5 hover-lift"
    >
      {/* Not mirrored: a map is never flipped. */}
      <svg
        aria-hidden="true"
        viewBox="0 0 240 48"
        preserveAspectRatio="none"
        className="absolute inset-x-0 top-0 -z-10 h-12 w-full"
      >
        <g fill="none" strokeLinecap="round">
          <path d="M0 30C50 28 80 14 130 13S210 22 240 20" className="stroke-contour-4" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
          <path d="M0 40C50 38 84 25 132 24S208 32 240 30" className="stroke-contour-4" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
          <path
            d="M0 46C40 44 70 30 110 26S190 10 240 4"
            strokeWidth="2.5"
            vectorEffect="non-scaling-stroke"
            style={{ stroke: `var(--color-line-${c.code.toLowerCase()}, var(--color-primary))` }}
          />
        </g>
      </svg>
      <span className="flex items-start justify-between gap-3 pt-4">
        <Landmark code={c.code} size={56} />
        {KNOWN_COUNTRIES.has(c.code) && (
          <Image
            src={`/flags/${c.code.toLowerCase()}.svg`}
            alt=""
            width={36}
            height={27}
            className="rounded-sm shadow-paper ring-1 ring-hairline"
          />
        )}
      </span>
      <span className="flex items-center gap-4">
        <LineBadge code={c.code} />
        <span className="grid min-w-0 flex-1 gap-0.5">
          <span className="font-display text-h3 font-bold">
            {pick(ar, c.nameAr, c.nameEn)}
          </span>
          <span className="flex flex-wrap gap-x-3 text-small text-ink-muted">
            {c._count.grades > 0 && <span>{t("gradeCount", { count: c._count.grades })}</span>}
            <span className="num">{c.currency}</span>
          </span>
        </span>
        <Arrow
          aria-hidden="true"
          className="size-5 shrink-0 text-ink-muted transition-transform duration-(--dur-fast) ease-(--ease-out) group-hover:translate-x-1 rtl:group-hover:-translate-x-1"
        />
      </span>
    </Link>
  );
}
