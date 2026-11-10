"use client";

import { upload } from "@vercel/blob/client";
import { useEffect, useRef, useState } from "react";
import { discardPages } from "@/app/[locale]/admin/actions";
import { eachPdfPage } from "@/components/pdf-pages";
import { refusalReason } from "@/components/upload-reason";

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
    const uploaded: string[] = [];
    try {
      await eachPdfPage(
        file,
        async (jpeg, n, total) => {
          setProgress(`${n} / ${total}`);
          const res = await upload(`lesson-pages/${courseId}/page-${n}.jpg`, jpeg, {
            access: "private",
            handleUploadUrl: "/api/blob/upload",
            clientPayload: JSON.stringify({ purpose: "lessonpage", courseId }),
          });
          uploaded.push(res.pathname);
        },
        (s) => (stage = s),
      );
      setPages(uploaded);
      setState("done");
    } catch (e) {
      // The stage and reason are shown as they are: a teacher can read them out, and the generic message hid the cause.
      // The Blob library reports every refusal as "Failed to retrieve the client token", so the server is asked for the real one.
      const why = await refusalReason("lessonpage", courseId);
      setDetail(`${stage}: ${why ?? (e instanceof Error ? e.message : String(e))}`);
      setState("failed");
      // Pages already stored for this attempt are not on any lesson yet: remove them.
      if (uploaded.length) void discardPages(courseId, uploaded).catch(() => {});
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
