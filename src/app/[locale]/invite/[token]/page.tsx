import { pick } from "@/lib/content";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthShell } from "@/app/[locale]/signin/AuthShell";
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
      <AuthShell>
        <h1 className="font-display text-h1 font-semibold">{t("invalidTitle")}</h1>
        <p className="text-small text-ink-muted">{t("invalid")}</p>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <h1 className="font-display text-h1 font-semibold">{t("title", { name: invite.name })}</h1>
      <p className="text-small text-ink-muted">{t("lede")}</p>
      <ul className="grid gap-1 rounded-md bg-raised p-3 text-small">
        {invite.slots.map((s) => (
          <li key={s.id}>
            {pick(ar, s.subject.nameAr, s.subject.nameEn)} · {pick(ar, s.grade.nameAr, s.grade.nameEn)} ·{" "}
            {pick(ar, s.grade.country.nameAr, s.grade.country.nameEn)}
          </li>
        ))}
      </ul>
      <InviteForm token={token} />
    </AuthShell>
  );
}
