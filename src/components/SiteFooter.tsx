import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export async function SiteFooter() {
  const t = await getTranslations("footer");
  return (
    <footer className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-hairline px-4 py-6 text-small text-ink-muted">
      <span>© {new Date().getFullYear()} {t("rights")}</span>
      <nav className="flex flex-wrap gap-x-5 gap-y-2">
        {(["terms", "refund", "contact"] as const).map((k) => (
          <Link key={k} href={`/${k}`} className="hover:text-ink">
            {t(k)}
          </Link>
        ))}
      </nav>
    </footer>
  );
}
