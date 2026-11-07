import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["ar", "en"],
  defaultLocale: "ar",
  // Arabic-first: many students run English-language phones, so don't redirect on Accept-Language.
  localeDetection: false,
  // The language cookie is only read by the server, so the page script never needs it.
  localeCookie: { sameSite: "lax", secure: process.env.NODE_ENV === "production" },
});

export type Locale = (typeof routing.locales)[number];
