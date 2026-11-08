"use client";

import { useState } from "react";

type Ticket = { videoId: string; uploadLink: string; fields: Record<string, string> };
type Labels = { pick: string; sending: string; done: string; failed: string };

/**
 * Uploads a video file to the academy's VdoCipher account and fills the lesson form's provider and id fields.
 * The teacher still presses Save. The browser sends the file straight to VdoCipher's storage, so size is not limited by our server.
 */
export function VdoUpload({ title, labels }: { title: string; labels: Labels }) {
  const [state, setState] = useState<"idle" | "sending" | "done" | "failed">("idle");
  const [pct, setPct] = useState(0);

  async function send(input: HTMLInputElement) {
    const file = input.files?.[0];
    const form = input.closest("form");
    if (!file || !form) return;
    setState("sending");
    setPct(0);
    try {
      const res = await fetch("/api/vdocipher/upload", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: title || file.name }) });
      if (!res.ok) throw new Error("slot");
      const t = (await res.json()) as Ticket;
      const body = new FormData();
      for (const [k, v] of Object.entries(t.fields)) body.append(k, v);
      body.append("success_action_status", "201");
      body.append("success_action_redirect", "");
      body.append("file", file);
      await new Promise<void>((ok, bad) => {
        const x = new XMLHttpRequest();
        x.open("POST", t.uploadLink);
        x.upload.onprogress = (e) => e.lengthComputable && setPct(Math.round((e.loaded / e.total) * 100));
        x.onload = () => (x.status < 300 ? ok() : bad(new Error("upload")));
        x.onerror = () => bad(new Error("upload"));
        x.send(body);
      });
      (form.elements.namedItem("provider") as HTMLSelectElement).value = "VDOCIPHER";
      (form.elements.namedItem("externalId") as HTMLInputElement).value = t.videoId;
      setState("done");
    } catch {
      setState("failed");
    } finally {
      input.value = "";
    }
  }

  return (
    <label className="grid gap-1 text-small">
      <span className="font-semibold">{labels.pick}</span>
      <input type="file" accept="video/*" disabled={state === "sending"} onChange={(e) => void send(e.currentTarget)} className="text-small" />
      {state === "sending" && <progress value={pct} max={100} aria-label={labels.sending} className="w-full" />}
      {state === "done" && <span className="text-ink-muted">{labels.done}</span>}
      {state === "failed" && <span role="alert" className="text-ink-muted">{labels.failed}</span>}
    </label>
  );
}
