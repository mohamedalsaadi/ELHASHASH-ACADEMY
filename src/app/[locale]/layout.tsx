import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Arabic, Readex_Pro, Reem_Kufi } from "next/font/google";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ViewTransitions } from "next-view-transitions";
import { routing } from "@/i18n/routing";
import { RouteAnnouncer } from "@/components/RouteAnnouncer";
import { SiteFooter } from "@/components/SiteFooter";
import { MarketingOnly } from "@/components/MarketingOnly";
import { NewsBanner } from "@/components/NewsBanner";
import { SiteHeader } from "@/components/SiteHeader";
import { PwaRegister } from "@/components/PwaRegister";
import "../globals.css";

const plex = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex",
  display: "swap",
});
const readex = Readex_Pro({
  subsets: ["arabic", "latin"],
  weight: ["500", "600", "700"],
  variable: "--font-readex",
  display: "swap",
});

// Reem Kufi: the Arabic wordmark only (DESIGN.md §0).
const reem = Reem_Kufi({
  subsets: ["arabic", "latin"],
  weight: ["700"],
  variable: "--font-reem",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F5F5F7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

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
    openGraph: { title, description, siteName: "Dhirwa", locale: locale === "ar" ? "ar_AE" : "en_US", type: "website" },
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
    <html suppressHydrationWarning lang={locale} dir={locale === "ar" ? "rtl" : "ltr"} className={`${plex.variable} ${readex.variable} ${reem.variable}`}>
      <head>
        {/* Blocking on purpose: it sets the theme before the first paint. Same-origin, so the CSP stays strict. */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="/theme-guard.js" />
      </head>
      <body className="antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:start-3 focus:z-[60] focus:rounded-full focus:bg-surface focus:px-4 focus:py-2 focus:text-ink focus:shadow-paper"
        >
          {t("skipToContent")}
        </a>
        <PwaRegister />
        <ViewTransitions>
          <NextIntlClientProvider>
            <MarketingOnly>
              <NewsBanner />
            </MarketingOnly>
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
