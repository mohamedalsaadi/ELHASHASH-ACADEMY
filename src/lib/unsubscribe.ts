// One-click unsubscribe for optional email. The link carries the user id and an HMAC of it, so it needs no stored token
// and cannot be forged for someone else's account. Receipts, security and consent mail never use it.
import { createHmac, timingSafeEqual } from "node:crypto";
import type { NotificationKind } from "@/generated/prisma/client";

/** Kinds that always reach the person: money records and system messages. Everything else can be switched off. */
const ESSENTIAL: readonly NotificationKind[] = ["ORDER_PAID", "SYSTEM"];
export const isOptionalKind = (kind: NotificationKind) => !ESSENTIAL.includes(kind);

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return s;
}

export const unsubscribeSig = (userId: string) => createHmac("sha256", secret()).update(`unsubscribe:${userId}`).digest("base64url");

export function verifyUnsubscribe(userId: string, sig: string): boolean {
  const a = Buffer.from(sig);
  const b = Buffer.from(unsubscribeSig(userId));
  return a.length === b.length && timingSafeEqual(a, b);
}

export const unsubscribeUrl = (base: string, userId: string) =>
  `${base}/api/unsubscribe?u=${encodeURIComponent(userId)}&s=${unsubscribeSig(userId)}`;
