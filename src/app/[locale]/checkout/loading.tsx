import { getTranslations } from "next-intl/server";
import { PageSkeleton } from "@/components/ui/PageSkeleton";

export default async function Loading() {
  const t = await getTranslations("common");
  return <PageSkeleton label={t("loading")} rows={3} />;
}
