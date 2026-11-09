import { describe, expect, it } from "vitest";
import { envelope, parseDsn } from "./sentry";

describe("sentry envelope", () => {
  it("parses a DSN and refuses junk", () => {
    expect(parseDsn("https://abc123@o1.ingest.sentry.io/456")).toEqual({
      url: "https://o1.ingest.sentry.io/api/456/envelope/",
      auth: "Sentry sentry_version=7, sentry_key=abc123, sentry_client=dhirwa/1",
    });
    expect(parseDsn("not a dsn")).toBeNull();
  });

  it("builds three lines and drops the query string", () => {
    const lines = envelope("https://k@h/1", new Error("boom"), { path: "/ar/x?token=secret", method: "GET" }).trim().split("\n");
    expect(lines).toHaveLength(3);
    const ev = JSON.parse(lines[2]);
    expect(ev.exception.values[0].value).toBe("boom");
    expect(ev.request.url).toBe("/ar/x");
    expect(lines.join("")).not.toContain("secret");
  });
});
