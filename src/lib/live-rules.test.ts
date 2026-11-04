import { describe, expect, it } from "vitest";
import { meetingProvider, meetingUrlError } from "./live-rules";

describe("meetingUrlError", () => {
  it("accepts an https link from each allowed provider", () => {
    for (const url of [
      "https://us02web.zoom.us/j/123456789",
      "https://zoom.us/j/123",
      "https://teams.microsoft.com/l/meetup-join/abc",
      "https://teams.live.com/meet/123",
      "https://meet.google.com/abc-defg-hij",
    ]) {
      expect(meetingUrlError(url)).toBeNull();
    }
  });

  it("rejects plain http", () => {
    expect(meetingUrlError("http://meet.google.com/abc-defg-hij")).toBe("invalid");
  });

  it("rejects another host, including one that only looks like a provider", () => {
    for (const url of [
      "https://example.com/meet",
      "https://evil.com/zoom.us",
      "https://zoom.us@evil.com/j/1",
      "https://zoom.us.evil.com/j/1",
    ]) {
      expect(meetingUrlError(url)).toBe("invalid");
    }
  });

  it("rejects junk and empty input", () => {
    expect(meetingUrlError("javascript:alert(1)")).toBe("invalid");
    expect(meetingUrlError("not a url")).toBe("invalid");
    expect(meetingUrlError("")).toBe("empty");
    expect(meetingUrlError("   ")).toBe("empty");
  });

  it("trims before judging", () => {
    expect(meetingUrlError("  https://meet.google.com/abc  ")).toBeNull();
  });
});

describe("meetingProvider", () => {
  it("names the provider from the host", () => {
    expect(meetingProvider("https://us02web.zoom.us/j/1")).toBe("Zoom");
    expect(meetingProvider("https://teams.microsoft.com/l/meetup-join/x")).toBe("Microsoft Teams");
    expect(meetingProvider("https://meet.google.com/abc-defg-hij")).toBe("Google Meet");
  });

  it("returns null for an unknown host or a non-url", () => {
    expect(meetingProvider("https://example.com/x")).toBeNull();
    expect(meetingProvider("nope")).toBeNull();
  });
});
