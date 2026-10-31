import { pageMetadata } from "@/lib/seo";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { logEventLater } from "@/lib/analytics";
import { db } from "@/lib/db";
import { SignUpForm } from "./SignUpForm";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return pageMetadata(params, "/signup", "signup", { key: "title", noindex: true });
}

export default async function SignUpPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { locale } = await params;
  const { next } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("signup");
  const ar = locale === "ar";
  const countries = await db.country.findMany({
    where: { active: true },
    orderBy: { order: "asc" },
    include: { grades: { where: { active: true }, orderBy: [{ order: "asc" }, { level: "asc" }] } },
  });
  const groups = countries.map((c) => ({ label: ar ? c.nameAr : c.nameEn, grades: c.grades.map((g) => ({ id: g.id, name: ar ? g.nameAr : g.nameEn })) }));

  void logEventLater({ name: "signup_viewed", dedupeScope: "signup" });

  return (
    <main className="mx-auto grid max-w-sm gap-6 px-4 py-16">
      <h1 className="font-display text-h1 font-semibold">{t("title")}</h1>
      <SignUpForm groups={groups} locale={locale} next={next ?? ""} />
      <p className="text-small text-ink-muted">
        {t("haveAccount")}{" "}
        <Link href={{ pathname: "/signin", query: next ? { next } : {} }} className="text-ink underline underline-offset-4">
          {t("signIn")}
        </Link>
      </p>
    </main>
  );
}
