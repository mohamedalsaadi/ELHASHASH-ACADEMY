"use client";

import { upload } from "@vercel/blob/client";
import { useState } from "react";

type Labels = { pick: string; sending: string; done: string; failed: string; pages: string };

/**
 * Turns a PDF into one JPEG per page in the teacher's browser and uploads the pages to the private store.
 * Students never receive the PDF itself. The page list rides in a hidden field; the teacher presses Save.
 */
export function PdfUpload({ courseId, defaultPages, labels }: { courseId: string; defaultPages: string[]; labels: Labels }) {
  const [pages, setPages] = useState<string[]>(defaultPages);
  const [state, setState] = useState<"idle" | "sending" | "done" | "failed">("idle");
  const [progress, setProgress] = useState("");

  async function convert(file: File) {
    setState("sending");
    try {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
      const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
      const out: string[] = [];
      for (let n = 1; n <= doc.numPages; n++) {
        setProgress(`${n} / ${doc.numPages}`);
        const page = await doc.getPage(n);
        // 1400 px wide reads well on a phone and keeps a page near 300 KB.
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: 1400 / base.width });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        await page.render({ canvasContext: canvas.getContext("2d")!, viewport }).promise;
        const blob = await new Promise<Blob>((ok, bad) => canvas.toBlob((b) => (b ? ok(b) : bad(new Error("encode"))), "image/jpeg", 0.82));
        const res = await upload(`lesson-pages/${courseId}/page-${n}.jpg`, blob, {
          access: "private",
          handleUploadUrl: "/api/blob/upload",
          clientPayload: JSON.stringify({ purpose: "lessonpage", courseId }),
        });
        out.push(res.pathname);
      }
      setPages(out);
      setState("done");
    } catch {
      setState("failed");
    }
  }

  return (
    <div className="grid gap-1 text-small">
      <input type="hidden" name="pdfPages" value={JSON.stringify(pages)} />
      <label className="grid gap-1">
        <span className="font-semibold">{labels.pick}</span>
        <input
          type="file"
          accept="application/pdf"
          disabled={state === "sending"}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void convert(f);
          }}
          className="text-small"
        />
      </label>
      <span className="text-ink-muted" aria-live="polite">
        {state === "sending" ? `${labels.sending} ${progress}` : state === "done" ? labels.done : state === "failed" ? labels.failed : pages.length ? `${labels.pages}: ${pages.length}` : ""}
      </span>
    </div>
  );
}
