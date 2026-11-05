/**
 * The caller's address, from a header the platform controls.
 *
 * `x-forwarded-for` is client-writable unless a proxy overwrites it, so it must never be the first
 * choice for a rate-limit key: anyone could rotate the header and bypass every limit. Vercel sets
 * `x-real-ip` itself, so that is trusted first; the forwarded chain is only a fallback, and its last
 * hop is used rather than its first, since the first is the value the client can inject.
 */
export function clientIp(headers: Headers): string {
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real;
  const chain = headers.get("x-forwarded-for");
  if (chain) {
    const hops = chain.split(",").map((h) => h.trim()).filter(Boolean);
    if (hops.length > 0) return hops[hops.length - 1];
  }
  return "unknown";
}
