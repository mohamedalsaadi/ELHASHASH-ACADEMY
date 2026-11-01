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
      className="group grid h-full content-between gap-4 border-2 border-t-(length:--line) border-ink bg-surface p-4 transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-raised"
      style={{
        borderTopColor: `var(--color-line-${c.code.toLowerCase()}, var(--color-ink))`,
      }}
    >
      <span className="flex items-start justify-between gap-3">
        <Landmark code={c.code} size={56} />
        {KNOWN_COUNTRIES.has(c.code) && (
          <Image
            src={`/flags/${c.code.toLowerCase()}.svg`}
            alt=""
            width={36}
            height={27}
            className="ring-1 ring-hairline"
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
