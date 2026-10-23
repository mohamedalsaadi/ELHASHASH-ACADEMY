import { getLocale, getTranslations } from "next-intl/server";
import { auth, signOut } from "@/auth";
import { Link } from "@/i18n/navigation";
import { LocaleSwitch } from "@/components/LocaleSwitch";

const navItem =
  "rounded-sm px-3 py-2 font-display text-label transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-raised";

export async function SiteHeader() {
  const [t, locale, session] = await Promise.all([getTranslations("nav"), getLocale(), auth()]);
  const role = session?.user?.role;

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: `/${locale}` });
  }

  return (
    <header className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-hairline px-4 py-4">
      <Link href="/" className="font-display text-h3 font-bold tracking-wide">
        ELHASHASH <span className="text-amber">ACADEMY</span>
      </Link>
      <nav className="flex flex-wrap items-center gap-1">
        <Link href="/courses" className={navItem}>
          {t("courses")}
        </Link>
        {session?.user ? (
          <>
            <Link href="/dashboard" className={navItem}>
              {t("dashboard")}
            </Link>
            {(role === "ADMIN" || role === "INSTRUCTOR") && (
              <Link href="/admin" className={navItem}>
                {t("admin")}
              </Link>
            )}
            <form action={signOutAction}>
              <button className={`${navItem} text-ink-muted`}>{t("signOut")}</button>
            </form>
          </>
        ) : (
          <Link href="/signin" className={navItem}>
            {t("signIn")}
          </Link>
        )}
        <LocaleSwitch />
      </nav>
    </header>
  );
}
