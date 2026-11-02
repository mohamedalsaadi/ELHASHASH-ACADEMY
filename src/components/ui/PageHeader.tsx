import { Mark } from "@/components/brand/Mark";
import { Link } from "@/i18n/navigation";

/** One header shape for the course, lesson and live pages: back link, eyebrow, title, meta, actions. */
export function PageHeader({
  back,
  eyebrow,
  title,
  meta,
  actions,
}: {
  back?: { href: string; label: string };
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="grid gap-3">
      {back && (
        <Link href={back.href} className="flex min-h-11 w-fit items-center gap-2 rounded-full text-small text-ink-muted transition-colors duration-(--dur-fast) ease-(--ease-out) hover:text-ink">
          <Mark size={18} />
          <span>{back.label}</span>
        </Link>
      )}
      <div className="grid gap-2">
        {eyebrow && <p className="text-small font-medium text-pen">{eyebrow}</p>}
        <h1 className="font-display text-h1 font-bold text-balance">{title}</h1>
        {meta && <div className="text-small text-ink-muted">{meta}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}
