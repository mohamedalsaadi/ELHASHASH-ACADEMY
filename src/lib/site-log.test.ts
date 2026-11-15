import { describe, expect, it } from "vitest";
import { scrub } from "./site-log";

describe("scrub", () => {
  it("drops query strings so tokens never reach the log", () => {
    expect(scrub("GET /verify?token=abc&code=1 failed", 500)).toBe("GET /verify failed");
    expect(scrub("see (https://x.test/a?otp=zz)", 500)).toBe("see (https://x.test/a)");
  });
  it("cuts to the limit", () => {
    expect(scrub("x".repeat(900), 500)).toHaveLength(500);
  });
});
