import { describe, expect, it } from "vitest";
import { srcTag, withSrc } from "./src-tag";

describe("srcTag", () => {
  it("reads src first, then utm_source, and cleans it", () => {
    expect(srcTag(new URLSearchParams("src=IG-Story"))).toBe("ig-story");
    expect(srcTag(new URLSearchParams("utm_source=instagram&utm_medium=paid"))).toBe("instagram");
    expect(srcTag(new URLSearchParams("src=wa&utm_source=instagram"))).toBe("wa");
    expect(srcTag(new URLSearchParams("src=<script>x"))).toBe("scriptx");
    expect(srcTag(new URLSearchParams("src=" + "a".repeat(60)))?.length).toBe(40);
  });
  it("is null with no tag or nothing left after cleaning", () => {
    expect(srcTag(new URLSearchParams(""))).toBeNull();
    expect(srcTag(new URLSearchParams("src=%20%3C%3E"))).toBeNull();
  });
});

describe("withSrc", () => {
  it("fills an empty or missing src from the cookie, keeps one the caller set", () => {
    expect(withSrc(undefined, "ig")).toEqual({ src: "ig" });
    expect(withSrc({ slug: "a", src: "" }, "ig")).toEqual({ slug: "a", src: "ig" });
    expect(withSrc({ src: "share-wa" }, "ig")).toEqual({ src: "share-wa" });
  });
  it("changes nothing without a cookie or with non-object props", () => {
    expect(withSrc({ slug: "a" }, null)).toEqual({ slug: "a" });
    expect(withSrc(["x"], "ig")).toEqual(["x"]);
  });
});
