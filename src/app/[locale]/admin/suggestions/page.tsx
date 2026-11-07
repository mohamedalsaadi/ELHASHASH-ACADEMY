import { getTranslations, setRequestLocale } from "next-intl/server";
import { EmptyState } from "@/components/brand/Mark";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { aiEnabled } from "@/lib/ai";
import { db } from "@/lib/db";
import { pageMetadata } from "@/lib/seo";
import { requireAdmin } from "@/lib/staff";
import { Digest } from "@/lib/suggestions";
import { AdminNav, panel } from "../AdminNav";
import { summarise } from "./actions";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return pageMetadata(params, "/admin/suggestions", "office", { key: "nav.suggestions", noindex: true });
}

export default async function SuggestionsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ failed?: string }> }) {
  const { locale } = await params;
  const { failed } = await searchParams;
  setRequestLocale(locale);
  await requireAdmin();
  const t = await getTranslations("office.suggestions");

  const [fresh, latest, recent] = await Promise.all([
    db.suggestion.count({ where: { digestId: null } }),
    db.suggestionDigest.findFirst({ orderBy: { createdAt: "desc" } }),
    db.suggestion.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
  ]);
  const digest = latest ? Digest.safeParse(latest.data) : null;
  const date = new Intl.DateTimeFormat(locale === "ar" ? "ar-EG-u-nu-latn" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dubai" });

  return (
    <main className="mx-auto grid max-w-4xl gap-6 px-4 py-12">
      <AdminNav current="suggestions" />
      <p className="text-small text-ink-muted">{t("hint")}</p>
      {!aiEnabled() && <p className="text-small text-down">{t("aiOff")}</p>}
      {failed === "1" && <p role="alert" className="text-small text-down">{t("failed")}</p>}

      <section className={panel}>
        <p className="text-small">{fresh > 0 ? t("new", { n: fresh }) : t("none")}</p>
        {fresh > 0 && aiEnabled() && (
          <form action={summarise}>
            <input type="hidden" name="locale" value={locale} />
            <SubmitButton pendingLabel={t("summarising")} className="btn btn-primary w-fit text-small">
              {t("summarise")}
            </SubmitButton>
          </form>
        )}
      </section>

      {latest && digest?.success && (
        <section className={panel}>
          <h2 className="font-display text-h3 font-semibold">{t("latest")}</h2>
          <span className="num text-label text-ink-muted">{t("covered", { n: latest.count, when: date.format(latest.createdAt) })}</span>
          <p dir="auto" className="text-small">{digest.data.overview}</p>
          {digest.data.urgent.length > 0 && (
            <div className="grid gap-1">
              <h3 className="text-label font-semibold text-down">{t("urgent")}</h3>
              <ul className="list-disc ps-5 text-small">{digest.data.urgent.map((u) => <li key={u} dir="auto">{u}</li>)}</ul>
            </div>
          )}
          <div className="grid gap-3">
            <h3 className="text-label font-semibold">{t("themes")}</h3>
            <ul className="grid gap-3">
              {digest.data.themes.map((th) => (
                <li key={th.title} className="grid gap-1 border-s-2 border-hairline ps-3">
                  <span dir="auto" className="font-display font-semibold">{th.title} <span className="num text-label text-ink-muted">· {th.count}</span></span>
                  <span dir="auto" className="text-small">{th.summary}</span>
                  {th.examples.length > 0 && (
                    <span dir="auto" className="text-label text-ink-muted">{t("examples")}: {th.examples.map((e) => `«${e}»`).join(" ")}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
          {digest.data.actions.length > 0 && (
            <div className="grid gap-1">
              <h3 className="text-label font-semibold">{t("actions")}</h3>
              <ol className="list-decimal ps-5 text-small">{digest.data.actions.map((a) => <li key={a} dir="auto">{a}</li>)}</ol>
            </div>
          )}
        </section>
      )}

      <h2 className="font-display text-h3 font-semibold">{t("recent")}</h2>
      {recent.length === 0 ? (
        <EmptyState>
          <p className="text-ink-muted">{t("empty")}</p>
        </EmptyState>
      ) : (
        <ul className="grid gap-3">
          {recent.map((s) => (
            <li key={s.id} className={panel}>
              <span className="num text-label text-ink-muted">
                {date.format(s.createdAt)} · {t(`kind.${s.kind}` as never)} · {t(`role.${s.role}` as never)}
              </span>
              <p dir="auto" className="whitespace-pre-line break-words text-small">{s.message}</p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
