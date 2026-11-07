import { getLocale, getTranslations } from "next-intl/server";
import { auth, signOut } from "@/auth";
import { ActiveLink } from "@/components/ActiveLink";
import { LocaleSwitch } from "@/components/LocaleSwitch";
import { MobileNav } from "@/components/MobileNav";
import { TabBar } from "@/components/TabBar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Wordmark } from "@/components/brand/Mark";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";

const navItem =
  "inline-flex min-h-11 items-center rounded-full px-3 py-2 text-small font-medium text-ink-muted transition-colors duration-(--dur-fast) ease-(--ease-out) hover:text-ink aria-[current=page]:text-ink";

type NavItem = { href: string; label: string; badge?: number; primary?: boolean };

export async function SiteHeader() {
  const [t, locale, session] = await Promise.all([getTranslations("nav"), getLocale(), auth()]);
  const role = session?.user?.role;
  const unread = session?.user ? await db.notification.count({ where: { userId: session.user.id, readAt: null } }) : 0;

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: `/${locale}` });
  }

  const items: NavItem[] = [{ href: "/courses", label: t("courses") }];
  if (session?.user) {
    if (role !== "INSTRUCTOR" && role !== "PARENT") items.push({ href: "/dashboard", label: t("dashboard") });
    if (role === "PARENT") items.push({ href: "/parent", label: t("parent") });
    if (role === "ADMIN") items.push({ href: "/admin", label: t("admin") });
    if (role === "INSTRUCTOR") items.push({ href: "/teacher", label: t("teacher") });
    items.push({ href: "/notifications", label: t("notifications"), badge: unread }, { href: "/account", label: t("account") });
  } else {
    items.push({ href: "/signin", label: t("signIn") }, { href: "/signup", label: t("signUp"), primary: true });
  }

  return (
    <>
      {/* The floating layer: glass here and on the phone tab bar, nowhere in content. */}
      <header className="glass sticky top-0 z-30 border-b border-hairline/60 print:hidden">
        <div className="mx-auto flex h-14 max-w-(--container-page) items-center justify-between gap-3 px-4">
          <Link href="/" className="flex min-h-11 items-center rounded-sm py-1 text-ink">
            <Wordmark locale={locale} headerMark className="text-[1.45rem]" />
          </Link>

          <nav aria-label={t("mainNav")} className="hidden flex-wrap items-center gap-0.5 md:flex">
            {items.map((item) =>
              item.primary ? (
                <Link key={item.href} href={item.href} className="btn btn-primary ms-1 px-4 text-small">
                  {item.label}
                </Link>
              ) : (
                <ActiveLink key={item.href} href={item.href} activeClassName="text-ink" className={navItem}>
                  {item.label}
                  {item.badge ? (
                    <span className="ms-1.5 rounded-full bg-down px-1.5 text-label leading-5 font-semibold text-on-primary">{item.badge}</span>
                  ) : null}
                </ActiveLink>
              ),
            )}
            {session?.user && (
              <form action={signOutAction}>
                <SubmitButton pendingLabel={t("signingOut")} className={navItem}>
                  {t("signOut")}
                </SubmitButton>
              </form>
            )}
            <ThemeToggle />
            <LocaleSwitch />
          </nav>

          <MobileNav items={items} signOut={session?.user ? signOutAction : undefined} />
        </div>
      </header>
      {session?.user && <TabBar items={items} label={t("mainNav")} />}
    </>
  );
}
