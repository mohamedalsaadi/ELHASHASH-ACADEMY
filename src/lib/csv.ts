/**
 * Quoted cell: inner quotes are doubled, so a name or title can contain anything.
 * A value starting with = + - @ or a control character is prefixed with an apostrophe: Excel and
 * Sheets would otherwise run a student-supplied name as a formula (CSV injection).
 */
export const csvCell = (v: unknown) => {
  const s = String(v ?? "");
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replaceAll('"', '""')}"`;
};

/** A CSV body prefixed with the UTF-8 BOM Excel needs to read Arabic correctly. */
export function csvFile(rows: unknown[][]): string {
  return "﻿" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

export function csvResponse(rows: unknown[][], filename: string): Response {
  return new Response(csvFile(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
