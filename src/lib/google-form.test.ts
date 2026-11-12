import { describe, expect, it } from "vitest";
import { isCodeTitle } from "./code-question";
import { codeEntryFromHtml } from "./google-form";

const page = (items: string) => `<html><script>var FB_PUBLIC_LOAD_DATA_ = [null,[null,[${items}],null,null],"x"];</script></html>`;

describe("codeEntryFromHtml", () => {
  it("finds the field id of the Student code question among others", () => {
    const html = page('[1,"Name",null,0,[[55501,null,1]]],[271083019,"Student code",null,0,[[1691794639,null,1]],null,null]');
    expect(codeEntryFromHtml(html)).toBe("1691794639");
  });
  it("accepts the Arabic titles and ignores case and spaces", () => {
    expect(codeEntryFromHtml(page('[2,"  رمز الطالب ",null,0,[[777777,null,1]]]'))).toBe("777777");
    expect(codeEntryFromHtml(page('[2,"STUDENT  CODE",null,0,[[888888,null,1]]]'))).toBe("888888");
    expect(isCodeTitle("Code")).toBe(false);
  });
  it("is null when there is no such question, no data, or broken data", () => {
    expect(codeEntryFromHtml(page('[1,"Name",null,0,[[55501,null,1]]]'))).toBeNull();
    expect(codeEntryFromHtml("<html>sign in</html>")).toBeNull();
    expect(codeEntryFromHtml("<script>FB_PUBLIC_LOAD_DATA_ = [oops];</script>")).toBeNull();
  });
});
