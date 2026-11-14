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

  it("keeps negative amounts numeric so refund and credit-note columns still sum", () => {
    expect(csvFile([["-1250.00", -10500, "-3"]])).toBe('﻿"-1250.00","-10500","-3"');
    // Still defused when it is not a bare number.
    expect(csvFile([["-1250.00+A1", "--5", "-"]])).toBe(`﻿"'-1250.00+A1","'--5","'-"`);
  });

  it("leaves an ordinary value alone", () => {
    expect(csvFile([["Omar Al-Sayed"]])).toContain(`"Omar Al-Sayed"`);
  });
});
