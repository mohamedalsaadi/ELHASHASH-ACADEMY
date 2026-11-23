"use client";

import { useEffect, useState } from "react";

/**
 * Share the stream page. Each link carries its own `?src=`, so the admin list shows how many visits and joins sharing brought.
 * The phone's share sheet appears only where the browser has one.
 */
export function ShareRow({ url, text, labels }: { url: string; text: string; labels: { title: string; whatsapp: string; more: string } }) {
  const [native, setNative] = useState(false);
  useEffect(() => setNative(typeof navigator.share === "function"), []);
  const wa = `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}?src=share-wa`)}`;
  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <span className="text-small text-ink-muted">{labels.title}</span>
      <a href={wa} target="_blank" rel="noreferrer" className="btn btn-outline">
        {labels.whatsapp}
      </a>
      {native && (
        <button type="button" className="btn btn-outline" onClick={() => navigator.share({ text, url: `${url}?src=share` }).catch(() => {})}>
          {labels.more}
        </button>
      )}
    </div>
  );
}
