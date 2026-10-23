import { expect, it } from "vitest";
import { safeNext } from "./safe-redirect";

it("keeps same-site paths and rejects everything that can leave the site", () => {
  expect(safeNext("/ar/checkout?sku=a&sku=b", "/ar")).toBe("/ar/checkout?sku=a&sku=b");
  for (const bad of ["//evil.com", "/\\evil.com", "\\\\evil.com", "https://evil.com", "/\tevil", "", undefined, null]) {
    expect(safeNext(bad, "/ar")).toBe("/ar");
  }
});
