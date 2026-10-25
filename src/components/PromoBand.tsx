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

/** Static owner-managed promos: a slim bar under the header, or offer cards in the home scroll. No autoplay. */
export function PromoBand({ promos, locale, variant, label }: { promos: Promo[]; locale: string; variant: "BAR" | "CARD"; label: string }) {
  if (!promos.length) return null;
  const ar = locale === "ar";

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
