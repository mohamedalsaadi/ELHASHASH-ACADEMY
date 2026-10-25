"use client";

import type { ComponentProps } from "react";
import { useLocale } from "next-intl";
import { createNavigation } from "next-intl/navigation";
import { Link as TransitionLink } from "next-view-transitions";
import { routing, type Locale } from "./routing";

const { getPathname } = createNavigation(routing);
type Href = Parameters<typeof getPathname>[0]["href"];

type Props = Omit<ComponentProps<typeof TransitionLink>, "href"> & {
  href: Href;
  locale?: Locale;
  /** Appended after the locale-resolved path, without the leading #. */
  hash?: string;
};

/** Localized next-intl Link that also runs a page transition. */
export function Link({ href, locale, hash, ...rest }: Props) {
  const current = useLocale() as Locale;
  const target = getPathname({ href, locale: locale ?? current });
  return <TransitionLink href={hash ? `${target}#${hash.replace(/^#/, "")}` : target} {...rest} />;
}
