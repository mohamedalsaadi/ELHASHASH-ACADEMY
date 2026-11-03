"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { notifyAdmins } from "@/lib/notify";
import { countryRequestInput, subjectSlugFrom, teacherSubjectInput } from "@/lib/schemas/teacher-subject";
import { requireStaff, teacherCountryIds } from "@/lib/staff";

const refresh = () => {
  revalidatePath("/[locale]/teacher/subjects", "page");
  revalidatePath("/[locale]/teacher", "page");
};

/** A teacher adds a subject (new, or an existing one of the same name) to grades of a country they teach in. Instant; no approval. */
export async function createSubject(form: FormData) {
  const me = await requireStaff();
  const d = teacherSubjectInput.safeParse({ ...Object.fromEntries(form), gradeIds: form.getAll("gradeId") });
  if (!d.success) return;
  const { countryId, nameAr, nameEn, icon, gradeIds } = d.data;

  if (me.role !== "ADMIN" && !(await teacherCountryIds(me.id)).includes(countryId)) return;
  const grades = await db.grade.findMany({ where: { id: { in: gradeIds }, countryId, active: true }, select: { id: true } });
  if (grades.length !== gradeIds.length) return;

  const slug = subjectSlugFrom(nameEn);
  const subject =
    (await db.subject.findUnique({ where: { slug } })) ??
    (await db.subject.create({ data: { slug, nameAr, nameEn, icon, active: true } }));
  if (!subject.active) return;

  for (const gradeId of gradeIds) {
    const last = await db.gradeSubject.aggregate({ where: { gradeId }, _max: { order: true } });
    await db.gradeSubject.createMany({ data: [{ gradeId, subjectId: subject.id, order: (last._max.order ?? 0) + 1 }], skipDuplicates: true });
  }
  if (me.role !== "ADMIN") {
    await db.teacherSlot.createMany({ data: gradeIds.map((gradeId) => ({ userId: me.id, gradeId, subjectId: subject.id })), skipDuplicates: true });
    await db.teacherCountry.createMany({ data: [{ userId: me.id, countryId }], skipDuplicates: true });
  }
  refresh();
}

/** A teacher asks to also teach in another country; the owner is told and decides. */
export async function requestCountry(form: FormData) {
  const me = await requireStaff();
  const d = countryRequestInput.safeParse(Object.fromEntries(form));
  if (!d.success || me.role === "ADMIN") return;

  const country = await db.country.findFirst({ where: { id: d.data.countryId, active: true }, select: { id: true, nameAr: true, nameEn: true } });
  if (!country || (await teacherCountryIds(me.id)).includes(country.id)) return;
  if (await db.teacherCountryRequest.count({ where: { userId: me.id, countryId: country.id, status: "PENDING" } })) return;

  const req = await db.teacherCountryRequest.create({ data: { userId: me.id, countryId: country.id, note: d.data.note || null } });
  const who = await db.user.findUnique({ where: { id: me.id }, select: { name: true } });
  await notifyAdmins({
    kind: "SYSTEM",
    titleAr: `طلب معلم لدولة جديدة: ${who?.name ?? ""} ← ${country.nameAr}`,
    titleEn: `Teacher country request: ${who?.name ?? ""} → ${country.nameEn}`,
    href: "/admin/teachers",
    dedupeKey: `tcr:${req.id}`,
    email: false,
  });
  refresh();
}
