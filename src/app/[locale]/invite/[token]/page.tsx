import { getTranslations, setRequestLocale } from "next-intl/server";
import { findInvite, inviteIsOpen } from "@/lib/invites";
import { pageMetadata } from "@/lib/seo";
import { InviteForm } from "./InviteForm";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: Promise<{ locale: string; token: string }> }) {
  return pageMetadata(params, "/invite", "invite", { key: "metaTitle", noindex: true });
}

export default async function InvitePage({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("invite");
  const ar = locale === "ar";

  const invite = await findInvite(token);
  if (!invite || !inviteIsOpen(invite)) {
    return (
      <main className="mx-auto grid max-w-sm gap-4 px-4 py-16">
        <h1 className="font-display text-h1 font-semibold">{t("invalidTitle")}</h1>
        <p className="text-small text-ink-muted">{t("invalid")}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto grid max-w-sm gap-6 px-4 py-16">
      <h1 className="font-display text-h1 font-semibold">{t("title", { name: invite.name })}</h1>
      <p className="text-small text-ink-muted">{t("lede")}</p>
      <ul className="grid gap-1 rounded-sm border border-rule p-3 text-small">
        {invite.slots.map((s) => (
          <li key={s.id}>
            {ar ? s.subject.nameAr : s.subject.nameEn} · {ar ? s.grade.nameAr : s.grade.nameEn} ·{" "}
            {ar ? s.grade.country.nameAr : s.grade.country.nameEn}
          </li>
        ))}
      </ul>
      <InviteForm token={token} />
    </main>
  );
}
