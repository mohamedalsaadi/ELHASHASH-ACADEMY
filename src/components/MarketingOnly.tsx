"use client";

import { usePathname } from "@/i18n/navigation";

// Public pages that carry brand furniture (the New banner). App pages stay calm: tokens and mark only.
const MARKETING = /^\/(?:$|courses(?:\/c\/[^/]+(?:\/[^/]+){0,2})?\/?$|courses\/[^/]+\/?$|teachers\/[^/]+\/?$|(?:faq|contact|privacy|terms|refund)\/?$)/;

/** Renders its children only on marketing routes. The children are server-rendered; this only decides to show them. */
export function MarketingOnly({ children }: { children: React.ReactNode }) {
  return MARKETING.test(usePathname()) ? children : null;
}
