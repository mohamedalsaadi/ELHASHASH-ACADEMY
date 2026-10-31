"use client";

import { upload } from "@vercel/blob/client";
import { useState } from "react";

const clean = (name: string) => (name.split(/[\\/]/).pop() ?? "image").replace(/[\u0000-\u001f"\\]/g, "").slice(0, 200);

/** One image, uploaded straight from the browser to the private store; the form carries only the pathname. */
export function ImageUpload({
  pathPrefix,
  clientPayload,
  name,
  defaultPath = null,
  currentSrc = null,
  label,
  failedLabel,
  removeLabel,
}: {
  pathPrefix: string;
  clientPayload: string;
  name: string;
  defaultPath?: string | null;
  /** The image already saved, shown until a new one is picked. */
  currentSrc?: string | null;
  label: string;
  failedLabel: string;
  removeLabel: string;
}) {
  const [path, setPath] = useState<string | null>(defaultPath);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setFailed(false);
    try {
      const blob = await upload(pathPrefix + clean(file.name), file, {
        access: "private",
        handleUploadUrl: "/api/blob/upload",
        clientPayload,
      });
      setPath(blob.pathname);
      setPreview(URL.createObjectURL(file));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-2">
      <input type="hidden" name={name} value={path ?? ""} />
      {(preview ?? (path ? currentSrc : null)) && (
        // A local object URL (or the same-origin stream) that next/image cannot optimise.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview ?? currentSrc ?? ""} alt="" className="h-36 w-full max-w-sm rounded-sm object-cover" />
      )}
      <label className="grid gap-1 text-label text-ink-muted">
        {label}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={busy}
          onChange={(e) => {
            void pick(e.target.files?.[0]);
            e.target.value = "";
          }}
          className="text-small file:me-2 file:rounded-sm file:border file:border-ink file:bg-surface file:px-3 file:py-1.5 file:font-semibold"
        />
      </label>
      {failed && <p role="alert" className="text-small text-down">{failedLabel}</p>}
      {path && (
        <button
          type="button"
          onClick={() => {
            setPath(null);
            setPreview(null);
          }}
          className="w-fit text-label text-down underline underline-offset-4"
        >
          {removeLabel}
        </button>
      )}
    </div>
  );
}
