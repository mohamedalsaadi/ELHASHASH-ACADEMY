import { pick } from "@/lib/content";
import { pageMetadata } from "@/lib/seo";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { ReplyForm } from "@/components/requests/ReplyForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusChip } from "@/components/ui/StatusChip";
import { db } from "@/lib/db";
import { dbRole } from "@/lib/staff";
import { ParentNav } from "../ParentNav";
import { parentReply } from "@/lib/request-actions";
import { RequestForm } from "./RequestForm";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return pageMetadata(params, "/parent/requests", "homework", { key: "requests", noindex: true });
}

export default async function ParentRequestsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await auth();
  if (!session?.user) redirect(`/${locale}/signin?next=${encodeURIComponent(`/${locale}/parent/requests`)}`);
  if ((await dbRole(session.user.id)) !== "PARENT") redirect(`/${locale}/dashboard`);

  const t = await getTranslations("homework");
  const ar = locale === "ar";

  const links = await db.parentLink.findMany({
    where: { parentId: session.user.id },
    select: { student: { select: { id: true, name: true, entitlements: { select: { course: { select: { id: true, titleAr: true, titleEn: true } } } } } } },
    orderBy: { createdAt: "asc" },
  });

  const children = links.map((l) => ({ id: l.student.id, name: l.student.name }));
  const courses: Record<string, { id: string; title: string }[]> = {};
  for (const l of links) {
    const seen = new Map<string, { id: string; title: string }>();
    for (const e of l.student.entitlements) {
      if (e.course) seen.set(e.course.id, { id: e.course.id, title: pick(ar, e.course.titleAr, e.course.titleEn) });
    }
    courses[l.student.id] = [...seen.values()];
  }

  const requests = await db.specialRequest.findMany({
    where: { authorId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      subject: true,
      body: true,
      status: true,
      createdAt: true,
      student: { select: { name: true } },
      course: { select: { titleAr: true, titleEn: true } },
      replies: { orderBy: { createdAt: "asc" }, select: { id: true, body: true, createdAt: true, author: { select: { name: true, role: true } } } },
    },
  });

  return (
    <main className="mx-auto grid max-w-3xl gap-6 px-4 py-12">
      <ParentNav current="requests" />
      <PageHeader title={t("requests")} />

      <section className="grid gap-3 rounded-lg border border-hairline bg-surface shadow-paper p-4">
        <h2 className="font-display text-h3 font-semibold">{t("newRequest")}</h2>
        {children.length === 0 ? (
          <p className="text-small text-ink-muted">{t("noRequests")}</p>
        ) : (
          <RequestForm
            kids={children}
            courses={courses}
            labels={{
              child: t("child"),
              course: t("course"),
              lessonNone: t("toManagement"),
              subject: t("requestSubject"),
              body: t("requestBody"),
              send: t("send"),
              ok: t("requestOk"),
              masked: t("masked"),
              invalid: t("requestInvalid"),
              limited: t("requestLimited"),
              unlinked: t("noAccess"),
            }}
          />
        )}
      </section>

      {requests.length === 0 ? (
        <p className="text-small text-ink-muted">{t("noRequests")}</p>
      ) : (
        <ul className="grid gap-3">
          {requests.map((r) => (
            <li key={r.id} className="grid gap-2 rounded-lg border border-hairline bg-surface shadow-paper p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-display font-semibold" dir="auto">{r.subject}</span>
                <StatusChip tone={r.status === "CLOSED" ? "neutral" : r.status === "ANSWERED" ? "active" : "expiring"}>
                  {r.status === "CLOSED" ? t("closed") : r.status === "ANSWERED" ? t("answered") : t("open")}
                </StatusChip>
              </div>
              <span className="text-label text-ink-muted">
                {r.student.name}
                {r.course && ` · ${pick(ar, r.course.titleAr, r.course.titleEn)}`}
              </span>
              <p dir="auto" className="text-small whitespace-pre-line break-words">{r.body}</p>
              {r.replies.length > 0 && (
                <ul className="grid gap-2 border-s-2 border-hairline ps-3">
                  {r.replies.map((reply) => (
                    <li key={reply.id} className={reply.author.role === "PARENT" ? "" : "text-pen"}>
                      <span className="text-label font-semibold">{reply.author.name}</span>
                      <p dir="auto" className="text-small whitespace-pre-line break-words">{reply.body}</p>
                    </li>
                  ))}
                </ul>
              )}
              {r.status !== "CLOSED" && (
                <ReplyForm
                  action={parentReply}
                  requestId={r.id}
                  labels={{ placeholder: t("reply"), send: t("reply"), ok: t("requestOk"), invalid: t("requestInvalid"), limited: t("requestLimited") }}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
