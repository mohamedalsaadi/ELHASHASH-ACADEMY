"use client";

import type { ComponentProps } from "react";
import NextLink from "next/link";
import { useLocale } from "next-intl";
import { createNavigation } from "next-intl/navigation";
import { routing, type Locale } from "./routing";

const { getPathname } = createNavigation(routing);
type Href = Parameters<typeof getPathname>[0]["href"];

type Props = Omit<ComponentProps<typeof NextLink>, "href"> & {
  href: Href;
  locale?: Locale;
  /** Appended after the locale-resolved path, without the leading #. */
  hash?: string;
};

// A plain next/link. The page-wide view transition it used to run froze the old page until the new route mounted
// (up to the browser's 4 s cap on slow lesson pages) and its aborted promises were most of the site's error log.
/** Localized next-intl Link. */
export function Link({ href, locale, hash, ...rest }: Props) {
  const current = useLocale() as Locale;
  const target = getPathname({ href, locale: locale ?? current });
  return <NextLink href={hash ? `${target}#${hash.replace(/^#/, "")}` : target} {...rest} />;
}
