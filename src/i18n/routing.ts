import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["ar", "en"],
  defaultLocale: "ar",
  // Arabic-first: many students run English-language phones, so don't redirect on Accept-Language.
  localeDetection: false,
});

export type Locale = (typeof routing.locales)[number];
