import { db } from "./db";
import { phoneCandidates } from "./phone";

/**
 * Finds the user a phone number belongs to, however it was typed. Accounts made with the country-code picker
 * hold "+971501234567" while a parent or a sign-in types "0501234567"; the exact text wins, then every picker country.
 */
export async function findUserByPhone(phone: string) {
  const exact = await db.user.findUnique({ where: { phone } });
  if (exact || phone.startsWith("+")) return exact;
  return db.user.findFirst({ where: { phone: { in: phoneCandidates(phone) } } });
}
