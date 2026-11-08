import { describe, expect, it } from "vitest";
import { judgePlay, type PlayEventLite } from "./play-limits";

const now = 1_000_000_000_000;
const MIN = 60_000;
const ev = (o: Partial<PlayEventLite> = {}): PlayEventLite => ({ userId: "kid", lessonId: "L1", ip: "a", country: "AE", at: now - 60 * MIN, ...o });
const base = { now, viewerId: "kid", lessonId: "L1", ip: "a", country: "AE", events: [ev()], lessonPlays: 0, maxPlays: 3, maxIps: 2 };

describe("judgePlay", () => {
  it("allows under the caps", () => expect(judgePlay(base)).toBe("ok"));
  it("blocks the play after the cap", () => expect(judgePlay({ ...base, lessonPlays: 3 })).toBe("plays"));
  it("lets a refresh through at the cap", () =>
    expect(judgePlay({ ...base, lessonPlays: 3, events: [ev({ at: now - MIN })] })).toBe("ok"));
  it("blocks a new IP past the IP cap", () =>
    expect(judgePlay({ ...base, events: [ev(), ev({ ip: "b" })], ip: "c" })).toBe("ips"));
  it("lets a known IP through at the IP cap", () =>
    expect(judgePlay({ ...base, events: [ev(), ev({ ip: "b" })], ip: "b" })).toBe("ok"));
  it("null means unlimited", () =>
    expect(judgePlay({ ...base, lessonPlays: 99, maxPlays: null, maxIps: null, events: [ev(), ev({ ip: "b" }), ev({ ip: "c" })], ip: "d" })).toBe("ok"));

  it("counts a parent's IP in the child's cap", () =>
    expect(judgePlay({ ...base, viewerId: "mum", ip: "c", events: [ev(), ev({ userId: "mum", ip: "b" })] })).toBe("ips"));
  it("blocks a parent while the child is still watching", () =>
    expect(judgePlay({ ...base, viewerId: "mum", events: [ev({ at: now - 2 * MIN })] })).toBe("together"));
  it("lets the parent in once the child's play is old", () =>
    expect(judgePlay({ ...base, viewerId: "mum", events: [ev({ at: now - 30 * MIN })] })).toBe("ok"));
  it("blocks the child while the parent is watching from elsewhere", () =>
    expect(judgePlay({ ...base, ip: "z", events: [ev({ userId: "mum", ip: "b", at: now - MIN })] })).toBe("together"));
  it("blocks a different country within hours", () =>
    expect(judgePlay({ ...base, viewerId: "mum", country: "EG", events: [ev({ at: now - 60 * MIN })] })).toBe("location"));
  it("ignores an unknown country", () =>
    expect(judgePlay({ ...base, viewerId: "mum", country: null, events: [ev({ at: now - 60 * MIN })] })).toBe("ok"));
});
