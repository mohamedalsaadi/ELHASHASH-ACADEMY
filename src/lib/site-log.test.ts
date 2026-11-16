import { describe, expect, it } from "vitest";
import { repeated, scrub } from "./site-log";

describe("scrub", () => {
  it("drops query strings so tokens never reach the log", () => {
    expect(scrub("GET /verify?token=abc&code=1 failed", 500)).toBe("GET /verify failed");
    expect(scrub("see (https://x.test/a?otp=zz)", 500)).toBe("see (https://x.test/a)");
  });
  it("cuts to the limit", () => {
    expect(scrub("x".repeat(900), 500)).toHaveLength(500);
  });
});

describe("repeated", () => {
  it("lets the first line through and drops a repeat inside the window", () => {
    expect(repeated("a|x", 1000, 10_000)).toBe(false);
    expect(repeated("a|x", 1000, 10_500)).toBe(true);
    expect(repeated("a|x", 1000, 11_500)).toBe(false);
  });
  it("keeps different lines apart", () => {
    expect(repeated("b|x", 1000, 20_000)).toBe(false);
    expect(repeated("b|y", 1000, 20_001)).toBe(false);
  });
});
