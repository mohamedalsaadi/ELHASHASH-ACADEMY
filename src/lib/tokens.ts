import type { TokenKind } from "@/generated/prisma/client";
import { db } from "./db";
import { hashToken, newToken } from "./token-utils";

const DAY = 86_400_000;

export const RESET_TTL = 30 * 60_000;
export const VERIFY_TTL = 2 * DAY;

/** Creates a single-use token and returns the raw value, which is only ever put in the email link. */
export async function issueToken(userId: string, kind: TokenKind, ttlMs: number): Promise<string> {
  const raw = newToken();
  await db.token.create({ data: { userId, kind, tokenHash: hashToken(raw), expiresAt: new Date(Date.now() + ttlMs) } });
  return raw;
}

/** Marks the token used atomically; a second click or a scanner's retry gets null. */
export async function consumeToken(raw: string, kind: TokenKind) {
  const token = await db.token.findUnique({ where: { tokenHash: hashToken(raw) } });
  if (!token || token.kind !== kind || token.usedAt || token.expiresAt <= new Date()) return null;
  const { count } = await db.token.updateMany({ where: { id: token.id, usedAt: null }, data: { usedAt: new Date() } });
  return count === 1 ? token : null;
}
