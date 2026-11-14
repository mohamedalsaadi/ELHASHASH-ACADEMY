import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { db } from "./db";
import { BCRYPT_COST } from "./schemas/auth";

/**
 * A code or link sent to a phone has just been used, so its holder owns the number. A row that never had that proof
 * (password signup and the profile form only type the number) may belong to someone who does not hold it: its password
 * is replaced and its older sessions end (the new passwordChangedAt), and the number is marked verified. A row that is
 * already verified is left alone. Returns true when it reset a row.
 */
export async function claimProvenPhone(user: { id: string; phoneVerifiedAt: Date | null }) {
  if (user.phoneVerifiedAt) return false;
  const now = new Date();
  const { count } = await db.user.updateMany({
    where: { id: user.id, phoneVerifiedAt: null },
    data: { phoneVerifiedAt: now, passwordHash: await bcrypt.hash(randomUUID(), BCRYPT_COST), passwordChangedAt: now },
  });
  return count > 0;
}
