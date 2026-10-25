import { AuthError } from "next-auth";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { Link } from "@/i18n/navigation";
import { safeNext } from "@/lib/safe-redirect";

export default async function SignInPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string; next?: string; verified?: string; reset?: string }>;
}) {
  const { locale } = await params;
  const { error, next, verified, reset } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("signin");
  const target = safeNext(next, `/${locale}/dashboard`);

  async function action(form: FormData) {
    "use server";
    try {
      await signIn("credentials", { login: form.get("login"), password: form.get("password"), redirectTo: target });
    } catch (e) {
      if (e instanceof AuthError) redirect(`/${locale}/signin?error=1&next=${encodeURIComponent(target)}`);
      throw e;
    }
  }

  return (
    <main className="mx-auto grid max-w-sm gap-6 px-4 py-16">
      <h1 className="font-display text-h1 font-semibold">{t("title")}</h1>
      <form action={action} className="grid gap-4">
        <label className="grid gap-2 text-label text-ink-muted">
          {t("phone")}
          <input
            name="login"
            type="text"
            autoComplete="username"
            dir="ltr"
            required
            className="min-h-11 rounded-sm border border-field bg-surface px-3 text-body text-ink"
          />
        </label>
        <label className="grid gap-2 text-label text-ink-muted">
          {t("password")}
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="min-h-11 rounded-sm border border-field bg-surface px-3 text-body text-ink"
          />
        </label>
        {error && (
          <p role="alert" className="text-small text-down">
            {t("error")}
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
        <button className="rounded-sm bg-primary px-[18px] py-3 font-display font-semibold text-on-primary transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-[color-mix(in_oklab,var(--color-primary)_86%,#fff)]">
          {t("submit")}
        </button>
      </form>
      <p className="text-small text-ink-muted">
        <Link href="/forgot" className="text-ink underline underline-offset-4">
          {t("forgot")}
        </Link>
      </p>
      <p className="text-small text-ink-muted">
        {t("noAccount")}{" "}
        <Link href={{ pathname: "/signup", query: next ? { next } : {} }} className="text-ink underline underline-offset-4">
          {t("signUp")}
        </Link>
      </p>
    </main>
  );
}
