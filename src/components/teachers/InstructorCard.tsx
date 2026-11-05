import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export type InstructorSummary = {
  id: string;
  name: string;
  photoUrl: string | null;
  bioAr: string | null;
  bioEn: string | null;
  liveApproved: boolean;
};

/**
 * One teacher, advertised. Leads with who they are — photo and bio — and keeps the facts small.
 * Deliberately shows nothing about their students: comparing teachers on the marks of minors would
 * mislead, and those numbers are not ours to publish.
 */
export function InstructorCard({
  instructor: i,
  lessons,
  courseSlug,
  locale,
}: {
  instructor: InstructorSummary;
  lessons: number;
  courseSlug: string;
  locale: string;
}) {
  const t = useTranslations("catalog");
  const ar = locale === "ar";
  // Fall back to the other language rather than showing an empty line.
  const bio = ar ? i.bioAr || i.bioEn : i.bioEn || i.bioAr;

  return (
    <article className="grid h-full content-start gap-3 card p-5">
      <div className="flex items-center gap-3">
        {i.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/avatars/${i.id}`} alt="" className="size-14 shrink-0 rounded-full object-cover" />
        ) : (
          <span
            aria-hidden="true"
            className="grid size-14 shrink-0 place-items-center rounded-full bg-raised font-display text-h3 font-bold text-ink-muted"
          >
            {i.name.trim().charAt(0)}
          </span>
        )}
        <span className="grid min-w-0 gap-0.5">
          <span className="truncate font-display text-h3 font-bold">{i.name}</span>
          {i.liveApproved && (
            <span className="w-fit rounded-full border border-pen px-2 py-0.5 text-label font-medium text-pen">{t("liveAvailable")}</span>
          )}
        </span>
      </div>

      {bio && <p className="line-clamp-3 text-small text-ink-muted">{bio}</p>}

      {lessons > 0 && <p className="num text-small text-ink-muted">{t("lessonsRecorded", { count: lessons })}</p>}

      <div className="mt-1 flex flex-wrap items-center gap-3 border-t border-hairline pt-3">
        <Link href={`/courses/${courseSlug}`} className="btn btn-primary px-4 py-2 text-small">
          {t("openCourse")}
        </Link>
        <Link href={`/teachers/${i.id}`} className="min-h-11 content-center text-small text-pen underline underline-offset-4">
          {t("viewProfile")}
        </Link>
      </div>
    </article>
  );
}
