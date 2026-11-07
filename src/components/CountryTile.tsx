import { pick } from "@/lib/content";
import { ArrowLeft, ArrowRight } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
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

/** A country: its flag, name, grade count and currency. Its colour shows on the sign and nowhere else. */
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
    <Link href={`/courses/c/${c.code.toLowerCase()}`} className="group card hover-lift flex h-full items-center gap-4 p-5">
      {KNOWN_COUNTRIES.has(c.code) ? (
        <Image src={`/flags/${c.code.toLowerCase()}.svg`} alt="" width={44} height={33} className="shrink-0 rounded-[4px] ring-1 ring-hairline" />
      ) : (
        <LineBadge code={c.code} />
      )}
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className="font-display text-h3 font-bold">{pick(ar, c.nameAr, c.nameEn)}</span>
        <span className="flex flex-wrap gap-x-3 text-small text-ink-muted">
          {c._count.grades > 0 && <span>{t("gradeCount", { count: c._count.grades })}</span>}
          <span className="num">{c.currency}</span>
        </span>
      </span>
      <Arrow
        aria-hidden="true"
        className="size-5 shrink-0 text-ink-muted transition-transform duration-(--dur-fast) ease-(--ease-out) group-hover:translate-x-1 rtl:group-hover:-translate-x-1"
      />
    </Link>
  );
}
