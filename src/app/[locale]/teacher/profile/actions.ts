"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { avatarPrefix, blobInfo } from "@/lib/blob";
import { db } from "@/lib/db";
import { maskContacts } from "@/lib/contact-guard";
import { isValidIban, normalizeIban } from "@/lib/iban";
import { redirectLocal } from "@/lib/redirect-locale";
import { requireStaff } from "@/lib/staff";

/** A bio is public, so it follows the same contact rule as questions and support messages. */
const maskedBio = (text: string) => (text ? maskContacts(text).text : null);

/** The public half of a teacher's account: display name, avatar and the two bios. */
export async function updateTeacherProfile(form: FormData) {
  const me = await requireStaff();
  const d = z
    .object({
      name: z.string().trim().min(2).max(80),
      bioAr: z.string().trim().max(2000).default(""),
      bioEn: z.string().trim().max(2000).default(""),
      photoKey: z.string().trim().max(500).default(""),
      yearsTeaching: z.coerce.number().int().min(1).max(60).optional().or(z.literal("").transform(() => undefined)),
      qualification: z.string().trim().max(120).default(""),
    })
    .parse(Object.fromEntries(form));

  let photo: { photoUrl: string | null; photoType: string | null } = { photoUrl: null, photoType: null };
  if (d.photoKey) {
    // Only this teacher's own avatar object, and only a real image.
    if (!d.photoKey.startsWith(avatarPrefix(me.id))) return;
    const info = await blobInfo(d.photoKey);
    if (!info) return;
    photo = { photoUrl: d.photoKey, photoType: info.contentType };
  }

  await db.user.update({
    where: { id: me.id },
    data: {
      name: d.name,
      bioAr: maskedBio(d.bioAr),
      bioEn: maskedBio(d.bioEn),
      yearsTeaching: d.yearsTeaching ?? null,
      qualification: d.qualification ? maskContacts(d.qualification).text : null,
      ...photo,
    },
  });
  revalidatePath("/[locale]/teacher", "layout");
  revalidatePath("/[locale]/teachers", "layout");
}

/** Where the owner sends this teacher's money. Private: shown masked, read in full only by the admin payouts page. */
export async function savePayoutDetails(form: FormData) {
  const me = await requireStaff();
  const d = z
    .object({ holder: z.string().trim().min(2).max(120), bank: z.string().trim().min(2).max(120), iban: z.string().trim().max(60) })
    .safeParse(Object.fromEntries(form));
  if (!d.success || !isValidIban(d.data.iban)) return redirectLocal("/teacher/profile?payout=invalid#payout");
  await db.user.update({ where: { id: me.id }, data: { payoutHolder: d.data.holder, payoutBank: d.data.bank, payoutIban: normalizeIban(d.data.iban) } });
  revalidatePath("/[locale]/teacher", "layout");
  return redirectLocal("/teacher/profile?payout=saved#payout");
}
