import { getTranslations, setRequestLocale } from "next-intl/server";
import { TeacherPhoto } from "@/components/TeacherPhoto";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/staff";
import { updateProfile } from "../../admin/actions";
import { field, label } from "../../admin/styles";
import { PasswordForm, SaveButton } from "../../admin/ui";
import { TeacherNav } from "../TeacherNav";

export const dynamic = "force-dynamic";

const card = "grid gap-4 rounded-md border border-hairline bg-surface p-4";

export default async function TeacherProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const me = await requireStaff();
  const t = await getTranslations("teacher");
  const ta = await getTranslations("admin");
  const user = await db.user.findUniqueOrThrow({ where: { id: me.id }, select: { name: true, photoUrl: true, bioAr: true, bioEn: true } });

  return (
    <main className="mx-auto grid max-w-3xl gap-10 px-4 py-12">
      <div className="grid gap-4">
        <h1 className="font-display text-h1 font-semibold">{t("navProfile")}</h1>
        <TeacherNav current="profile" id={me.id} />
      </div>

      <form action={updateProfile} className={card}>
        <div className="flex items-center gap-4">
          <TeacherPhoto name={user.name} url={user.photoUrl} size={72} />
          <p className="max-w-[45ch] text-small text-ink-muted">{t("profileHint")}</p>
        </div>
        <label className={label}>
          {t("photoUrl")}
          <input name="photoUrl" type="url" defaultValue={user.photoUrl ?? ""} placeholder="https://" dir="ltr" className={field} />
        </label>
        <label className={label}>
          {t("bioAr")}
          <textarea name="bioAr" defaultValue={user.bioAr ?? ""} rows={4} maxLength={2000} dir="rtl" className={`${field} py-2`} />
        </label>
        <label className={label}>
          {t("bioEn")}
          <textarea name="bioEn" defaultValue={user.bioEn ?? ""} rows={4} maxLength={2000} dir="ltr" className={`${field} py-2`} />
        </label>
        <div>
          <SaveButton />
        </div>
      </form>

      <section className="grid gap-3">
        <h2 className="font-display text-h2 font-semibold">{ta("changePassword")}</h2>
        <PasswordForm />
      </section>
    </main>
  );
}
