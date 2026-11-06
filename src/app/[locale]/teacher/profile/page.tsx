import { pageMetadata } from "@/lib/seo";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ImageUpload } from "@/components/ImageUpload";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/staff";
import { avatarPrefix } from "@/lib/blob";
import { SaveButton, PasswordForm } from "../../admin/ui";
import { field, label } from "@/components/ui/form";
import { TeacherNav } from "../TeacherNav";
import { updateTeacherProfile } from "./actions";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return pageMetadata(params, "/teacher/profile", "teacher", { key: "navProfile", noindex: true });
}

export default async function TeacherProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const me = await requireStaff();
  const t = await getTranslations("teacher");
  const ta = await getTranslations("admin");

  const user = await db.user.findUniqueOrThrow({
    where: { id: me.id },
    select: { name: true, bioAr: true, bioEn: true, photoUrl: true, yearsTeaching: true, qualification: true },
  });

  return (
    <main className="mx-auto grid max-w-3xl gap-10 px-4 py-12">
      <div className="grid gap-4">
        <h1 className="font-display text-h1 font-semibold">{t("navProfile")}</h1>
        <TeacherNav current="profile" />
      </div>

      <form action={updateTeacherProfile} className="grid gap-3">
        <h2 className="font-display text-h2 font-semibold">{t("publicProfile")}</h2>
        <p className="text-small text-ink-muted">{t("publicProfileHint")}</p>
        <label className={label}>
          {t("displayName")}
          <input name="name" defaultValue={user.name} required minLength={2} maxLength={80} className={field} />
        </label>
        <label className={label}>
          {t("bioAr")}
          <textarea name="bioAr" defaultValue={user.bioAr ?? ""} rows={4} maxLength={2000} dir="rtl" className={`${field} py-2`} />
        </label>
        <label className={label}>
          {t("bioEn")}
          <textarea name="bioEn" defaultValue={user.bioEn ?? ""} rows={4} maxLength={2000} dir="ltr" className={`${field} py-2`} />
        </label>
        <label className={label}>
          {t("yearsTeaching")}
          <input name="yearsTeaching" type="number" min={1} max={60} defaultValue={user.yearsTeaching ?? ""} className={`${field} num`} />
        </label>
        <label className={label}>
          {t("qualification")}
          <input name="qualification" maxLength={120} defaultValue={user.qualification ?? ""} dir="auto" className={field} />
        </label>
        <ImageUpload
          pathPrefix={avatarPrefix(me.id)}
          clientPayload={JSON.stringify({ purpose: "avatar", userId: me.id })}
          name="photoKey"
          defaultPath={user.photoUrl}
          currentSrc={user.photoUrl ? `/api/avatars/${me.id}` : null}
          label={t("photo")}
          failedLabel={ta("coverFailed")}
          removeLabel={ta("coverRemove")}
        />
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
