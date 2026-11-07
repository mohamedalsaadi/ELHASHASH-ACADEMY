import { pageMetadata } from "@/lib/seo";
import { field } from "@/components/ui/form";
import { AuthError } from "next-auth";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthShell } from "@/app/[locale]/signin/AuthShell";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { SocialButtons } from "@/components/auth/SocialButtons";
import { OtpFlow } from "./OtpFlow";
import { gradeGroups } from "@/lib/catalog";
import { whatsappEnabled } from "@/lib/whatsapp";
import { PasswordField } from "@/components/ui/PasswordField";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Link } from "@/i18n/navigation";
import { safeNext } from "@/lib/safe-redirect";


export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return pageMetadata(params, "/signin", "signin", { key: "title", noindex: true });
}

export default async function SignInPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string; next?: string; verified?: string; reset?: string; login?: string; password?: string; type?: string }>;
}) {
  const { locale } = await params;
  const { error, next, verified, reset, login, password, type } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("signin");
  const o = await getTranslations("otp");
  const target = safeNext(next, `/${locale}/dashboard`);

  async function action(form: FormData) {
    "use server";
    try {
      await signIn("credentials", { login: form.get("login"), password: form.get("password"), redirectTo: target });
    } catch (e) {
      if (e instanceof AuthError) {
        const entered = encodeURIComponent(String(form.get("login") ?? ""));
        redirect(`/${locale}/signin?error=1&next=${encodeURIComponent(target)}&login=${entered}`);
      }
      throw e;
    }
  }

  // With WhatsApp set up, phone sign-in is the front door and the password form is one link away.
  const whatsapp = whatsappEnabled();
  if (whatsapp && password !== "1") {
    const to = (extra: Record<string, string>) => ({ pathname: "/signin" as const, query: { ...(next ? { next } : {}), ...extra } });
    return (
      <AuthShell>
        <h1 className="font-display text-h1 font-semibold">{t("title")}</h1>
        <SocialButtons locale={locale} next={next} />
        <OtpFlow groups={await gradeGroups(locale)} locale={locale} next={next ?? ""} parent={type === "PARENT"} />
        <p className="text-small text-ink-muted">
          <Link href={to({ password: "1" })} className="text-ink underline underline-offset-4">
            {o("usePassword")}
          </Link>
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <h1 className="font-display text-h1 font-semibold">{t("title")}</h1>
      <SocialButtons locale={locale} next={next} />
      <form action={action} className="grid gap-4">
        <label className="grid gap-2 text-label text-ink-muted">
          {t("phone")}
          <input
            name="login"
            type="text"
            autoComplete="username"
            dir="ltr"
            required
            defaultValue={login ?? ""}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "signin-error" : undefined}
            className={field}
          />
        </label>
        <label className="grid gap-2 text-label text-ink-muted">
          {t("password")}
          <PasswordField
            name="password"
            autoComplete="current-password"
            required
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "signin-error" : undefined}
            className={field}
          />
        </label>
        {error && (
          <p id="signin-error" role="alert" className="text-small text-down">
            {error === "AccessDenied" ? t("googleFailed") : t("error")}
          </p>
        )}
        {verified && (
          <p role="status" className="text-small text-up">
            {t("verified")}
          </p>
        )}
        {reset && (
          <p role="status" className="text-small text-up">
            {t("resetDone")}
          </p>
        )}
        <SubmitButton
          pendingLabel={t("submitting")}
          className="btn btn-primary"
        >
          {t("submit")}
        </SubmitButton>
      </form>
      <p className="text-small text-ink-muted">
        <Link href="/forgot" className="text-ink underline underline-offset-4">
          {t("forgot")}
        </Link>
      </p>
      {whatsapp && (
        <p className="text-small text-ink-muted">
          <Link href={{ pathname: "/signin", query: next ? { next } : {} }} className="text-ink underline underline-offset-4">
            {o("useWhatsapp")}
          </Link>
        </p>
      )}
      <p className="text-small text-ink-muted">
        {t("noAccount")}{" "}
        <Link href={{ pathname: "/signup", query: next ? { next } : {} }} className="text-ink underline underline-offset-4">
          {t("signUp")}
        </Link>
      </p>
    </AuthShell>
  );
}
