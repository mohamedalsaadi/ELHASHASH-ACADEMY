import { Bell, BookOpen, CircleUser, LayoutDashboard } from "lucide-react";
import { ActiveLink } from "@/components/ActiveLink";

type Tab = { href: string; label: string; badge?: number };

const ICONS: Record<string, typeof Bell> = { "/courses": BookOpen, "/notifications": Bell, "/account": CircleUser };

/** Signed-in phone navigation: the same destinations as the header, within thumb reach. Tabs only move; actions stay in the page. */
export function TabBar({ items, label }: { items: Tab[]; label: string }) {
  return (
    <nav aria-label={label} className="tab-bar glass fixed inset-x-0 bottom-0 z-30 border-t border-hairline pb-[env(safe-area-inset-bottom)] md:hidden print:hidden">
      <ul className="grid auto-cols-fr grid-flow-col">
        {items.map((item) => {
          const Icon = ICONS[item.href] ?? LayoutDashboard;
          return (
            <li key={item.href}>
              <ActiveLink
                href={item.href}
                activeClassName="text-ink font-bold"
                className="relative grid min-h-[3.75rem] content-center justify-items-center gap-0.5 px-1 text-center text-[.6875rem] leading-tight font-medium text-ink-muted transition-colors duration-(--dur-fast) ease-(--ease-out)"
              >
                <Icon aria-hidden="true" className="size-[22px]" strokeWidth={1.75} />
                <span className="line-clamp-1">{item.label}</span>
                {item.badge ? (
                  <span className="absolute top-1.5 ms-6 rounded-full bg-down px-1.5 text-[.6875rem] leading-4 font-semibold text-on-primary">{item.badge}</span>
                ) : null}
              </ActiveLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
