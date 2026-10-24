import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

const tab = "rounded-sm px-3 py-2 font-display text-label transition-colors duration-(--dur-fast) ease-(--ease-out)";

export async function TeacherNav({ current }: { current: "home" | "live" | "profile" }) {
  const t = await getTranslations("teacher");
  const items = [
    { key: "home", href: "/teacher", label: t("navHome") },
    { key: "live", href: "/teacher/live", label: t("navLive") },
    { key: "profile", href: "/teacher/profile", label: t("navProfile") },
  ] as const;
  return (
    <nav className="flex flex-wrap items-center gap-1 border-b border-hairline pb-3">
      {items.map((i) => (
        <Link
          key={i.key}
          href={i.href}
          aria-current={current === i.key ? "page" : undefined}
          className={`${tab} ${current === i.key ? "bg-raised text-ink" : "text-ink-muted hover:bg-raised"}`}
        >
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
