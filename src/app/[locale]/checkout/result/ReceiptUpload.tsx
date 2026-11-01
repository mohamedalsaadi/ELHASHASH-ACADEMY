"use client";

import { upload } from "@vercel/blob/client";
import { startTransition, useActionState, useState } from "react";
import { saveReceiptAction } from "../transfer/actions";

const clean = (name: string) => (name.split(/[\\/]/).pop() ?? "receipt").replace(/[\u0000-\u001f"\\]/g, "").slice(0, 200);

/** Uploads a transfer receipt straight to the private store, then attaches it to the order. */
export function ReceiptUpload({
  orderId,
  pathPrefix,
  hasReceipt,
  labels,
}: {
  orderId: string;
  pathPrefix: string;
  hasReceipt: boolean;
  labels: { title: string; hint: string; file: string; uploading: string; saved: string; failed: string; replace: string };
}) {
  const [state, action] = useActionState(saveReceiptAction, null);
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
        clientPayload: JSON.stringify({ purpose: "receipt", orderId }),
      });
      const fd = new FormData();
      fd.set("orderId", orderId);
      fd.set("pathname", blob.pathname);
      fd.set("name", file.name);
      startTransition(() => action(fd));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  const saved = hasReceipt || state === "ok";

  return (
    <div className="grid gap-2 border-t border-hairline pt-3">
      <h3 className="font-display font-semibold">{labels.title}</h3>
      <p className="text-small text-ink-muted">{labels.hint}</p>
      {saved && (
        <p role="status" className="text-small text-up">
          {labels.saved}
        </p>
      )}
      <label className="grid gap-1 text-label text-ink-muted">
        {saved ? labels.replace : labels.file}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,application/pdf"
          disabled={busy}
          onChange={(e) => {
            void pick(e.target.files?.[0]);
            e.target.value = "";
          }}
          className="text-small file:me-2 file:rounded-full file:border file:border-hairline file:bg-surface file:px-3 file:py-1.5 file:font-semibold"
        />
      </label>
      {busy && <p className="text-small text-ink-muted">{labels.uploading}</p>}
      {(failed || state === "invalid") && (
        <p role="alert" className="text-small text-down">
          {labels.failed}
        </p>
      )}
    </div>
  );
}
