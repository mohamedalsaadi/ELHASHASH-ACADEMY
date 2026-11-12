// The teacher downloads a Google Form's responses as a file and uploads it on the assignment page; each row's student code
// is turned back into a student, and rows with a bad or repeated code are flagged.
import { isCodeTitle } from "./code-question";

/** A delimited text file (comma, semicolon or tab) as rows of cells. Quotes, doubled quotes and line breaks inside quotes are handled. */
export function parseTable(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const delim = [",", ";", "\t"].map((d) => [d, firstLine.split(d).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"' && cell === "") quoted = true;
    else if (c === delim) {
      row.push(cell);
      cell = "";
    }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim() !== "")) rows.push(row);
  return rows;
}

const CODE_SHAPE = /^[0-9A-F]{10}$/i;

/** The column that holds the student code: the one titled like the question, else the one whose cells look most like codes. */
export function codeColumn(table: string[][]): number {
  const [header = [], ...rows] = table;
  const titled = header.findIndex((h) => isCodeTitle(h));
  if (titled >= 0) return titled;
  let best = -1;
  let bestCount = 0;
  header.forEach((_, col) => {
    const n = rows.filter((r) => CODE_SHAPE.test((r[col] ?? "").trim())).length;
    if (n > bestCount) {
      best = col;
      bestCount = n;
    }
  });
  return best;
}

export type Verdict = "ok" | "not_subscribed" | "invalid" | "duplicate" | "no_code";
export type Known = { name: string; subscribed: boolean };
export type Report = {
  header: string[];
  rows: { cells: string[]; code: string; student: string; verdict: Verdict }[];
  counts: Record<Verdict, number>;
};

/**
 * Judges every answer row. `known` turns a code into its student (null when no student of the course has it).
 * A code that came in before is a duplicate, whatever else is true of it: that is the sign of a shared link.
 */
export function buildReport(table: string[][], known: (code: string) => Known | null): Report | null {
  const col = codeColumn(table);
  if (col < 0) return null;
  const [header, ...body] = table;
  const seen = new Set<string>();
  const counts: Report["counts"] = { ok: 0, not_subscribed: 0, invalid: 0, duplicate: 0, no_code: 0 };
  const rows = body.map((cells) => {
    const code = (cells[col] ?? "").trim().toUpperCase();
    const who = code ? known(code) : null;
    const verdict: Verdict = !code ? "no_code" : seen.has(code) ? "duplicate" : !who ? "invalid" : who.subscribed ? "ok" : "not_subscribed";
    if (code) seen.add(code);
    counts[verdict]++;
    return { cells, code, student: who?.name ?? "", verdict };
  });
  return { header, rows, counts };
}

/** The uploaded table with the student and the verdict added at the end, as a file the teacher can open in a spreadsheet. */
export function reportCsv(r: Report, verdictLabel: (v: Verdict) => string, studentHeader: string, resultHeader: string): string {
  const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const lines = [[...r.header, studentHeader, resultHeader], ...r.rows.map((x) => [...x.cells, x.student, verdictLabel(x.verdict)])];
  return "\uFEFF" + lines.map((l) => l.map(q).join(",")).join("\r\n");
}
