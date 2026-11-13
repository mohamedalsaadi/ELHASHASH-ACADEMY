import { describe, expect, it } from "vitest";
import { doneKey, firstBlocker, isLocked, type RequiredItem } from "./gate";
import type { Grant } from "./plans";

const now = new Date("2026-11-13T10:00:00Z");
const entry = (id: string, month: number | null = null, isFree = false) => ({ lesson: { id, order: 1, month }, term: 1, isFree });
const entries = [entry("l1"), entry("l2"), entry("l3"), entry("l4")];
// A whole-course plan that is running opens every lesson.
const plan = { lessonId: null, liveSessionId: null, accessType: "COURSE", term: null, month: null, startsAt: new Date("2026-01-01"), endsAt: null } as unknown as Grant;
const hw = (lessonId: string, id = `hw-${lessonId}`): RequiredItem => ({ lessonId, kind: "assignment", id, title: id });

describe("firstBlocker and isLocked", () => {
  it("closes every lesson after the first one with work not handed in, and keeps that lesson open", () => {
    const b = firstBlocker(entries, [plan], now, [hw("l2")], new Set())!;
    expect(b.item.id).toBe("hw-l2");
    expect(isLocked(entries, b, "l1")).toBe(false);
    expect(isLocked(entries, b, "l2")).toBe(false);
    expect(isLocked(entries, b, "l3")).toBe(true);
    expect(isLocked(entries, b, "l4")).toBe(true);
  });
  it("opens again once the item is handed in, and moves on to the next required one", () => {
    const required = [hw("l2"), { ...hw("l3"), kind: "exam" as const, id: "ex-l3" }];
    const done = new Set([doneKey("assignment", "hw-l2")]);
    const b = firstBlocker(entries, [plan], now, required, done)!;
    expect(b.item.id).toBe("ex-l3");
    expect(isLocked(entries, b, "l4")).toBe(true);
    expect(firstBlocker(entries, [plan], now, required, new Set([...done, doneKey("exam", "ex-l3")]))).toBeNull();
  });
  it("ignores work on lessons the plan does not open, and does nothing when nothing is required", () => {
    expect(firstBlocker(entries, [], now, [hw("l1")], new Set())).toBeNull();
    expect(firstBlocker(entries, [plan], now, [], new Set())).toBeNull();
    expect(isLocked(entries, null, "l4")).toBe(false);
  });
  it("treats an unknown lesson as not locked", () => {
    const b = firstBlocker(entries, [plan], now, [hw("l1")], new Set());
    expect(isLocked(entries, b, "nope")).toBe(false);
  });
});
