import { describe, expect, it } from "vitest";
import { briefingLines, type Briefing } from "./briefing";

const empty: Briefing = { revenue: [], failedPayments: 0, newStudents: 0, openTickets: 0, ticketsNeedYou: 0, openRequests: 0, heldReviews: 0, pendingTeachers: 0, unansweredQuestions: 0, oldestQuestionHours: null, ungradedHomework: 0, liveToday: [] };

describe("briefingLines", () => {
  it("says nothing is waiting when every queue is empty", () => {
    expect(briefingLines(empty, "en").at(-1)).toBe("Nothing is waiting for you.");
    expect(briefingLines(empty, "ar").at(-1)).toBe("لا شيء ينتظرك الآن.");
  });
  it("lists only the queues that have something in them", () => {
    const lines = briefingLines({ ...empty, openTickets: 2, heldReviews: 1, oldestQuestionHours: 30, unansweredQuestions: 4 }, "en");
    expect(lines).toContain("2 open support tickets");
    expect(lines).toContain("1 low ratings waiting for your decision");
    expect(lines).toContain("The oldest question has waited 30 hours.");
    expect(lines.some((l) => l.includes("failed payments"))).toBe(false);
  });
});
