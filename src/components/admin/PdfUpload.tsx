"use client";

import { upload } from "@vercel/blob/client";
import { useEffect, useRef, useState } from "react";

type Labels = { pick: string; sending: string; done: string; failed: string; pages: string };

/**
 * Turns a PDF into one JPEG per page in the teacher's browser and uploads the pages to the private store.
 * Students never receive the PDF itself. The page list rides in a hidden field; the teacher presses Save.
 */
export function PdfUpload({ courseId, defaultPages, savedKind, labels }: { courseId: string; defaultPages: string[]; savedKind: string; labels: Labels }) {
  const box = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(savedKind === "PDF");
  const [pages, setPages] = useState<string[]>(defaultPages);
  const [state, setState] = useState<"idle" | "sending" | "done" | "failed">("idle");
  const [progress, setProgress] = useState("");
  const [detail, setDetail] = useState("");

  // Visible as soon as the lesson's kind select says PDF, without saving first.
  useEffect(() => {
    const kind = box.current?.closest("form")?.elements.namedItem("kind");
    if (!(kind instanceof HTMLSelectElement)) return;
    const sync = () => setShow(kind.value === "PDF");
    sync();
    kind.addEventListener("change", sync);
    return () => kind.removeEventListener("change", sync);
  }, []);

  async function convert(file: File) {
    setState("sending");
    setDetail("");
    let stage = "load";
    try {
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
      stage = "read";
      // Font and character-map data is served from /pdfjs so a PDF that does not embed its fonts still draws its text.
      const doc = await pdfjs.getDocument({
        data: await file.arrayBuffer(),
        standardFontDataUrl: "/pdfjs/standard_fonts/",
        cMapUrl: "/pdfjs/cmaps/",
        cMapPacked: true,
      }).promise;
      if (doc.numPages > 400) throw new Error("more than 400 pages");
      const out: string[] = [];
      for (let n = 1; n <= doc.numPages; n++) {
        setProgress(`${n} / ${doc.numPages}`);
        stage = `page ${n} draw`;
        const page = await doc.getPage(n);
        // 1400 px wide reads well on a phone and keeps a page near 300 KB.
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: 1400 / base.width });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        await page.render({ canvasContext: canvas.getContext("2d")!, viewport }).promise;
        const blob = await new Promise<Blob>((ok, bad) => canvas.toBlob((b) => (b ? ok(b) : bad(new Error("encode"))), "image/jpeg", 0.82));
        stage = `page ${n} upload`;
        const res = await upload(`lesson-pages/${courseId}/page-${n}.jpg`, blob, {
          access: "private",
          handleUploadUrl: "/api/blob/upload",
          clientPayload: JSON.stringify({ purpose: "lessonpage", courseId }),
        });
        out.push(res.pathname);
      }
      setPages(out);
      setState("done");
    } catch (e) {
      // The stage and reason are shown as they are: a teacher can read them out, and the generic message hid the cause.
      setDetail(`${stage}: ${e instanceof Error ? e.message : String(e)}`);
      setState("failed");
    }
  }

  return (
    <div ref={box} className="grid gap-1 text-small">
      <input type="hidden" name="pdfPages" value={JSON.stringify(pages)} />
      <label className={show ? "grid gap-1" : "hidden"}>
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
      <span className={show ? "text-ink-muted" : "hidden"} aria-live="polite">
        {state === "sending" ? `${labels.sending} ${progress}` : state === "done" ? labels.done : state === "failed" ? labels.failed : pages.length ? `${labels.pages}: ${pages.length}` : ""}
      </span>
      {state === "failed" && detail && <code dir="ltr" className="break-all text-label text-down">{detail}</code>}
    </div>
  );
}
