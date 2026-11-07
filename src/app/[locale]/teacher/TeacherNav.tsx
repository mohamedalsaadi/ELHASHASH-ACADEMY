import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

const tab =
  "inline-flex min-h-11 shrink-0 items-center rounded-full px-4 py-2 text-small font-medium transition-colors duration-(--dur-fast) ease-(--ease-out)";

export async function TeacherNav({
  current,
}: {
  current:
    | "home"
    | "courses"
    | "subjects"
    | "live"
    | "assignments"
    | "bank"
    | "exams"
    | "requests"
    | "analytics"
    | "questions"
    | "profile"
    | "earnings";
}) {
  const t = await getTranslations("teacher");
  const items = [
    { key: "home", href: "/teacher", label: t("navHome") },
    { key: "courses", href: "/teacher#courses", label: t("navCourses") },
    { key: "subjects", href: "/teacher/subjects", label: t("navSubjects") },
    {
      key: "assignments",
      href: "/teacher/assignments",
      label: t("navHomework"),
    },
    { key: "bank", href: "/teacher/bank", label: t("navBank") },
    { key: "exams", href: "/teacher/exams", label: t("navExams") },
    { key: "earnings", href: "/teacher/earnings", label: t("navEarnings") },
    { key: "analytics", href: "/teacher/analytics", label: t("navAnalytics") },
    { key: "live", href: "/teacher/live", label: t("navLive") },
    { key: "questions", href: "/teacher/questions", label: t("navQuestions") },
    { key: "requests", href: "/teacher/requests", label: t("navRequests") },
    { key: "profile", href: "/teacher/profile", label: t("navProfile") },
  ] as const;
  return (
    <nav className="subnav">
      {items.map((i) => (
        <Link
          key={i.key}
          href={i.href}
          aria-current={current === i.key ? "page" : undefined}
          className={`${tab} ${current === i.key ? "bg-surface text-ink shadow-paper" : "text-ink-muted hover:text-ink"}`}
        >
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
