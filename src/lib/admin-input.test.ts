import { describe, expect, it } from "vitest";
import { cairoDay, toDayInput, toTimeInput, wallTime, youtubeId } from "./admin-input";

describe("youtubeId", () => {
  it("reads every common link form and the bare id", () => {
    for (const s of [
      "dQw4w9WgXcQ",
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s",
      "https://youtu.be/dQw4w9WgXcQ?si=abc",
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
      "https://youtube.com/shorts/dQw4w9WgXcQ",
    ]) expect(youtubeId(s)).toBe("dQw4w9WgXcQ");
  });
  it("rejects anything else", () => {
    expect(youtubeId("https://example.com/video")).toBeNull();
  });
});

describe("cairo days", () => {
  it("round-trips a date input through the end of the Cairo day", () => {
    const d = cairoDay("2027-01-31", "end")!;
    expect(d.toISOString()).toBe("2027-01-31T21:59:59.000Z");
    expect(toDayInput(d)).toBe("2027-01-31");
    expect(cairoDay("", "start")).toBeNull();
    // Summer time: Cairo is UTC+3 in July.
    const july = cairoDay("2027-07-15", "end")!;
    expect(july.toISOString()).toBe("2027-07-15T20:59:59.000Z");
    expect(toDayInput(july)).toBe("2027-07-15");
  });
});

describe("wall times", () => {
  it("reads a datetime-local value in the given zone and writes it back", () => {
    const dubai = wallTime("2026-11-02T18:30", "Asia/Dubai")!;
    expect(dubai.toISOString()).toBe("2026-11-02T14:30:00.000Z");
    expect(toTimeInput(dubai, "Asia/Dubai")).toBe("2026-11-02T18:30");
    // Cairo in summer time is UTC+3, in winter UTC+2.
    expect(wallTime("2027-07-01T20:00", "Africa/Cairo")!.toISOString()).toBe("2027-07-01T17:00:00.000Z");
    expect(wallTime("2027-01-10T20:00", "Africa/Cairo")!.toISOString()).toBe("2027-01-10T18:00:00.000Z");
    expect(wallTime("", "Asia/Dubai")).toBeNull();
  });
});
