import { notFound, redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { ParentCodeForm, PasswordForm, ProfileForm } from "./AccountForms";
import { sendVerification, unlinkParent } from "./actions";

export const dynamic = "force-dynamic";

const panel = "grid gap-3 rounded-md border border-hairline bg-surface p-5";
const smallButton = "w-fit rounded-sm border border-ink-muted px-3 py-1.5 font-display text-small font-semibold transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-raised";

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
                <button className={smallButton}>{t("sendVerification")}</button>
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
          <h2 className="font-display text-h3 font-semibold">{t("parentTitle")}</h2>
          <ParentCodeForm />
          {u.childLinks.length > 0 ? (
            <ul className="grid gap-2 border-t border-hairline pt-3">
              {u.childLinks.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-small">{l.parent.name}</span>
                  <form action={unlinkParent}>
                    <input type="hidden" name="id" value={l.id} />
                    <button className="text-small text-down underline-offset-4 hover:underline">{t("unlink")}</button>
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
                    <button className="text-small text-down underline-offset-4 hover:underline">{t("unlink")}</button>
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

      {u.role === "INSTRUCTOR" || u.role === "ADMIN" ? (
        <Link href={u.role === "ADMIN" ? "/admin" : "/teacher"} className="text-small text-pen underline-offset-4 hover:underline">
          {t("openStaff")}
        </Link>
      ) : null}
    </main>
  );
}
