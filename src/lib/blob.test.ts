import { describe, expect, it } from "vitest";
import { contentDisposition, INLINE_TYPES, lessonPagesPrefix, ownPaths } from "./blob";

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

describe("ownPaths", () => {
  const mine = lessonPagesPrefix("c1");
  it("keeps this course's objects and drops another course's", () => {
    expect(ownPaths([`${mine}p-1.jpg`, "lesson-pages/c2/p-1.jpg"], mine)).toEqual([`${mine}p-1.jpg`]);
  });
  it("keeps an object the record already had, so a copied unit survives a save", () => {
    expect(ownPaths(["lesson-pages/c2/p-1.jpg"], mine, ["lesson-pages/c2/p-1.jpg"])).toEqual(["lesson-pages/c2/p-1.jpg"]);
  });
  it("refuses a path that climbs out of the prefix", () => {
    expect(ownPaths([`${mine}../c2/p.jpg`], mine)).toEqual([]);
  });
});
