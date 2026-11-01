import type { Metadata } from "next";
import { Readex_Pro } from "next/font/google";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ViewTransitions } from "next-view-transitions";
import { routing } from "@/i18n/routing";
import { RouteAnnouncer } from "@/components/RouteAnnouncer";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { PwaRegister } from "@/components/PwaRegister";
import "../globals.css";

const readex = Readex_Pro({
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-readex",
  display: "swap",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  const title = t("title"), description = t("description");
  return {
    metadataBase: new URL(process.env.APP_URL || "http://localhost:3000"),
    title: { default: title, template: `%s · ${title}` },
    description,
    openGraph: { title, description, siteName: "A+ Academy", locale: locale === "ar" ? "ar_AE" : "en_US", type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("nav");

  return (
    <html suppressHydrationWarning lang={locale} dir={locale === "ar" ? "rtl" : "ltr"} className={readex.variable}>
      <body className="antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:start-3 focus:z-[60] focus:rounded-sm focus:bg-surface focus:px-4 focus:py-2 focus:text-ink focus:shadow-paper"
        >
          {t("skipToContent")}
        </a>
        <PwaRegister />
        <ViewTransitions>
          <NextIntlClientProvider>
            <SiteHeader />
            <div id="main-content" tabIndex={-1} className="outline-none">
              {children}
            </div>
            <SiteFooter />
          </NextIntlClientProvider>
        </ViewTransitions>
        <RouteAnnouncer />
      </body>
    </html>
  );
}
