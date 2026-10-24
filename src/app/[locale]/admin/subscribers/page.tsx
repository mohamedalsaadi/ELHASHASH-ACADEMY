import { getTranslations, setRequestLocale } from "next-intl/server";
import { EmptyState } from "@/components/brand/Mark";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/staff";
import { findSubscribers, isCurrent, PAGE_SIZE, subscriberWhere, type SubscriberFilter } from "@/lib/subscribers";
import { AdminNav, panel, table } from "../AdminNav";
import { field, label } from "../styles";

export const dynamic = "force-dynamic";

const button = "min-h-11 rounded-sm border border-ink-muted px-4 font-display font-semibold transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-raised";

export default async function SubscribersPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SubscriberFilter> }) {
  const { locale } = await params;
  const f = await searchParams;
  setRequestLocale(locale);
  await requireAdmin();
  const t = await getTranslations("office");
  const tc = await getTranslations("catalog");
  const ar = locale === "ar";
  const now = new Date();
  const page = Math.max(1, Number(f.page) || 1);

  const [countries, courses, rows, total] = await Promise.all([
    db.country.findMany({ orderBy: { order: "asc" }, include: { grades: { orderBy: { level: "asc" } } } }),
    db.course.findMany({ orderBy: { slug: "asc" }, select: { id: true, titleAr: true, titleEn: true } }),
    findSubscribers(f),
    db.user.count({ where: subscriberWhere(f, now) }),
  ]);
  const date = new Intl.DateTimeFormat(ar ? "ar-EG-u-nu-latn" : "en-GB", { dateStyle: "medium", timeZone: "Africa/Cairo" }); // access ends on Cairo days (cairoDay)
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
                {ar ? c.nameAr : c.nameEn}
              </option>
            ))}
          </select>
        </label>
        <label className={label}>
          {t("grade")}
          <select name="grade" defaultValue={f.grade ?? ""} className={field}>
            <option value="">{t("all")}</option>
            {countries.map((c) => (
              <optgroup key={c.code} label={ar ? c.nameAr : c.nameEn}>
                {c.grades.map((g) => (
                  <option key={g.id} value={g.id}>
                    {ar ? g.nameAr : g.nameEn}
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
                {ar ? c.titleAr : c.titleEn}
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
                <th>{t("student")}</th>
                <th>{t("grade")}</th>
                <th>{t("course")}</th>
                <th>{t("status")}</th>
                <th>{t("endsAt")}</th>
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
                    <td>{u.grade ? `${ar ? u.grade.country.nameAr : u.grade.country.nameEn} · ${ar ? u.grade.nameAr : u.grade.nameEn}` : "—"}</td>
                    <td>
                      {latest ? (
                        <span className="grid">
                          <span>{ar ? latest.course.titleAr : latest.course.titleEn}</span>
                          {latest.accessType && <span className="text-label text-ink-muted">{tc(`access.${latest.accessType}`, { days: 0 })}</span>}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className={`font-semibold ${active ? "text-up" : "text-ink-muted"}`}>{latest ? t(active ? "active" : "expired") : t("none")}</td>
                    <td className="num">{latest?.endsAt ? date.format(latest.endsAt) : latest ? t("noEnd") : "—"}</td>
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
    </main>
  );
}
