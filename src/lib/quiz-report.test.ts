import { describe, expect, it } from "vitest";
import { buildReport, codeColumn, parseTable, reportCsv } from "./quiz-report";

describe("parseTable", () => {
  it("reads quotes, doubled quotes and line breaks inside quotes", () => {
    expect(parseTable('a,b\n"x, y","say ""hi"""\n"two\nlines",z\n')).toEqual([["a", "b"], ["x, y", 'say "hi"'], ["two\nlines", "z"]]);
  });
  it("detects semicolons and tabs, drops a BOM and empty lines", () => {
    expect(parseTable("\uFEFFa;b\r\n1;2\r\n\r\n")).toEqual([["a", "b"], ["1", "2"]]);
    expect(parseTable("a\tb\n1\t2")).toEqual([["a", "b"], ["1", "2"]]);
  });
});

describe("codeColumn", () => {
  it("prefers the column titled Student code, else the one that looks like codes", () => {
    expect(codeColumn([["Timestamp", "Score", "Student code"], ["t", "3", "ABC"]])).toBe(2);
    expect(codeColumn([["Time", "Who", "Answer"], ["t", "0123456789", "yes"], ["t", "abcdef0123", "no"]])).toBe(1);
    expect(codeColumn([["Time", "Who"], ["t", "nothing"]])).toBe(-1);
  });
});

describe("buildReport", () => {
  const known = (code: string) => ({ A000000001: { name: "Sara", subscribed: true }, B000000002: { name: "Omar", subscribed: false } })[code] ?? null;
  const table = [
    ["Time", "Score", "Student code"],
    ["1", "5", "a000000001"],
    ["2", "4", "B000000002"],
    ["3", "2", "ZZZ"],
    ["4", "5", "A000000001"],
    ["5", "1", ""],
  ];
  it("marks ok, not subscribed, invalid, duplicate and no code", () => {
    const r = buildReport(table, known)!;
    expect(r.rows.map((x) => x.verdict)).toEqual(["ok", "not_subscribed", "invalid", "duplicate", "no_code"]);
    expect(r.rows[0].student).toBe("Sara");
    expect(r.counts).toEqual({ ok: 1, not_subscribed: 1, invalid: 1, duplicate: 1, no_code: 1 });
  });
  it("is null when no column holds codes, and the file keeps the original columns", () => {
    expect(buildReport([["a"], ["b"]], known)).toBeNull();
    const csv = reportCsv(buildReport(table, known)!, (v) => v, "Student", "Result");
    expect(csv.split("\r\n")[0]).toBe('\uFEFF"Time","Score","Student code","Student","Result"');
    expect(csv.split("\r\n")[1]).toBe('"1","5","a000000001","Sara","ok"');
  });
});
