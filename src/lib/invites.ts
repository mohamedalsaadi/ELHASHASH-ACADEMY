import { db } from "./db";
import { hashToken, newToken } from "./token-utils";

const DAY = 86_400_000;
export const INVITE_TTL = 7 * DAY;

export type InviteSlot = { gradeId: string; subjectId: string };

/** Creates an invitation and returns the raw token, which is only ever put in the link. */
export async function issueInvite(input: {
  name: string;
  email: string | null;
  phone: string | null;
  slots: InviteSlot[];
  createdById: string;
}) {
  const raw = newToken();
  const invite = await db.teacherInvite.create({
    data: {
      name: input.name,
      email: input.email,
      phone: input.phone,
      tokenHash: hashToken(raw),
      expiresAt: new Date(Date.now() + INVITE_TTL),
      createdById: input.createdById,
      slots: { create: input.slots },
    },
  });
  return { raw, invite };
}

/** Loads an invitation by its raw link token, with the names needed to show it. */
export function findInvite(raw: string) {
  return db.teacherInvite.findUnique({
    where: { tokenHash: hashToken(raw) },
    include: {
      slots: {
        include: {
          grade: { include: { country: true } },
          subject: true,
        },
      },
    },
  });
}

export function inviteIsOpen(invite: { usedAt: Date | null; expiresAt: Date }, now = new Date()) {
  return !invite.usedAt && invite.expiresAt > now;
}
