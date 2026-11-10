"use client";

import { upload } from "@vercel/blob/client";
import { useState } from "react";
import { discardPages } from "@/app/[locale]/admin/actions";
import { eachPdfPage, imageToJpeg } from "@/components/pdf-pages";
import { refusalReason } from "@/components/upload-reason";

type Labels = { pick: string; sending: string; failed: string; remove: string; pages: string };

/**
 * A question can be a picture or a PDF. Both become JPEG pages in the teacher's browser and go straight to the private
 * store; the form carries only the pathnames (field `media`). Students see the pages, never the original file.
 */
export function QuestionMedia({ courseId, defaultMedia = [], labels }: { courseId: string; defaultMedia?: string[]; labels: Labels }) {
  const [media, setMedia] = useState<string[]>(defaultMedia);
  const [state, setState] = useState<"idle" | "sending" | "failed">("idle");
  const [progress, setProgress] = useState("");
  const [detail, setDetail] = useState("");

  async function add(file: File) {
    setState("sending");
    setDetail("");
    let stage = "load";
    const uploaded: string[] = [];
    const put = async (jpeg: Blob, n: number) => {
      const res = await upload(`question-media/${courseId}/q-${n}.jpg`, jpeg, {
        access: "private",
        handleUploadUrl: "/api/blob/upload",
        clientPayload: JSON.stringify({ purpose: "questionmedia", courseId }),
      });
      uploaded.push(res.pathname);
    };
    try {
      if (file.type === "application/pdf") {
        await eachPdfPage(file, async (jpeg, n, total) => { setProgress(`${n} / ${total}`); await put(jpeg, n); }, (s) => (stage = s));
      } else {
        stage = "read picture";
        const jpeg = await imageToJpeg(file);
        stage = "upload";
        await put(jpeg, 1);
      }
      setMedia((m) => [...m, ...uploaded].slice(0, 40));
      setState("idle");
    } catch (e) {
      const why = await refusalReason("questionmedia", courseId);
      setDetail(`${stage}: ${why ?? (e instanceof Error ? e.message : String(e))}`);
      setState("failed");
      if (uploaded.length) void discardPages(courseId, uploaded).catch(() => {});
    }
  }

  return (
    <div className="grid gap-1 text-small">
      <input type="hidden" name="media" value={JSON.stringify(media)} />
      <label className="grid gap-1 text-label text-ink-muted">
        {labels.pick}
        <input
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          disabled={state === "sending"}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void add(f);
          }}
          className="text-small"
        />
      </label>
      <span aria-live="polite" className="text-ink-muted">
        {state === "sending" ? `${labels.sending} ${progress}` : media.length ? `${labels.pages}: ${media.length}` : ""}
      </span>
      {media.length > 0 && (
        <button type="button" onClick={() => setMedia([])} className="w-fit text-label text-down underline underline-offset-4">
          {labels.remove}
        </button>
      )}
      {state === "failed" && <p role="alert" className="text-small text-down">{labels.failed}</p>}
      {state === "failed" && detail && <code dir="ltr" className="break-all text-label text-down">{detail}</code>}
    </div>
  );
}
