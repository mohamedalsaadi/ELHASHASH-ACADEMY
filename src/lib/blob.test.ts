import { describe, expect, it } from "vitest";
import { contentDisposition, INLINE_TYPES } from "./blob";

describe("contentDisposition", () => {
  it("downloads by default and shows in place only when asked", () => {
    expect(contentDisposition("a.png")).toMatch(/^attachment;/);
    expect(contentDisposition("a.png", true)).toMatch(/^inline;/);
  });
  it("never lists a type that can run script", () => {
    expect(INLINE_TYPES).not.toContain("image/svg+xml");
    expect(INLINE_TYPES).not.toContain("text/html");
  });
});
