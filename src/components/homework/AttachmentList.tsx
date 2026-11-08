import type { ReactNode } from "react";

/** Attachment list for an assignment or a submission. Files are private; the link is an authorised route. */
export function AttachmentList({
  kind,
  files,
  empty,
}: {
  kind: "assignment" | "submission";
  files: { id: string; downloadName: string; size: number }[];
  empty: string;
}) {
  if (files.length === 0) return <p className="text-small text-ink-muted">{empty}</p>;
  return (
    <ul className="grid gap-1 text-small">
      {files.map((f) => {
        const href = `/api/files/${kind}/${f.id}`;
        const image = /\.(jpe?g|png|webp|gif)$/i.test(f.downloadName);
        const pdf = /\.pdf$/i.test(f.downloadName);
        return (
          <li key={f.id} className="grid gap-1">
            {image && (
              <a href={`${href}?inline=1`} target="_blank" rel="noopener noreferrer" className="w-fit">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`${href}?inline=1`} alt={f.downloadName} loading="lazy" className="max-h-64 w-auto max-w-full rounded-md border border-hairline" />
              </a>
            )}
            <span>
              <a href={image || pdf ? `${href}?inline=1` : href} target={image || pdf ? "_blank" : undefined} rel="noopener noreferrer" className="text-pen underline underline-offset-4" dir="auto">
                {f.downloadName}
              </a>{" "}
              <span className="num text-label text-ink-muted">({Math.max(1, Math.round(f.size / 1024))} KB)</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** A plain labelled block used by the homework screens. */
export function Block({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <section className="grid gap-3 card p-4">
      <h2 className="font-display text-h3 font-semibold">{title}</h2>
      {children}
    </section>
  );
}
