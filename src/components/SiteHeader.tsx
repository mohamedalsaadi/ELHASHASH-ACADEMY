import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LocaleSwitch } from "@/components/LocaleSwitch";

export function SiteHeader() {
  const t = useTranslations("nav");
  return (
    <header className="mx-auto flex max-w-5xl items-center justify-between gap-4 border-b border-hairline px-4 py-4">
      <Link href="/" className="font-display text-h3 font-bold tracking-wide">
        ELHASHASH <span className="text-amber">ACADEMY</span>
      </Link>
      <nav className="flex items-center gap-2">
        <Link
          href="/courses"
          className="rounded-sm px-3 py-2 font-display text-label transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-raised"
        >
          {t("courses")}
        </Link>
        <LocaleSwitch />
      </nav>
    </header>
  );
}
