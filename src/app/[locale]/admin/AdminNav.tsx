import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

const tab = "shrink-0 rounded-sm px-3 py-2 font-display text-label transition-colors duration-(--dur-fast) ease-(--ease-out)";
const TABS = [
  ["overview", "/admin"],
  ["subscribers", "/admin/subscribers"],
  ["teachers", "/admin/teachers"],
  ["courses", "/admin/courses"],
  ["catalog", "/admin/catalog"],
  ["orders", "/admin/orders"],
  ["live", "/admin/live"],
  ["questions", "/admin/questions"],
  ["marketing", "/admin/marketing"],
] as const;

export type AdminTab = (typeof TABS)[number][0];

/** The back office's sections, like TeacherNav; wraps on phones so the current tab stays in view. */
export async function AdminNav({ current, title }: { current: AdminTab; title?: string }) {
  const t = await getTranslations("office.nav");
  return (
    <div className="grid gap-4">
      <h1 className="font-display text-h1 font-semibold">{title ?? t(current)}</h1>
      <nav className="flex flex-wrap gap-1 border-b border-hairline pb-3">
        {TABS.map(([key, href]) => (
          <Link
            key={key}
            href={href}
            aria-current={current === key ? "page" : undefined}
            className={`${tab} ${current === key ? "bg-raised text-ink" : "text-ink-muted hover:bg-raised"}`}
          >
            {t(key)}
          </Link>
        ))}
      </nav>
    </div>
  );
}

/** Shared table look for back-office lists. */
export const table = "w-full min-w-[34rem] border-collapse text-small [&_td]:border-b [&_td]:border-dashed [&_td]:border-rule [&_td]:py-3 [&_td]:pe-3 [&_th]:border-b [&_th]:border-hairline [&_th]:py-2 [&_th]:pe-3 [&_th]:text-start [&_th]:text-label [&_th]:font-medium [&_th]:text-ink-muted";
export const panel = "grid gap-3 rounded-lg border border-hairline bg-surface p-4 shadow-paper";
export const stat = "grid gap-0.5 rounded-md border border-hairline bg-surface px-4 py-3";
