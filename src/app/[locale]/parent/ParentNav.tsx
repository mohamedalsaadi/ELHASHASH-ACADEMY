import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

const tab = "shrink-0 rounded-full px-4 py-2 text-small font-medium transition-colors duration-(--dur-fast) ease-(--ease-out)";

/** The parent's sections, like TeacherNav: children, messages, and the catalogue to buy for a child. */
export async function ParentNav({ current }: { current: "children" | "requests" }) {
  const t = await getTranslations("parent");
  const items = [
    { key: "children", href: "/parent", label: t("navChildren") },
    { key: "requests", href: "/parent/requests", label: t("navRequests") },
    { key: "courses", href: "/courses", label: t("navCourses") },
  ] as const;
  return (
    <nav className="flex flex-wrap gap-1 rounded-full bg-raised p-1 justify-self-start">
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
