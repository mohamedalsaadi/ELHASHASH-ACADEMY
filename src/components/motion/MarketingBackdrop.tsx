"use client";

import dynamic from "next/dynamic";
import { usePathname } from "@/i18n/navigation";

// GSAP stays out of app pages: this chunk is fetched only when a marketing route renders it.
const Backdrop = dynamic(() => import("./Backdrop").then((m) => m.Backdrop), { ssr: false });

// Home, the catalogue (country, grade, subject, course) and /teach. Lessons, checkout and the back offices stay calm.
const SHOWS = /^\/(?:$|courses(?:\/c\/[^/]+(?:\/[^/]+){0,2})?\/?$|courses\/[^/]+\/?$|teach\/?$)/;

export function MarketingBackdrop() {
  return SHOWS.test(usePathname()) ? <Backdrop /> : null;
}
