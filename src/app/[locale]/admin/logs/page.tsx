import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { pageMetadata } from "@/lib/seo";
import { requireAdmin } from "@/lib/staff";
import { AdminNav, panel, table } from "../AdminNav";

export const dynamic = "force-dynamic";

const LIMIT = 200;

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return pageMetadata(params, "/admin/logs", "office", { key: "nav.logs", noindex: true });
}

/** The site log: what failed or happened, newest first. Filter by level or by a source prefix such as ?source=vdocipher. */
export default async function AdminLogsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ level?: string; source?: string }> }) {
  const { locale } = await params;
  const { level, source } = await searchParams;
  setRequestLocale(locale);
  await requireAdmin();
  const t = await getTranslations("office.logs");
  const rows = await db.siteLog.findMany({
    where: {
      ...(level === "ERROR" ? { level: "ERROR" } : level === "WARN" ? { level: { in: ["ERROR", "WARN"] } } : {}),
      ...(source ? { source: { startsWith: source.slice(0, 60) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: LIMIT,
  });
  const when = new Intl.DateTimeFormat("en-GB", { dateStyle: "short", timeStyle: "medium", timeZone: "Asia/Dubai" });
  const chip = (active: boolean) => `rounded-full px-3 py-1 text-small ${active ? "bg-surface text-ink shadow-paper" : "text-ink-muted hover:text-ink"}`;

  return (
    <main className="mx-auto grid max-w-6xl gap-6 px-4 py-12">
      <AdminNav current="logs" />
      <p className="text-small text-ink-muted">{t("hint")}</p>
      <nav className="flex flex-wrap gap-2">
        <Link href="/admin/logs" className={chip(!level)}>{t("all")}</Link>
        <Link href="/admin/logs?level=ERROR" className={chip(level === "ERROR")}>{t("errors")}</Link>
        <Link href="/admin/logs?level=WARN" className={chip(level === "WARN")}>{t("warnings")}</Link>
      </nav>
      <section className={panel}>
        {rows.length === 0 ? (
          <p className="text-small text-ink-muted">{t("empty")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className={table} dir="ltr">
              <thead>
                <tr>
                  <th>{t("time")}</th>
                  <th>{t("level")}</th>
                  <th>{t("source")}</th>
                  <th>{t("message")}</th>
                  <th>{t("path")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap">{when.format(r.createdAt)}</td>
                    <td className={r.level === "ERROR" ? "font-semibold" : ""}>{r.level}</td>
                    <td className="whitespace-nowrap">{r.source}</td>
                    <td className="break-words">{r.message}</td>
                    <td className="break-all">{r.path ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-label text-ink-muted">{t("limit", { n: LIMIT })}</p>
      </section>
    </main>
  );
}
