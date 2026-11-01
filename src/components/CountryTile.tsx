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

/** A country as a line on the network: its line colour on top, its landmark and flag, its line sign, grades and currency. */
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
      {/* The country's colour as soft light in the corner, not a stripe. */}
      <span
        aria-hidden="true"
        className="absolute -end-16 -top-16 -z-10 size-44 rounded-full opacity-25 blur-2xl transition-opacity duration-(--dur-base) ease-(--ease-out) group-hover:opacity-45"
        style={{ background: `var(--color-line-${c.code.toLowerCase()}, var(--color-primary))` }}
      />
      <span className="flex items-start justify-between gap-3">
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
            {ar ? c.nameAr : c.nameEn}
          </span>
          <span className="flex flex-wrap gap-x-3 text-small text-ink-muted">
            <span>{t("gradeCount", { count: c._count.grades })}</span>
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
