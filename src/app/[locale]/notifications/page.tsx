import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { EmptyState } from "@/components/brand/Mark";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { markAllRead } from "./actions";

export const dynamic = "force-dynamic";

export default async function NotificationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await auth();
  if (!session?.user) redirect(`/${locale}/signin?next=${encodeURIComponent(`/${locale}/notifications`)}`);
  const t = await getTranslations("notifications");
  const ar = locale === "ar";
  const items = await db.notification.findMany({ where: { userId: session.user.id }, orderBy: { createdAt: "desc" }, take: 50 });
  const when = new Intl.DateTimeFormat(ar ? "ar-EG-u-nu-latn" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Cairo" });
  const unread = items.some((n) => !n.readAt);

  return (
    <main className="mx-auto grid max-w-2xl gap-6 px-4 py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-h1 font-semibold">{t("title")}</h1>
        {unread && (
          <form action={markAllRead}>
            <button className="rounded-sm border border-ink-muted px-4 py-2 font-display text-small font-semibold transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-raised">
              {t("markAll")}
            </button>
          </form>
        )}
      </div>
      {items.length === 0 ? (
        <EmptyState>
          <p className="text-ink-muted">{t("empty")}</p>
        </EmptyState>
      ) : (
        <ul className="grid gap-2">
          {items.map((n) => {
            const title = ar ? n.titleAr : n.titleEn;
            const body = ar ? n.bodyAr : n.bodyEn;
            const content = (
              <span className="grid gap-1">
                <span className="font-display font-semibold">{title}</span>
                {body && <span className="text-small text-ink-muted">{body}</span>}
                <span className="num text-label text-ink-muted">{when.format(n.createdAt)}</span>
              </span>
            );
            const className = `block rounded-md border p-4 transition-colors duration-(--dur-fast) ease-(--ease-out) ${
              n.readAt ? "border-hairline bg-surface" : "border-pen bg-surface"
            } ${n.href ? "hover:bg-raised" : ""}`;
            return (
              <li key={n.id}>
                {n.href?.startsWith("/") ? (
                  <Link href={n.href} className={className}>
                    {content}
                  </Link>
                ) : (
                  <div className={className}>{content}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
