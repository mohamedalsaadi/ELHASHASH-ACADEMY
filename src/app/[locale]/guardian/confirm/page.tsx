import { pageMetadata } from "@/lib/seo";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { db } from "@/lib/db";
import { hashToken } from "@/lib/token-utils";
import { approveGuardian } from "./actions";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return pageMetadata(params, "/guardian/confirm", "guardianConfirm", { key: "title", noindex: true });
}

/** The guardian opens this from WhatsApp or email. Opening it changes nothing: the button below approves. */
export default async function GuardianConfirmPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string; done?: string }>;
}) {
  const { locale } = await params;
  const { token, done } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("guardianConfirm");

  const row = token
    ? await db.guardianConsent.findUnique({
        where: { verifyTokenHash: hashToken(token) },
        select: { verifyExpiresAt: true, verifiedAt: true, student: { select: { name: true } } },
      })
    : null;
  const pending = Boolean(row && !row.verifiedAt && row.verifyExpiresAt && row.verifyExpiresAt > new Date());

  return (
    <main className="mx-auto grid max-w-xl gap-4 px-4 py-16">
      <h1 className="font-display text-h1 font-semibold">{t("title")}</h1>
      {pending && row ? (
        <form action={approveGuardian} className="grid gap-4">
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="locale" value={locale} />
          <p dir="auto">{t("intro", { name: row.student.name })}</p>
          <SubmitButton className="btn btn-primary w-fit">{t("approve")}</SubmitButton>
        </form>
      ) : (
        <p role="status" className={done ? "text-up" : "text-ink-muted"}>
          {done ? t("ok") : t("bad")}
        </p>
      )}
    </main>
  );
}
