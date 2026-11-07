import { describe, expect, it } from "vitest";
import { Digest } from "./suggestions";

describe("Digest", () => {
  const ok = { overview: "Most notes ask for dark mode.", themes: [{ title: "Dark mode", count: 3, summary: "Night study.", examples: ["dark please"] }], urgent: [], actions: ["Ship dark exam mode"] };
  it("accepts a well-formed summary", () => expect(Digest.safeParse(ok).success).toBe(true));
  it("refuses a summary with no overview or an empty theme count", () => {
    expect(Digest.safeParse({ ...ok, overview: "" }).success).toBe(false);
    expect(Digest.safeParse({ ...ok, themes: [{ ...ok.themes[0], count: 0 }] }).success).toBe(false);
  });
});
