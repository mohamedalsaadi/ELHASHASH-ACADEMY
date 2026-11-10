import { QuestionPages } from "@/components/QuestionPages";
import { field } from "@/components/ui/form";

export type FormItem = { id: string; kind: "MCQ" | "MULTI" | "SHORT" | "WRITTEN"; prompt: string; marks: number; choices: { id: string; label: string }[]; mediaCount?: number };
export type QuestionLabels = { yourAnswer: string; pictureAlt: string; pickAll: string };

/**
 * The answer fields of a list of questions, named `choice_<id>` (one value for a radio, several for ticked boxes) and
 * `text_<id>`. Shared by practice, review and homework or quizzes; the caller owns the form and its action.
 */
export function QuestionFields({ items, labels, required = false }: { items: FormItem[]; labels: QuestionLabels; required?: boolean }) {
  return (
    <>
      {items.map((item, i) => (
        <fieldset key={item.id} className="grid gap-2 card p-4">
          {/* The legend carries the prompt so a screen reader names the group, not just "1 · 2". */}
          <legend className="grid gap-1 px-1">
            <span className="text-label text-ink-muted"><span className="num">{i + 1}</span> · <span className="num">{item.marks}</span></span>
            {item.prompt && <span className="font-semibold" dir="auto">{item.prompt}</span>}
          </legend>

          <QuestionPages itemId={item.id} count={item.mediaCount ?? 0} label={labels.pictureAlt} />
          {item.kind === "MCQ" || item.kind === "MULTI" ? (
            <div className="grid gap-1.5">
              {item.kind === "MULTI" && <span className="text-label text-ink-muted">{labels.pickAll}</span>}
              {item.choices.map((c, ci) => (
                <label key={c.id} className="flex items-center gap-2 text-small">
                  <input type={item.kind === "MCQ" ? "radio" : "checkbox"} name={`choice_${item.id}`} value={c.id} className="size-4" required={required && item.kind === "MCQ"} />
                  <span className="num w-4 text-label font-semibold" dir="ltr">{"ABCDEF"[ci]}</span>
                  <span dir="auto">{c.label}</span>
                </label>
              ))}
            </div>
          ) : item.kind === "WRITTEN" ? (
            <textarea name={`text_${item.id}`} rows={4} maxLength={2000} dir="auto" aria-label={labels.yourAnswer} placeholder={labels.yourAnswer} className={`${field} py-2`} required={required} />
          ) : (
            <input name={`text_${item.id}`} maxLength={1000} dir="auto" aria-label={labels.yourAnswer} placeholder={labels.yourAnswer} className={field} required={required} />
          )}
        </fieldset>
      ))}
    </>
  );
}
