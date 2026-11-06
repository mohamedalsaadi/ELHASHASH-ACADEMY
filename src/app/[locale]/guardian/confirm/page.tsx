import { pageMetadata } from "@/lib/seo";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { hashToken } from "@/lib/token-utils";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return pageMetadata(params, "/guardian/confirm", "guardianConfirm", { key: "title", noindex: true });
}

/** The guardian opens this from the email. The token is the authority; no account is required. */
export default async function GuardianConfirmPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { locale } = await params;
  const { token } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("guardianConfirm");

  let ok = false;
  if (token) {
    const row = await db.guardianConsent.findUnique({
      where: { verifyTokenHash: hashToken(token) },
      select: { studentId: true, verifyExpiresAt: true, verifiedAt: true },
    });
    if (row && !row.verifiedAt && row.verifyExpiresAt && row.verifyExpiresAt > new Date()) {
      await db.guardianConsent.update({
        where: { studentId: row.studentId },
        data: { verifiedAt: new Date(), verifyTokenHash: null, verifyExpiresAt: null },
      });
      ok = true;
    }
  }

  return (
    <main className="mx-auto grid max-w-xl gap-4 px-4 py-16">
      <h1 className="font-display text-h1 font-semibold">{t("title")}</h1>
      <p role="status" className={ok ? "text-up" : "text-ink-muted"}>
        {ok ? t("ok") : t("bad")}
      </p>
    </main>
  );
}
