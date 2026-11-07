// One-time codes for phone sign-in. The code is never stored, only a keyed hash; a proof is the signed
// statement "this phone was verified a moment ago", good for fifteen minutes, so a new account can be finished.
import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "./db";
import { newCode } from "./token-utils";

export const OTP_TTL_MS = 10 * 60_000;
export const OTP_MAX_TRIES = 5;
export const PROOF_TTL_MS = 15 * 60_000;

function mac(text: string) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return createHmac("sha256", secret).update(text).digest("hex");
}
const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export const hashCode = (phone: string, code: string) => mac(`otp:${phone}:${code}`);

export function signProof(phone: string, now = Date.now()) {
  const body = `${phone}|${now + PROOF_TTL_MS}`;
  return `${Buffer.from(body).toString("base64url")}.${mac(`proof:${body}`)}`;
}

/** The phone a valid, unexpired proof speaks for; null for anything else. */
export function readProof(proof: string, now = Date.now()): string | null {
  const [encoded, sig] = proof.split(".");
  if (!encoded || !sig) return null;
  const body = Buffer.from(encoded, "base64url").toString();
  if (!same(sig, mac(`proof:${body}`))) return null;
  const [phone, exp] = body.split("|");
  return phone && Number(exp) > now ? phone : null;
}

/** A fresh code for `phone`; any earlier unused one stops working. */
export async function issueOtp(phone: string) {
  const code = newCode();
  await db.otpCode.deleteMany({ where: { phone, consumedAt: null } });
  await db.otpCode.create({ data: { phone, codeHash: hashCode(phone, code), expiresAt: new Date(Date.now() + OTP_TTL_MS) } });
  return code;
}

/** True once, for the right code inside its window and its five tries. */
export async function checkOtp(phone: string, code: string) {
  const row = await db.otpCode.findFirst({ where: { phone, consumedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } });
  if (!row || row.attempts >= OTP_MAX_TRIES) return false;
  if (!same(row.codeHash, hashCode(phone, code))) {
    await db.otpCode.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
    return false;
  }
  // The conditional update makes the code single-use even when two requests arrive together.
  return (await db.otpCode.updateMany({ where: { id: row.id, consumedAt: null }, data: { consumedAt: new Date() } })).count === 1;
}
