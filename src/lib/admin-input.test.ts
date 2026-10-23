import { describe, expect, it } from "vitest";
import { cairoDay, toDayInput, youtubeId } from "./admin-input";

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
  });
});
