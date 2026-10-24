import type { Metadata } from "next";
import { Readex_Pro, Reem_Kufi } from "next/font/google";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import "../globals.css";

const readex = Readex_Pro({
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-readex",
  display: "swap",
});

const kufi = Reem_Kufi({
  subsets: ["arabic", "latin"],
  weight: ["500", "600", "700"],
  variable: "--font-kufi",
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
    openGraph: { title, description, siteName: "Alsaadi Academy", locale: locale === "ar" ? "ar_AE" : "en_US", type: "website" },
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

  return (
    <html suppressHydrationWarning lang={locale} dir={locale === "ar" ? "rtl" : "ltr"} className={`${readex.variable} ${kufi.variable}`}>
      <body className="antialiased">
        <NextIntlClientProvider>
          <SiteHeader />
          {children}
          <SiteFooter />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
