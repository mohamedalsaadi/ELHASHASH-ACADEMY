"use server";

import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { signIn } from "@/auth";
import { logEvent } from "@/lib/analytics";
import { db } from "@/lib/db";
import { clientIp } from "@/lib/client-ip";
import { isLimited, recordAttempt } from "@/lib/rate-limit";
import { PASSWORD_MAX, PASSWORD_MIN } from "@/lib/schemas/auth";
import { hashToken } from "@/lib/token-utils";

export type InviteAcceptState = { error: "invalid" | "too_many" | "password" | "weak" } | null;

class InviteError extends Error {
  constructor(readonly code: "invalid" | "password") {
    super(code);
  }
}

export async function acceptInvite(_: InviteAcceptState, form: FormData): Promise<InviteAcceptState> {
  const locale = await getLocale();
  const token = String(form.get("token") ?? "");
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  if (!token) return { error: "invalid" };
  if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) return { error: "weak" };
  if (password !== confirm) return { error: "password" };

  const ip = clientIp(await headers());
  const key = `invite:${ip}`;
  if (await isLimited(key, 10, 15 * 60_000)) return { error: "too_many" };

  const tokenHash = hashToken(token);
  let accepted: { login: string; userId: string; slots: number };
  try {
    accepted = await db.$transaction(async (trx) => {
      const invite = await trx.teacherInvite.findUnique({ where: { tokenHash }, include: { slots: true } });
      if (!invite || invite.usedAt || invite.expiresAt <= new Date()) throw new InviteError("invalid");

      // Claim the token inside the same transaction as the account write, so a failure does not burn it.
      const { count } = await trx.teacherInvite.updateMany({
        where: { id: invite.id, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });
      if (count !== 1) throw new InviteError("invalid");

      const existing = invite.email
        ? await trx.user.findUnique({ where: { email: invite.email } })
        : invite.phone
          ? await trx.user.findUnique({ where: { phone: invite.phone } })
          : null;

      let userId: string;
      if (existing) {
        // An existing account is only promoted by someone who knows its password; an invite never resets it.
        if (!(await bcrypt.compare(password, existing.passwordHash))) throw new InviteError("password");
        userId = existing.id;
        if (existing.role !== "ADMIN") {
          await trx.user.update({
            where: { id: userId },
            data: {
              role: "INSTRUCTOR",
              emailVerifiedAt: existing.emailVerifiedAt ?? (invite.email ? new Date() : null),
            },
          });
        }
      } else {
        const user = await trx.user.create({
          data: {
            name: invite.name,
            email: invite.email,
            phone: invite.phone,
            role: "INSTRUCTOR",
            passwordHash: await bcrypt.hash(password, 10),
            emailVerifiedAt: invite.email ? new Date() : null,
            locale,
          },
        });
        userId = user.id;
      }

      await trx.teacherSlot.createMany({
        data: invite.slots.map((s) => ({ userId, gradeId: s.gradeId, subjectId: s.subjectId })),
        skipDuplicates: true,
      });

      return { login: invite.email ?? invite.phone ?? "", userId, slots: invite.slots.length };
    });
  } catch (e) {
    if (e instanceof InviteError) {
      await recordAttempt(key);
      return { error: e.code };
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { error: "invalid" };
    throw e;
  }

  await recordAttempt(key);
  await logEvent({ name: "invite_accepted", userId: accepted.userId, props: { slots: accepted.slots } });
  revalidatePath("/[locale]", "layout");
  // The old cookie may still say STUDENT; sign in again so the header and token agree with the database.
  await signIn("credentials", { login: accepted.login, password, redirectTo: `/${locale}/teacher` });
  return null;
}
