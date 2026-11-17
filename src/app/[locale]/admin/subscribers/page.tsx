import { pick } from "@/lib/content";
import { pageMetadata } from "@/lib/seo";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { EmptyState } from "@/components/brand/Mark";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { courseZone } from "@/lib/format";
import { requireAdmin } from "@/lib/staff";
import { findSubscribers, isCurrent, PAGE_SIZE, subscriberWhere, type SubscriberFilter } from "@/lib/subscribers";
import { inviteCounts, inviteStatus } from "@/lib/course-invite";
import { AdminNav, panel, table } from "../AdminNav";
import { field, label } from "../styles";
import { SaveButton } from "../ui";
import { sendCourseInvite, sendInviteTestCopy } from "./invite-actions";

// One batch of at most 150 emails, sent one at a time with a short pause: this page needs the longer function limit.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const button = "min-h-11 rounded-full border border-hairline bg-surface px-4 font-display font-semibold transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-raised";
const check = "flex min-h-11 items-center gap-2 text-small text-ink-muted";

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return pageMetadata(params, "/admin/subscribers", "office", { key: "nav.subscribers", noindex: true });
}

type InviteParams = SubscriberFilter & { inviteCourse?: string; notices?: string; sent?: string; failed?: string; left?: string; test?: string };

export default async function SubscribersPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<InviteParams> }) {
  const { locale } = await params;
  const f = await searchParams;
  setRequestLocale(locale);
  await requireAdmin();
  const t = await getTranslations("office");
  const tc = await getTranslations("catalog");
  const ar = locale === "ar";
  const now = new Date();
  const page = Math.max(1, Number(f.page) || 1);

  const [countries, courses, published, rows, total] = await Promise.all([
    db.country.findMany({ orderBy: { order: "asc" }, include: { grades: { orderBy: { level: "asc" } } } }),
    db.course.findMany({ orderBy: { slug: "asc" }, select: { id: true, titleAr: true, titleEn: true } }),
    db.course.findMany({ where: { published: true }, orderBy: { slug: "asc" }, select: { id: true, titleAr: true, titleEn: true } }),
    findSubscribers(f),
    db.user.count({ where: subscriberWhere(f, now) }),
  ]);
  const target = published.find((c) => c.id === f.inviteCourse);
  const [counts, status] = target ? await Promise.all([inviteCounts(target.id), inviteStatus(target.id)]) : [null, null];
  // Access ends on a day boundary in the course country's zone, so a Kuwaiti student's end date is a Kuwaiti day.
  const dateIn = (timeZone: string) => new Intl.DateTimeFormat(ar ? "ar-EG-u-nu-latn" : "en-GB", { dateStyle: "medium", timeZone });
  const query = (extra: Record<string, string>) => new URLSearchParams({ ...Object.fromEntries(Object.entries(f).filter(([, v]) => v)), ...extra }).toString();

  return (
    <main className="mx-auto grid max-w-6xl gap-6 px-4 py-12">
      <AdminNav current="subscribers" />

      <form className="flex flex-wrap items-end gap-3">
        <label className={`${label} min-w-0 flex-[1_1_16rem]`}>
          {t("search")}
          <input type="search" name="q" defaultValue={f.q ?? ""} className={field} />
        </label>
        <label className={label}>
          {t("country")}
          <select name="country" defaultValue={f.country ?? ""} className={field}>
            <option value="">{t("all")}</option>
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {pick(ar, c.nameAr, c.nameEn)}
              </option>
            ))}
          </select>
        </label>
        <label className={label}>
          {t("grade")}
          <select name="grade" defaultValue={f.grade ?? ""} className={field}>
            <option value="">{t("all")}</option>
            {countries.map((c) => (
              <optgroup key={c.code} label={pick(ar, c.nameAr, c.nameEn)}>
                {c.grades.map((g) => (
                  <option key={g.id} value={g.id}>
                    {pick(ar, g.nameAr, g.nameEn)}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className={label}>
          {t("course")}
          <select name="course" defaultValue={f.course ?? ""} className={`${field} max-w-60`}>
            <option value="">{t("all")}</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {pick(ar, c.titleAr, c.titleEn)}
              </option>
            ))}
          </select>
        </label>
        <label className={label}>
          {t("status")}
          <select name="status" defaultValue={f.status ?? ""} className={field}>
            <option value="">{t("all")}</option>
            <option value="active">{t("active")}</option>
            <option value="expired">{t("expired")}</option>
          </select>
        </label>
        <button className={button}>{t("filter")}</button>
        <a href={`/${locale}/admin/subscribers/export?${query({})}`} className={`${button} inline-flex items-center`}>
          {t("exportCsv")}
        </a>
      </form>

      <section className={`${panel} overflow-x-auto`}>
        {rows.length === 0 ? (
          <EmptyState>
            <p className="text-ink-muted">{t("noStudents")}</p>
          </EmptyState>
        ) : (
          <table className={table}>
            <thead>
              <tr>
                <th scope="col">{t("student")}</th>
                <th scope="col">{t("grade")}</th>
                <th scope="col">{t("course")}</th>
                <th scope="col">{t("status")}</th>
                <th scope="col">{t("endsAt")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => {
                const latest = u.entitlements.find((e) => isCurrent(e, now)) ?? u.entitlements[0];
                const active = !!latest && isCurrent(latest, now);
                return (
                  <tr key={u.id}>
                    <td>
                      <Link href={`/admin/subscribers/${u.id}`} className="grid">
                        <span className="font-medium text-pen underline-offset-4 hover:underline">{u.name}</span>
                        <span className="num text-label text-ink-muted" dir="ltr">
                          {u.phone ?? u.email}
                        </span>
                      </Link>
                    </td>
                    <td>{u.grade ? `${pick(ar, u.grade.country.nameAr, u.grade.country.nameEn)} · ${pick(ar, u.grade.nameAr, u.grade.nameEn)}` : "—"}</td>
                    <td>
                      {latest ? (
                        <span className="grid">
                          <span>{pick(ar, latest.course.titleAr, latest.course.titleEn)}</span>
                          {latest.accessType && <span className="text-label text-ink-muted">{tc(`access.${latest.accessType}`, { days: 0 })}</span>}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className={`font-semibold ${active ? "text-up" : "text-ink-muted"}`}>{latest ? t(active ? "active" : "expired") : t("none")}</td>
                    <td className="num">{latest?.endsAt ? dateIn(courseZone(latest.course)).format(latest.endsAt) : latest ? t("noEnd") : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <p className="flex flex-wrap items-center gap-4 text-small text-ink-muted">
          <span>{t("pageOf", { shown: rows.length, total, page })}</span>
          {page > 1 && <Link href={`/admin/subscribers?${query({ page: String(page - 1) })}`} className="text-pen">{t("prev")}</Link>}
          {page * PAGE_SIZE < total && <Link href={`/admin/subscribers?${query({ page: String(page + 1) })}`} className="text-pen">{t("next")}</Link>}
        </p>
      </section>

      <section className={`${panel} grid gap-4`}>
        <div className="grid gap-1">
          <h2 className="font-display text-h3 font-semibold">{t("inviteTitle")}</h2>
          <p className="text-small text-ink-muted">{t("inviteHint")}</p>
        </div>
        {f.sent !== undefined && (
          <p className="font-semibold text-up">{t("inviteResult", { notices: f.notices ?? "0", sent: f.sent, failed: f.failed ?? "0", left: f.left ?? "0" })}</p>
        )}
        {f.test && <p className={`font-semibold ${f.test === "ok" ? "text-up" : "text-down"}`}>{t(f.test === "ok" ? "inviteTestOk" : "inviteTestFail")}</p>}
        {published.length === 0 ? (
          <p className="text-ink-muted">{t("inviteNone")}</p>
        ) : (
          <form className="flex flex-wrap items-end gap-3">
            <label className={label}>
              {t("inviteCourse")}
              <select name="inviteCourse" defaultValue={f.inviteCourse ?? ""} className={`${field} max-w-60`}>
                <option value="">—</option>
                {published.map((c) => (
                  <option key={c.id} value={c.id}>
                    {pick(ar, c.titleAr, c.titleEn)}
                  </option>
                ))}
              </select>
            </label>
            <button className={button}>{t("inviteCount")}</button>
          </form>
        )}
        {target && counts && (
          counts.students === 0 ? (
            <p className="text-ink-muted">{t("inviteNoneLeft")}</p>
          ) : (
            <form action={sendCourseInvite} className="grid gap-3">
              <input type="hidden" name="courseId" value={target.id} />
              <p className="font-display font-semibold">{t("inviteRecipients", counts)}</p>
              {status && <p className="text-small text-ink-muted">{t("inviteStatus", status)}</p>}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={label}>
                  {t("inviteTitleAr")}
                  <input name="titleAr" required maxLength={120} dir="rtl" defaultValue={`${target.titleAr} مفتوحة الآن`} className={field} />
                </label>
                <label className={label}>
                  {t("inviteTitleEn")}
                  <input name="titleEn" required maxLength={120} dir="ltr" defaultValue={`${target.titleEn} is open now`} className={field} />
                </label>
                <label className={label}>
                  {t("inviteBodyAr")}
                  <textarea name="bodyAr" required maxLength={400} rows={2} dir="rtl" defaultValue={t("inviteDefaultBodyAr")} className={`${field} py-2`} />
                </label>
                <label className={label}>
                  {t("inviteBodyEn")}
                  <textarea name="bodyEn" required maxLength={400} rows={2} dir="ltr" defaultValue={t("inviteDefaultBodyEn")} className={`${field} py-2`} />
                </label>
              </div>
              <label className={check}>
                <input type="checkbox" name="confirm" required className="size-4" />
                {t("inviteConfirm")}
              </label>
              <div className="flex flex-wrap gap-3">
                <button formAction={sendInviteTestCopy} formNoValidate className={button}>
                  {t("inviteTest")}
                </button>
                <SaveButton showSaved={false}>{t("inviteSend")}</SaveButton>
              </div>
            </form>
          )
        )}
      </section>
    </main>
  );
}
