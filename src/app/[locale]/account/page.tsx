import { pageMetadata } from "@/lib/seo";
import { notFound, redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { GradePicker } from "@/components/GradePicker";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Link } from "@/i18n/navigation";
import { gradeGroups } from "@/lib/catalog";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { appUrl } from "@/lib/mail";
import { getOrCreateReferralCode } from "@/lib/referral";
import { DeleteAccountForm, ParentCodeForm, PasswordForm, ProfileForm } from "./AccountForms";
import { sendVerification, unlinkParent } from "./actions";

export const dynamic = "force-dynamic";

const panel = "grid gap-3 card p-5";
const smallButton = "w-fit rounded-full border border-hairline bg-surface px-3 py-1.5 font-display text-small font-semibold transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-raised";

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return pageMetadata(params, "/account", "account", { key: "title", noindex: true });
}

export default async function AccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ verified?: string }>;
}) {
  const { locale } = await params;
  const { verified: verifiedParam } = await searchParams;
  setRequestLocale(locale);
  const session = await auth();
  if (!session?.user) redirect(`/${locale}/signin?next=${encodeURIComponent(`/${locale}/account`)}`);
  const t = await getTranslations("account");

  const u = await db.user.findUnique({
    where: { id: session.user.id },
    include: {
      // As a parent: the linked students. As a student: the linked parents.
      parentLinks: { include: { student: { select: { id: true, name: true, phone: true } } } },
      childLinks: { include: { parent: { select: { id: true, name: true, phone: true } } } },
    },
  });
  if (!u) notFound();

  const verified = Boolean(u.emailVerifiedAt);
  const ar = locale === "ar";
  const receipts = await db.order.findMany({
    where: {
      status: { in: ["PAID", "REFUNDED"] },
      OR: [{ userId: u.id }, { beneficiaryId: u.id }],
    },
    orderBy: { paidAt: "desc" },
    take: 20,
    select: {
      id: true,
      currency: true,
      total: true,
      vat: true,
      paidAt: true,
      createdAt: true,
      documents: { where: { kind: "INVOICE" }, select: { id: true, number: true } },
    },
  });
  const day = new Intl.DateTimeFormat(ar ? "ar-EG-u-nu-latn" : "en-GB", { dateStyle: "medium", timeZone: "Asia/Dubai" });
  const referral = u.role === "STUDENT" || u.role === "PARENT" ? await getOrCreateReferralCode(u.id) : null;
  const shareText = referral
    ? ar
      ? `جرّب ذروة لابنك. استخدم كود الإحالة ${referral.code} عند الدفع: ${appUrl()}/${locale}/courses`
      : `Try Dhirwa for your child. Use referral code ${referral.code} at checkout: ${appUrl()}/${locale}/courses`
    : "";

  return (
    <main className="mx-auto grid max-w-2xl gap-8 px-4 py-12">
      <h1 className="font-display text-h1 font-semibold">{t("title")}</h1>
      {verifiedParam === "1" && verified && (
        <p role="status" className="rounded-sm border border-up px-3 py-2 text-small text-up">
          {t("verifiedNow")}
        </p>
      )}

      <section className={panel}>
        <h2 className="font-display text-h3 font-semibold">{t("profileTitle")}</h2>
        <ProfileForm name={u.name} email={u.email ?? ""} />
        {u.email && (
          <div className="flex flex-wrap items-center gap-3 border-t border-hairline pt-3">
            <span className={`text-small ${verified ? "text-up" : "text-ink-muted"}`}>{verified ? t("verified") : t("unverified")}</span>
            {!verified && (
              <form action={sendVerification}>
                <SubmitButton pendingLabel={t("sending")} className={smallButton}>
                  {t("sendVerification")}
                </SubmitButton>
              </form>
            )}
          </div>
        )}
      </section>

      <section className={panel}>
        <h2 className="font-display text-h3 font-semibold">{t("passwordTitle")}</h2>
        <PasswordForm />
      </section>

      {u.role === "STUDENT" && (
        <section className={panel}>
          <h2 className="font-display text-h3 font-semibold">{t("gradeTitle")}</h2>
          <p className="text-small text-ink-muted">{t("gradeHint")}</p>
          <GradePicker groups={await gradeGroups(locale)} current={u.gradeId} label={t("grade")} save={t("save")} />
        </section>
      )}

      {u.role === "STUDENT" && (
        <section className={panel}>
          <h2 className="font-display text-h3 font-semibold">{t("parentTitle")}</h2>
          <ParentCodeForm />
          {u.childLinks.length > 0 ? (
            <ul className="grid gap-2 border-t border-hairline pt-3">
              {u.childLinks.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-small">{l.parent.name}</span>
                  <form action={unlinkParent}>
                    <input type="hidden" name="id" value={l.id} />
                    <ConfirmButton
                      action={unlinkParent}
                      confirmText={t("confirmUnlink")}
                      className="text-small text-down underline-offset-4 hover:underline"
                    >
                      {t("unlink")}
                    </ConfirmButton>
                  </form>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-small text-ink-muted">{t("noParents")}</p>
          )}
        </section>
      )}

      {u.role === "PARENT" && (
        <section className={panel}>
          <h2 className="font-display text-h3 font-semibold">{t("childrenTitle")}</h2>
          {u.parentLinks.length > 0 ? (
            <ul className="grid gap-2">
              {u.parentLinks.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-small">{l.student.name}</span>
                  <form action={unlinkParent}>
                    <input type="hidden" name="id" value={l.id} />
                    <ConfirmButton
                      action={unlinkParent}
                      confirmText={t("confirmUnlink")}
                      className="text-small text-down underline-offset-4 hover:underline"
                    >
                      {t("unlink")}
                    </ConfirmButton>
                  </form>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-small text-ink-muted">{t("noChildren")}</p>
          )}
          <Link href="/parent" className="text-small text-pen underline-offset-4 hover:underline">
            {t("openParent")}
          </Link>
        </section>
      )}

      {referral && (
        <section className={panel}>
          <h2 className="font-display text-h3 font-semibold">{t("referralTitle")}</h2>
          <p className="text-small text-ink-muted">{t("referralHint")}</p>
          <p className="num font-display text-h2 font-bold tracking-wider" dir="ltr">
            {referral.code}
          </p>
          <p className="text-small text-ink-muted">{t("referralHow")}</p>
          <a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noreferrer" className={smallButton}>
            {t("referralShare")}
          </a>
        </section>
      )}

      {receipts.length > 0 && (
        <section className={panel}>
          <h2 className="font-display text-h3 font-semibold">{t("receiptsTitle")}</h2>
          <ul className="grid gap-2">
            {receipts.map((o) => {
              const doc = o.documents[0];
              return (
                <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-hairline pt-2 text-small">
                  <span className="grid gap-0.5">
                    <span className="num" dir="ltr">
                      {doc?.number ?? o.id}
                    </span>
                    <span className="text-label text-ink-muted">{day.format(o.paidAt ?? o.createdAt)}</span>
                  </span>
                  <span className="num font-semibold">{formatMoney(o.total + o.vat, o.currency, locale)}</span>
                  <span className="flex flex-wrap gap-2">
                    {doc && (
                      <a href={`/api/documents/${doc.id}/pdf`} className="text-pen underline underline-offset-4">
                        {t("receiptPdf")}
                      </a>
                    )}
                    <Link href={`/orders/${o.id}`} className="text-pen underline underline-offset-4">
                      {t("receiptView")}
                    </Link>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {(u.role === "STUDENT" || u.role === "PARENT") && (
        <section className={`${panel} border-down/40`}>
          <h2 className="font-display text-h3 font-semibold text-down">{t("dangerTitle")}</h2>
          <DeleteAccountForm />
        </section>
      )}

      {u.role === "INSTRUCTOR" || u.role === "ADMIN" ? (
        <Link href={u.role === "ADMIN" ? "/admin" : "/teacher"} className="text-small text-pen underline-offset-4 hover:underline">
          {t("openStaff")}
        </Link>
      ) : null}
    </main>
  );
}
