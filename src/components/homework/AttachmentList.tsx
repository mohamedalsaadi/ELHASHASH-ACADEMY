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
      {files.map((f) => (
        <li key={f.id}>
          <a href={`/api/files/${kind}/${f.id}`} className="text-pen underline underline-offset-4" dir="auto">
            {f.downloadName}
          </a>{" "}
          <span className="num text-label text-ink-muted">({Math.max(1, Math.round(f.size / 1024))} KB)</span>
        </li>
      ))}
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
