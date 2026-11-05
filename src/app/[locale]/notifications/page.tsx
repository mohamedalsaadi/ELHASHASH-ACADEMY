import { pick } from "@/lib/content";
import { pageMetadata } from "@/lib/seo";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { EmptyState } from "@/components/brand/Mark";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { markAllRead, openNotification } from "./actions";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return pageMetadata(params, "/notifications", "notifications", { key: "title", noindex: true });
}

export default async function NotificationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ before?: string }>;
}) {
  const { locale } = await params;
  const { before } = await searchParams;
  setRequestLocale(locale);
  const session = await auth();
  if (!session?.user) redirect(`/${locale}/signin?next=${encodeURIComponent(`/${locale}/notifications`)}`);
  const t = await getTranslations("notifications");
  const ar = locale === "ar";
  const beforeDate = before ? new Date(before) : null;
  const items = await db.notification.findMany({
    where: { userId: session.user.id, ...(beforeDate && !Number.isNaN(beforeDate.getTime()) ? { createdAt: { lt: beforeDate } } : {}) },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const when = new Intl.DateTimeFormat(ar ? "ar-EG-u-nu-latn" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dubai" }); // the academy's zone; the course zone is used where a course is known
  const unread = items.some((n) => !n.readAt);

  return (
    <main className="mx-auto grid max-w-2xl gap-6 px-4 py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-h1 font-semibold">{t("title")}</h1>
        {unread && (
          <form action={markAllRead}>
            <SubmitButton className="rounded-full border border-hairline bg-surface px-4 py-2 font-display text-small font-semibold transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-raised">
              {t("markAll")}
            </SubmitButton>
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
            const title = pick(ar, n.titleAr, n.titleEn);
            const body = pick(ar, n.bodyAr, n.bodyEn);
            const content = (
              <span className="grid gap-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="font-display font-semibold">{title}</span>
                  {!n.readAt && <span className="text-label font-semibold text-pen">{t("unread")}</span>}
                </span>
                {body && <span className="text-small text-ink-muted">{body}</span>}
                <span className="num text-label text-ink-muted">{when.format(n.createdAt)}</span>
              </span>
            );
            const className = `card block w-full p-4 text-start transition-colors duration-(--dur-fast) ease-(--ease-out) ${
              n.readAt ? "" : "border-pen"
            } ${n.href ? "hover:bg-raised" : ""}`;
            return (
              <li key={n.id}>
                {n.href?.startsWith("/") ? (
                  <form action={openNotification}>
                    <input type="hidden" name="id" value={n.id} />
                    <button type="submit" className={className}>
                      {content}
                    </button>
                  </form>
                ) : (
                  <div className={className}>{content}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {items.length === 50 && (
        <Link
          href={{ pathname: "/notifications", query: { before: items[items.length - 1].createdAt.toISOString() } }}
          className="w-fit text-small text-pen underline-offset-4 hover:underline"
        >
          {t("older")}
        </Link>
      )}
    </main>
  );
}
