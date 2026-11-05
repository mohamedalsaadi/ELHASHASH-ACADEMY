import { describe, expect, it } from "vitest";
import { csvFile } from "./csv";

describe("csvFile", () => {
  it("starts with a BOM so Excel reads Arabic", () => {
    expect(csvFile([["name"]]).startsWith("﻿")).toBe(true);
  });

  it("doubles inner quotes and keeps commas inside the cell", () => {
    expect(csvFile([["a,b", 'he said "hi"']])).toBe('﻿"a,b","he said ""hi"""');
  });

  it("joins rows with CRLF and keeps an empty cell as a pair of quotes", () => {
    expect(csvFile([["a", ""], ["b", 1]])).toBe('﻿"a",""\r\n"b","1"');
  });

  // A student can type their own name. Excel and Sheets run a leading = + - @ as a formula.
  it("defuses a formula typed into a cell", () => {
    expect(csvFile([["=cmd|' /C calc'!A0"]])).toContain(`"'=cmd|' /C calc'!A0"`);
    for (const dangerous of ["+1+1", "-1+1", "@SUM(A1)", "\tx"]) {
      expect(csvFile([[dangerous]])).toContain(`"'${dangerous}"`);
    }
  });

  it("leaves an ordinary value alone", () => {
    expect(csvFile([["Omar Al-Sayed"]])).toContain(`"Omar Al-Sayed"`);
  });
});
