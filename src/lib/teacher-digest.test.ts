import { describe, expect, it } from "vitest";
import { digestLines, digestTotal } from "./teacher-digest";

describe("teacher digest", () => {
  it("lists only what is waiting, in the teacher's language", () => {
    const d = { questions: 3, reviews: 0, homework: 1, requests: 0 };
    expect(digestLines(d, "en")).toEqual(["3 student questions waiting for your answer", "1 homework waiting for grading for over 48 hours"]);
    expect(digestLines(d, "ar")[0]).toBe("3 أسئلة طلاب تنتظر إجابتك");
  });
  it("totals to zero for an empty queue, so no email is sent", () => {
    expect(digestTotal({ questions: 0, reviews: 0, homework: 0, requests: 0 })).toBe(0);
    expect(digestLines({ questions: 0, reviews: 0, homework: 0, requests: 0 }, "en")).toEqual([]);
  });
});
