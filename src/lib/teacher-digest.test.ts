import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  user: { findMany: vi.fn() },
  analyticsEvent: { findUnique: vi.fn(), create: vi.fn() },
  question: { count: vi.fn() },
  courseReview: { count: vi.fn() },
  submission: { count: vi.fn() },
  specialRequest: { count: vi.fn() },
}));
const sendMail = vi.hoisted(() => vi.fn());

vi.mock("./db", () => ({ db }));
vi.mock("./mail", () => ({ appUrl: () => "https://x.test", emailLayout: () => "<p/>", sendMail }));
vi.mock("./unsubscribe", () => ({ unsubscribeUrl: () => "https://x.test/u" }));

import { digestLines, digestTotal, sendTeacherDigests } from "./teacher-digest";

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  db.analyticsEvent.findUnique.mockResolvedValue(null);
  db.analyticsEvent.create.mockResolvedValue({});
  db.courseReview.count.mockResolvedValue(0);
  db.submission.count.mockResolvedValue(0);
  db.specialRequest.count.mockResolvedValue(0);
  db.question.count.mockResolvedValue(2);
  sendMail.mockResolvedValue(true);
});

describe("sendTeacherDigests", () => {
  const teachers = [
    { id: "t1", email: "a@x.test", locale: "ar" },
    { id: "t2", email: "b@x.test", locale: "en" },
  ];

  it("keeps going when one teacher's lookup throws", async () => {
    db.user.findMany.mockResolvedValue(teachers);
    db.question.count.mockRejectedValueOnce(new Error("db timeout")).mockResolvedValue(2);
    const r = await sendTeacherDigests();
    expect(r).toEqual({ teachers: 2, sent: 1 });
    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  it("skips a teacher who already got today's digest, and records each send", async () => {
    db.user.findMany.mockResolvedValue(teachers);
    db.analyticsEvent.findUnique.mockImplementation(async ({ where }: { where: { dedupeKey: string } }) =>
      where.dedupeKey.startsWith("teacher-digest:t1:") ? { id: "e" } : null,
    );
    const r = await sendTeacherDigests();
    expect(r.sent).toBe(1);
    expect(db.analyticsEvent.create).toHaveBeenCalledTimes(1);
    expect(db.analyticsEvent.create.mock.calls[0][0].data.dedupeKey).toMatch(/^teacher-digest:t2:\d{4}-\d{2}-\d{2}$/);
  });
});

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
