// Pure helpers for Ziina, kept out of ziina.ts so tests can import them without the database.

import { createHash } from "node:crypto";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN = /^[A-Za-z0-9_-]{16,80}$/;

/**
 * The webhook body is untrusted and its shape is undocumented, so we only harvest plausible
 * intent ids from it. Every candidate is then looked up against our own orders; a false positive
 * costs one indexed read and nothing else.
 */
export function intentCandidates(body: string): string[] {
  let data: unknown;
  try {
    data = JSON.parse(body);
  } catch {
    return [];
  }

  const keyed: string[] = [];
  const loose: string[] = [];
  const visit = (value: unknown, depth: number, key: string) => {
    if (depth > 3) return;
    if (typeof value === "string") {
      // A value under an `intent` key is trusted to be an id whatever its length; anything else
      // must look like a UUID or a long token, so prose is not mistaken for an id.
      const isIntentKey = /intent/i.test(key);
      if (isIntentKey ? !/^[A-Za-z0-9_-]{6,80}$/.test(value) : !UUID.test(value) && !TOKEN.test(value)) return;
      (isIntentKey ? keyed : loose).push(value);
      return;
    }
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item, depth + 1, key);
      return;
    }
    for (const [k, v] of Object.entries(value)) visit(v, depth + 1, k);
  };

  visit(data, 0, "");
  return [...new Set([...keyed, ...loose])].slice(0, 10);
}

/** A UUID derived from the order, so a double-click or retry is the same refund at Ziina. */
export function refundIdFor(orderId: string): string {
  const h = createHash("sha256").update(`ziina-refund:${orderId}`).digest("hex");
  const variant = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
