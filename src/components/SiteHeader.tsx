import { getLocale, getTranslations } from "next-intl/server";
import { auth, signOut } from "@/auth";
import { Link } from "@/i18n/navigation";
import { LocaleSwitch } from "@/components/LocaleSwitch";
import { Wordmark } from "@/components/brand/Mark";
import { db } from "@/lib/db";

const navItem =
  "rounded-sm px-3 py-2 font-display text-small font-medium transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-raised";

export async function SiteHeader() {
  const [t, locale, session] = await Promise.all([
    getTranslations("nav"),
    getLocale(),
    auth(),
  ]);
  const role = session?.user?.role;
  const unread = session?.user ? await db.notification.count({ where: { userId: session.user.id, readAt: null } }) : 0;

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: `/${locale}` });
  }

  return (
    <header className="border-b border-hairline bg-surface">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
        <Link href="/" className="flex items-center rounded-sm py-1 text-ink">
          <Wordmark locale={locale} className="text-[1.65rem]" />
        </Link>
        <nav className="flex flex-wrap items-center gap-1">
          <Link href="/courses" className={navItem}>
            {t("courses")}
          </Link>
          {session?.user ? (
            <>
              {role !== "INSTRUCTOR" && role !== "PARENT" && (
                <Link href="/dashboard" className={navItem}>
                  {t("dashboard")}
                </Link>
              )}
              {role === "PARENT" && (
                <Link href="/parent" className={navItem}>
                  {t("parent")}
                </Link>
              )}
              {role === "ADMIN" && (
                <Link href="/admin" className={navItem}>
                  {t("admin")}
                </Link>
              )}
              {role === "INSTRUCTOR" && (
                <Link href="/teacher" className={navItem}>
                  {t("teacher")}
                </Link>
              )}
              <Link href="/notifications" className={navItem}>
                {t("notifications")}
                {unread > 0 && (
                  <span className="ms-1 rounded-full bg-down px-1.5 py-0.5 text-label font-semibold text-on-primary">{unread}</span>
                )}
              </Link>
              <Link href="/account" className={navItem}>
                {t("account")}
              </Link>
              <form action={signOutAction}>
                <button className={`${navItem} text-ink-muted`}>
                  {t("signOut")}
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/signin" className={navItem}>
                {t("signIn")}
              </Link>
              <Link
                href="/signup"
                className="rounded-sm bg-primary px-4 py-2 font-display text-small font-semibold text-on-primary transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-[color-mix(in_oklab,var(--color-primary)_86%,#fff)]"
              >
                {t("signUp")}
              </Link>
            </>
          )}
          <LocaleSwitch />
        </nav>
      </div>
    </header>
  );
}
