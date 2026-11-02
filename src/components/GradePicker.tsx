import { SubmitButton } from "@/components/ui/SubmitButton";
import { updateGrade } from "@/app/[locale]/account/actions";

type Groups = { label: string; grades: { id: string; name: string }[] }[];

/** The grade select, grouped by country. Saving changes the student's home page and country. */
export function GradePicker({ groups, current, label, save }: { groups: Groups; current: string | null; label: string; save: string }) {
  return (
    <form action={updateGrade} className="flex flex-wrap items-end gap-3">
      <label className="grid min-w-56 flex-1 gap-1 text-label text-ink-muted">
        {label}
        <select
          name="gradeId"
          required
          defaultValue={current ?? ""}
          className="min-h-11 rounded-sm border border-field bg-surface px-3 text-body text-ink"
        >
          <option value="" disabled>
            {label}
          </option>
          {groups.map((c) => (
            <optgroup key={c.label} label={c.label}>
              {c.grades.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      <SubmitButton className="btn btn-primary">{save}</SubmitButton>
    </form>
  );
}
