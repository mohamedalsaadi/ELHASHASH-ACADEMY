"use client";

import { upload } from "@vercel/blob/client";
import { useState } from "react";
import { refusalReason } from "@/components/upload-reason";

export type UploadedFile = { pathname: string; downloadName: string };

const clean = (name: string) => (name.split(/[\\/]/).pop() ?? "file").replace(/[\u0000-\u001f"\\]/g, "").slice(0, 200);

/**
 * Uploads straight from the browser to a private Blob store; the form only ever carries the returned
 * pathnames. Files never pass through a server action, so a large PDF cannot hit the body limit.
 */
export function UploadField({
  pathPrefix,
  clientPayload,
  max,
  name = "files",
  label,
  failedLabel,
  removeLabel,
}: {
  pathPrefix: string;
  clientPayload: string;
  max: number;
  name?: string;
  label: string;
  failedLabel: string;
  removeLabel: string;
}) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(list: FileList | null) {
    if (!list?.length) return;
    setBusy(true);
    setError(null);
    try {
      for (const file of Array.from(list)) {
        if (files.length >= max) break;
        const blob = await upload(pathPrefix + clean(file.name), file, {
          access: "private",
          handleUploadUrl: "/api/blob/upload",
          clientPayload,
        });
        setFiles((prev) => (prev.length >= max ? prev : [...prev, { pathname: blob.pathname, downloadName: clean(file.name) }]));
      }
    } catch {
      // The Blob library hides why; the server knows (not signed in, not your course, store not connected).
      let why: string | null = null;
      try {
        const p = JSON.parse(clientPayload) as { purpose?: string; courseId?: string };
        if (p.purpose && p.courseId) why = await refusalReason(p.purpose, p.courseId);
      } catch {}
      setError(why ? `${failedLabel} (${why})` : failedLabel);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-2">
      <input type="hidden" name={name} value={JSON.stringify(files)} />
      <label className="grid gap-1 text-label text-ink-muted">
        {label}
        <input
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,application/pdf,.docx"
          disabled={busy || files.length >= max}
          onChange={(e) => {
            void add(e.target.files);
            e.target.value = "";
          }}
          className="text-small file:me-2 file:rounded-full file:border file:border-hairline file:bg-surface file:px-3 file:py-1.5 file:font-semibold"
        />
      </label>
      {error && <p role="alert" className="text-small text-down">{error}</p>}
      {files.length > 0 && (
        <ul className="grid gap-1 text-small">
          {files.map((f) => (
            <li key={f.pathname} className="flex items-center justify-between gap-2">
              <span className="truncate" dir="auto">{f.downloadName}</span>
              <button
                type="button"
                onClick={() => setFiles((prev) => prev.filter((x) => x.pathname !== f.pathname))}
                className="shrink-0 text-label text-down underline underline-offset-4"
              >
                {removeLabel}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
