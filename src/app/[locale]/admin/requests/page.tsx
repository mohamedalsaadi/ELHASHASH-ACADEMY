import { pageMetadata } from "@/lib/seo";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ReplyForm } from "@/components/requests/ReplyForm";
import { StatusChip } from "@/components/ui/StatusChip";
import { db } from "@/lib/db";
import { closeRequest, staffReply } from "@/lib/request-actions";
import { requireAdmin } from "@/lib/staff";
import { AdminNav } from "../AdminNav";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return pageMetadata(params, "/admin/requests", "homework", { key: "requests", noindex: true });
}

export default async function AdminRequestsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdmin();
  const t = await getTranslations("homework");
  const ar = locale === "ar";

  const requests = await db.specialRequest.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
    select: {
      id: true,
      subject: true,
      body: true,
      status: true,
      createdAt: true,
      author: { select: { name: true } },
      student: { select: { name: true } },
      course: { select: { titleAr: true, titleEn: true } },
      replies: { orderBy: { createdAt: "asc" }, select: { id: true, body: true, author: { select: { name: true, role: true } } } },
    },
  });

  return (
    <main className="mx-auto grid max-w-4xl gap-6 px-4 py-12">
      <AdminNav current="requests" />

      {requests.length === 0 ? (
        <p className="text-small text-ink-muted">{t("noRequests")}</p>
      ) : (
        <ul className="grid gap-3">
          {requests.map((r) => (
            <li key={r.id} className="grid gap-2 rounded-md border border-hairline bg-surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-display font-semibold" dir="auto">{r.subject}</span>
                <StatusChip tone={r.status === "CLOSED" ? "neutral" : r.status === "ANSWERED" ? "active" : "expiring"}>
                  {r.status === "CLOSED" ? t("closed") : r.status === "ANSWERED" ? t("answered") : t("open")}
                </StatusChip>
              </div>
              <span className="text-label text-ink-muted">
                {r.author.name} · {r.student.name}
                {r.course && ` · ${ar ? r.course.titleAr : r.course.titleEn}`}
              </span>
              <p dir="auto" className="text-small whitespace-pre-line break-words">{r.body}</p>
              {r.replies.length > 0 && (
                <ul className="grid gap-2 border-s-2 border-hairline ps-3">
                  {r.replies.map((reply) => (
                    <li key={reply.id}>
                      <span className="text-label font-semibold">{reply.author.name}</span>
                      <p dir="auto" className="text-small whitespace-pre-line break-words">{reply.body}</p>
                    </li>
                  ))}
                </ul>
              )}
              {r.status !== "CLOSED" ? (
                <div className="grid gap-2">
                  <ReplyForm
                    action={staffReply}
                    requestId={r.id}
                    labels={{ placeholder: t("reply"), send: t("reply"), ok: t("requestOk"), invalid: t("requestInvalid"), limited: t("requestLimited") }}
                  />
                  <form action={closeRequest}>
                    <input type="hidden" name="id" value={r.id} />
                    <button className="text-label text-ink-muted underline underline-offset-4">{t("close")}</button>
                  </form>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
