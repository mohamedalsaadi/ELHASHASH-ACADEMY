"use client";

import { useActionState, useRef } from "react";
import { field, label } from "@/components/ui/form";
import { StatusChip, type ChipTone } from "@/components/ui/StatusChip";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { reportCsv, type Verdict } from "@/lib/quiz-report";
import { checkResponses, type CheckState } from "../actions";

type Labels = {
  file: string;
  run: string;
  save: string;
  /** With {saved} and {skipped}. */
  savedText: string;
  download: string;
  student: string;
  result: string;
  code: string;
  errors: Record<"file" | "empty" | "column" | "big" | "score", string>;
  verdicts: Record<Verdict, string>;
};

const TONE: Record<Verdict, ChipTone> = { ok: "active", not_subscribed: "expiring", invalid: "expired", duplicate: "expired", no_code: "neutral" };
const ORDER: Verdict[] = ["ok", "not_subscribed", "invalid", "duplicate", "no_code"];

/** Upload a Google Form's downloaded responses and see which student each answer belongs to, and which rows to doubt. */
export function ResponseCheck({ assignmentId, labels }: { assignmentId: string; labels: Labels }) {
  const [state, action] = useActionState(checkResponses, null as CheckState);
  const report = state && "report" in state ? state.report : null;
  // Which button was pressed travels in a hidden field: a submit button's own value does not reach a form action reliably.
  const mode = useRef<HTMLInputElement>(null);
  const press = (v: string) => () => {
    if (mode.current) mode.current.value = v;
  };

  function download() {
    if (!report) return;
    const csv = reportCsv(report, (v) => labels.verdicts[v], labels.student, labels.result);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = "dhirwa-answers-check.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="grid gap-3">
      <form action={action} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="id" value={assignmentId} />
        <input ref={mode} type="hidden" name="save" defaultValue="0" />
        <label className={label}>
          {labels.file}
          <input name="file" type="file" accept=".csv,text/csv,text/plain" required className={`${field} py-2`} />
        </label>
        <SubmitButton onClick={press("0")} className="btn btn-outline px-4 py-2 text-small" showSaved={false}>{labels.run}</SubmitButton>
        <SubmitButton onClick={press("1")} className="btn btn-primary px-4 py-2 text-small" showSaved={false}>{labels.save}</SubmitButton>
      </form>
      {state && "saved" in state && state.saved && (
        <p role="status" className="text-small font-semibold text-up">{labels.savedText.replace("{saved}", String(state.saved.saved)).replace("{skipped}", String(state.saved.skipped))}</p>
      )}
      {state && "error" in state && <p role="alert" className="text-small text-down">{labels.errors[state.error]}</p>}
      {report && (
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {ORDER.filter((v) => report.counts[v] > 0).map((v) => (
              <StatusChip key={v} tone={TONE[v]}>
                {labels.verdicts[v]}: <span className="num">{report.counts[v]}</span>
              </StatusChip>
            ))}
            <button type="button" onClick={download} className="btn btn-outline px-4 py-2 text-small">{labels.download}</button>
          </div>
          <div className="overflow-x-auto rounded-md border border-hairline">
            <table className="w-full text-small">
              <thead className="text-label text-ink-muted">
                <tr>
                  <th className="px-3 py-2 text-start">#</th>
                  <th className="px-3 py-2 text-start">{labels.code}</th>
                  <th className="px-3 py-2 text-start">{labels.student}</th>
                  <th className="px-3 py-2 text-start">{labels.result}</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((r, i) => (
                  <tr key={i} className="border-t border-hairline">
                    <td className="num px-3 py-2">{i + 1}</td>
                    <td className="px-3 py-2" dir="ltr">{r.code || "-"}</td>
                    <td className="px-3 py-2" dir="auto">{r.student || "-"}</td>
                    <td className="px-3 py-2">
                      <StatusChip tone={TONE[r.verdict]}>{labels.verdicts[r.verdict]}</StatusChip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
