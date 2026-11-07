import { getTranslations } from "next-intl/server";
import { signIn } from "@/auth";
import { safeNext } from "@/lib/safe-redirect";

/** A provider shows only when its keys are set, so a button never leads to an error page. */
const PROVIDERS = [
  { id: "google", label: "google", on: () => Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) },
  { id: "microsoft-entra-id", label: "microsoft", on: () => Boolean(process.env.AUTH_MICROSOFT_ENTRA_ID_ID && process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET) },
] as const;

/** "Continue with Google / Microsoft" above a form, with the "or" rule. Renders nothing while no provider is configured. */
export async function SocialButtons({ locale, next }: { locale: string; next?: string }) {
  const shown = PROVIDERS.filter((p) => p.on());
  if (shown.length === 0) return null;
  const t = await getTranslations("signin");

  async function go(form: FormData) {
    "use server";
    const provider = PROVIDERS.find((p) => p.id === form.get("provider"));
    // The dashboard sends a new account to finish its profile before anything else.
    if (provider?.on()) await signIn(provider.id, { redirectTo: safeNext(String(form.get("next") ?? ""), `/${locale}/dashboard`) });
  }

  return (
    <div className="grid gap-3">
      {shown.map((p) => (
        <form key={p.id} action={go}>
          <input type="hidden" name="provider" value={p.id} />
          <input type="hidden" name="next" value={next ?? ""} />
          <button className="btn btn-outline w-full">{t(p.label)}</button>
        </form>
      ))}
      <p className="text-center text-small text-ink-muted">{t("or")}</p>
    </div>
  );
}
