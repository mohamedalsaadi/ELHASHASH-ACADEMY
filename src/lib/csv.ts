/** Quoted cell: inner quotes are doubled, so a name or title can contain anything. */
export const csvCell = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""')}"`;

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
