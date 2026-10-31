"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { avatarPrefix, blobInfo } from "@/lib/blob";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/staff";

/** The public half of a teacher's account: display name, avatar and the two bios. */
export async function updateTeacherProfile(form: FormData) {
  const me = await requireStaff();
  const d = z
    .object({
      name: z.string().trim().min(2).max(80),
      bioAr: z.string().trim().max(2000).default(""),
      bioEn: z.string().trim().max(2000).default(""),
      photoKey: z.string().trim().max(500).default(""),
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
    data: { name: d.name, bioAr: d.bioAr || null, bioEn: d.bioEn || null, ...photo },
  });
  revalidatePath("/[locale]/teacher", "layout");
  revalidatePath("/[locale]/teachers", "layout");
}
