import { describe, expect, it } from "vitest";
import { liveAtSec, liveOffsetSec, premiereStage } from "./premiere";

const startsAt = new Date("2026-12-10T16:00:00Z");
const endsAt = new Date("2026-12-10T17:00:00Z");
const base = { startsAt, endsAt, replay: true, cancelled: false, signedIn: true, staff: false };
const at = (iso: string) => new Date(iso);

describe("premiereStage", () => {
  it("never gives a signed-out visitor the video, before, during or after", () => {
    for (const iso of ["2026-12-10T15:00:00Z", "2026-12-10T16:30:00Z", "2026-12-11T00:00:00Z"]) {
      expect(premiereStage({ ...base, signedIn: false, now: at(iso) })).toBe("signin");
    }
  });

  it("keeps the video closed before the start", () => {
    expect(premiereStage({ ...base, now: at("2026-12-10T15:59:59Z") })).toBe("countdown");
  });

  it("opens at the start and stays open after the end while replay is on", () => {
    expect(premiereStage({ ...base, now: at("2026-12-10T16:00:00Z") })).toBe("watch");
    expect(premiereStage({ ...base, now: at("2026-12-12T00:00:00Z") })).toBe("watch");
  });

  it("closes after the end when replay is off, but not when the length is unknown", () => {
    expect(premiereStage({ ...base, replay: false, now: at("2026-12-10T17:00:00Z") })).toBe("ended");
    expect(premiereStage({ ...base, replay: false, endsAt: null, now: at("2026-12-12T00:00:00Z") })).toBe("watch");
  });

  it("hides a cancelled premiere from everyone but staff", () => {
    expect(premiereStage({ ...base, cancelled: true, now: at("2026-12-10T16:30:00Z") })).toBe("cancelled");
    expect(premiereStage({ ...base, cancelled: true, signedIn: false, now: at("2026-12-10T16:30:00Z") })).toBe("cancelled");
    expect(premiereStage({ ...base, cancelled: true, staff: true, now: at("2026-12-10T16:30:00Z") })).toBe("watch");
  });

  it("lets signed-in staff preview before the start", () => {
    expect(premiereStage({ ...base, staff: true, now: at("2026-12-01T00:00:00Z") })).toBe("watch");
  });
});

describe("liveOffsetSec", () => {
  it("is zero before the start, at the start and with an unknown length", () => {
    expect(liveOffsetSec(at("2026-12-10T15:00:00Z"), startsAt, 3600)).toBe(0);
    expect(liveOffsetSec(startsAt, startsAt, 3600)).toBe(0);
    expect(liveOffsetSec(at("2026-12-10T16:10:00Z"), startsAt, null)).toBe(0);
  });

  it("counts seconds into the video for a late joiner", () => {
    expect(liveOffsetSec(at("2026-12-10T16:10:00Z"), startsAt, 3600)).toBe(600);
  });

  it("restarts from the beginning once the live window has passed", () => {
    expect(liveOffsetSec(at("2026-12-10T17:30:00Z"), startsAt, 3600)).toBe(0);
  });
});

describe("liveAtSec", () => {
  const s = startsAt.getTime();
  it("follows the clock and stays inside the video", () => {
    expect(liveAtSec(s - 5000, s, 3600)).toBe(0);
    expect(liveAtSec(s + 600_000, s, 3600)).toBe(600);
    expect(liveAtSec(s + 9_999_000, s, 3600)).toBe(3599);
    expect(liveAtSec(s + 5000, s, 0)).toBe(0);
  });
});
