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
});
