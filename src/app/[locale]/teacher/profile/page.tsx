import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireStaff } from "@/lib/staff";
import { PasswordForm } from "../../admin/ui";
import { TeacherNav } from "../TeacherNav";

export const dynamic = "force-dynamic";

export default async function TeacherProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireStaff();
  const t = await getTranslations("teacher");
  const ta = await getTranslations("admin");

  return (
    <main className="mx-auto grid max-w-3xl gap-10 px-4 py-12">
      <div className="grid gap-4">
        <h1 className="font-display text-h1 font-semibold">{t("navProfile")}</h1>
        <TeacherNav current="profile" />
      </div>

      <section className="grid gap-3">
        <h2 className="font-display text-h2 font-semibold">{ta("changePassword")}</h2>
        <PasswordForm />
      </section>
    </main>
  );
}
