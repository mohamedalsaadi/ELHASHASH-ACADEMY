import { Link } from "@/i18n/navigation";

type Promo = {
  id: string;
  titleAr: string;
  titleEn: string;
  bodyAr: string | null;
  bodyEn: string | null;
  href: string | null;
};

function wrap(href: string | null, className: string, children: React.ReactNode) {
  if (!href) return <div className={className}>{children}</div>;
  return href.startsWith("/") ? (
    <Link href={href} className={className}>
      {children}
    </Link>
  ) : (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  );
}

/** Static owner-managed promos: a slim bar under the header, or offer cards in the home scroll. No autoplay.
    When nothing is published the bar falls back to one standing announcement, so the slot is never empty. */
export function PromoBand({
  promos,
  locale,
  variant,
  label,
  fallback,
}: {
  promos: Promo[];
  locale: string;
  variant: "BAR" | "CARD";
  label: string;
  fallback?: { text: string; cta: string };
}) {
  const ar = locale === "ar";

  if (!promos.length) {
    if (variant !== "BAR" || !fallback) return null;
    return (
      <aside aria-label={label} className="border-b border-hairline bg-night text-on-primary">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-3 text-small">
          <span className="text-night-text">{fallback.text}</span>
          <Link href="/courses" className="font-semibold underline decoration-marker decoration-2 underline-offset-4">
            {fallback.cta}
          </Link>
        </div>
      </aside>
    );
  }

  if (variant === "BAR") {
    return (
      <aside aria-label={label} className="border-b border-hairline bg-night text-on-primary">
        <ul className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-2 px-4 py-3 text-small">
          {promos.map((p) => {
            const body = ar ? p.bodyAr : p.bodyEn;
            return (
              <li key={p.id}>
                {wrap(
                  p.href,
                  "flex flex-wrap items-center justify-center gap-2 underline-offset-4 hover:underline",
                  <>
                    <span className="font-semibold">{ar ? p.titleAr : p.titleEn}</span>
                    {body && <span className="opacity-80">{body}</span>}
                  </>,
                )}
              </li>
            );
          })}
        </ul>
      </aside>
    );
  }

  return (
    <section aria-label={label} className="mx-auto grid max-w-6xl gap-4 px-4 pt-10 sm:grid-cols-2 lg:grid-cols-3">
      {promos.map((p) => {
        const body = ar ? p.bodyAr : p.bodyEn;
        return (
          <div key={p.id}>
            {wrap(
              p.href,
              "fold grid content-start gap-2 rounded-lg bg-night p-6 text-on-primary shadow-paper hover-lift [--cut:22px]",
              <>
                <h2 className="font-display text-h3 font-bold">{ar ? p.titleAr : p.titleEn}</h2>
                {body && <p className="text-small opacity-80">{body}</p>}
              </>,
            )}
          </div>
        );
      })}
    </section>
  );
}
