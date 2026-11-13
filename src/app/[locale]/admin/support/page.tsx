import { pageMetadata } from "@/lib/seo";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { EmptyState } from "@/components/brand/Mark";
import { StatusChip } from "@/components/ui/StatusChip";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/staff";
import { AdminNav, panel } from "../AdminNav";
import { field } from "../styles";
import { closeTicket, replyTicket } from "./actions";

export const dynamic = "force-dynamic";

const button =
  "rounded-full border border-hairline bg-surface px-4 py-2 font-display text-small font-semibold transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-raised";

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return pageMetadata(params, "/admin/support", "office", { key: "nav.support", noindex: true });
}

export default async function SupportPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdmin();
  const t = await getTranslations("office.support");

  const tickets = await db.supportTicket.findMany({ orderBy: [{ status: "asc" }, { aiFlag: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }], take: 100 });
  const date = new Intl.DateTimeFormat(locale === "ar" ? "ar-EG-u-nu-latn" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Dubai",
  });

  return (
    <main className="mx-auto grid max-w-4xl gap-6 px-4 py-12">
      <AdminNav current="support" />
      <p className="text-small text-ink-muted">{t("hint")}</p>

      {tickets.length === 0 ? (
        <EmptyState>
          <p className="text-ink-muted">{t("empty")}</p>
        </EmptyState>
      ) : (
        <ul className="grid gap-3">
          {tickets.map((k) => (
            <li key={k.id} className={panel}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="grid min-w-0 gap-0.5">
                  <span className="font-display font-semibold">{k.name}</span>
                  <span className="truncate text-label text-ink-muted" dir="ltr">
                    {k.email}
                    {k.phone ? ` · ${k.phone}` : ""}
                  </span>
                  <span className="num text-label text-ink-muted">
                    {date.format(k.createdAt)} · {t(`topic.${k.topic}` as never)}
                  </span>
                </div>
                <span className="flex flex-wrap items-center gap-2">
                  {k.status === "OPEN" && k.aiFlag && <StatusChip tone="expired">{t(`flag.${k.aiFlag}` as never)}</StatusChip>}
                  <StatusChip tone={k.status === "CLOSED" ? "neutral" : k.status === "ANSWERED" ? "active" : "expiring"}>
                    {t(`status.${k.status}` as never)}
                  </StatusChip>
                </span>
              </div>
              {k.status === "OPEN" && k.aiReason && <p dir="auto" className="rounded-sm bg-raised p-2 text-small">{t("whyFlag")}: {k.aiReason}</p>}
              <p dir="auto" className="whitespace-pre-line break-words text-small">{k.message}</p>

              {k.reply ? (
                <div className="grid gap-1 border-s-2 border-hairline ps-3">
                  <span className="text-label font-semibold">{t("sent")}</span>
                  <p dir="auto" className="whitespace-pre-line break-words text-small">{k.reply}</p>
                </div>
              ) : null}

              {k.status === "OPEN" && (
                <div className="grid gap-2 border-t border-hairline pt-3">
                  <form action={replyTicket} className="grid gap-2">
                    <input type="hidden" name="id" value={k.id} />
                    <label className="grid gap-1 text-label text-ink-muted">
                      {k.aiDraft ? t("draft") : t("write")}
                      <textarea name="reply" required rows={6} dir="auto" defaultValue={k.aiDraft ?? ""} className={`${field} py-2`} />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button className={button}>{t("send")}</button>
                    </div>
                  </form>
                  <form action={closeTicket}>
                    <input type="hidden" name="id" value={k.id} />
                    <button className="text-label text-ink-muted underline underline-offset-4">{t("close")}</button>
                  </form>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
