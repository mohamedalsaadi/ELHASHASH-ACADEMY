import { Link } from "@/i18n/navigation";

/** DESIGN.md §7 stat tile: the value is the loud thing, the label explains it. The number is never decorative. */
export function StatTile({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  href?: string;
}) {
  const body = (
    <div className="card grid gap-1 px-4 py-3">
      <span className="num font-display text-figure leading-none font-semibold">{value}</span>
      <span className="text-label text-ink-muted">{label}</span>
      {hint && <span className="text-label text-ink-muted">{hint}</span>}
    </div>
  );
  if (!href) return body;
  return (
    <Link href={href} className="hover-lift block rounded-lg">
      {body}
    </Link>
  );
}
