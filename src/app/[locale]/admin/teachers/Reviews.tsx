import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { panel } from "../AdminNav";
import { field } from "../styles";
import { approveApplication, approveCountryRequest, rejectApplication, rejectCountryRequest } from "./approvals";

/** What waits for the owner on the teachers page: self-registrations and requests for another country. */
export async function Reviews({ locale }: { locale: string }) {
  const t = await getTranslations("office");
  const ar = locale === "ar";
  const name = (c: { nameAr: string; nameEn: string }) => (ar ? c.nameAr : c.nameEn);
  const [apps, reqs] = await Promise.all([
    db.teacherApplication.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" }, include: { countries: { include: { country: true } } } }),
    db.teacherCountryRequest.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" }, include: { country: true, user: { select: { name: true } } } }),
  ]);
  if (!apps.length && !reqs.length) return null;

  return (
    <>
      {apps.length > 0 && (
        <section className="grid gap-3">
          <h2 className="font-display text-h2 font-semibold">{t("applications")}</h2>
          <ul className="grid gap-2">
            {apps.map((a) => (
              <li key={a.id} className={panel}>
                <div className="grid gap-0.5">
                  <span className="font-medium">{a.name}</span>
                  <span className="num text-small text-ink-muted" dir="ltr">
                    {a.email} · {a.phone}
                  </span>
                  <span className="text-small">{a.countries.map((c) => name(c.country)).join("، ")}</span>
                  <span className="text-small text-ink-muted">{a.subjectsNote}</span>
                  {a.bio && <span className="max-w-[65ch] text-small text-ink-muted">{a.bio}</span>}
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <form action={approveApplication}>
                    <input type="hidden" name="id" value={a.id} />
                    <button className="btn btn-primary">{t("approve")}</button>
                  </form>
                  <form action={rejectApplication} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="id" value={a.id} />
                    <input name="reason" maxLength={500} placeholder={t("rejectReason")} className={`${field} w-56`} />
                    <button className="btn btn-outline">{t("reject")}</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {reqs.length > 0 && (
        <section className="grid gap-3">
          <h2 className="font-display text-h2 font-semibold">{t("countryRequests")}</h2>
          <ul className="grid gap-2">
            {reqs.map((r) => (
              <li key={r.id} className={`${panel} flex flex-wrap items-center justify-between gap-3`}>
                <div className="grid gap-0.5">
                  <span className="font-medium">
                    {r.user.name} → {name(r.country)}
                  </span>
                  {r.note && <span className="text-small text-ink-muted">{r.note}</span>}
                </div>
                <div className="flex gap-2">
                  <form action={approveCountryRequest}>
                    <input type="hidden" name="id" value={r.id} />
                    <button className="btn btn-primary">{t("approve")}</button>
                  </form>
                  <form action={rejectCountryRequest}>
                    <input type="hidden" name="id" value={r.id} />
                    <button className="btn btn-outline">{t("reject")}</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
