import { describe, expect, it } from "vitest";
import { pick } from "./content";

describe("pick", () => {
  it("prefers the reader's language when it is written", () => {
    expect(pick(true, "رياضيات", "Maths")).toBe("رياضيات");
    expect(pick(false, "رياضيات", "Maths")).toBe("Maths");
  });

  it("falls back to the other language rather than showing blank", () => {
    expect(pick(false, "رياضيات", "")).toBe("رياضيات");
    expect(pick(false, "رياضيات", null)).toBe("رياضيات");
    expect(pick(true, undefined, "Maths")).toBe("Maths");
  });

  it("returns an empty string when neither language is written", () => {
    expect(pick(true, null, null)).toBe("");
    expect(pick(false, undefined, "")).toBe("");
  });
});
