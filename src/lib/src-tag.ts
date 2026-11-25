// Where a visitor came from: `?src=` on our own links (ig-story, share-wa, ...) or `utm_source` from ad platforms.
// The middleware keeps the latest tag in a cookie, so a sign-up or a checkout days later still knows the ad.
import type { Prisma } from "@/generated/prisma/client";

export const SRC_COOKIE = "dh_src";
export const SRC_COOKIE_DAYS = 30;

/** The tag from a URL's query, lowercased and cut to safe characters, or null when there is none. */
export function srcTag(q: URLSearchParams): string | null {
  const raw = (q.get("src") || q.get("utm_source") || "").toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 40);
  return raw || null;
}

/** Adds `src` to an event's props unless the caller already set a non-empty one. Non-object props are left alone. */
export function withSrc(props: Prisma.InputJsonValue | undefined, src: string | null): Prisma.InputJsonValue | undefined {
  if (!src) return props;
  if (props === undefined) return { src };
  if (typeof props !== "object" || props === null || Array.isArray(props)) return props;
  const p = props as Record<string, Prisma.InputJsonValue>;
  return p.src ? props : { ...p, src };
}
