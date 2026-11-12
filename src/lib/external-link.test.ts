import { describe, expect, it } from "vitest";
import { hasStudentToken, isAllowedQuizLink, isCheckKey, quizCheckScript, quizUrlFor, STUDENT_TOKEN, studentCode, studentForCode } from "./external-link";

describe("isAllowedQuizLink", () => {
  it("accepts Google Forms links only", () => {
    expect(isAllowedQuizLink("https://docs.google.com/forms/d/e/abc/viewform?usp=pp_url&entry.1=" + STUDENT_TOKEN)).toBe(true);
    expect(isAllowedQuizLink("https://forms.gle/abc123")).toBe(true);
    expect(isAllowedQuizLink("http://forms.gle/abc123")).toBe(false);
    expect(isAllowedQuizLink("https://docs.google.com/document/d/abc")).toBe(false);
    expect(isAllowedQuizLink("https://forms.gle.evil.com/abc")).toBe(false);
    expect(isAllowedQuizLink("https://example.com/forms/x")).toBe(false);
    expect(isAllowedQuizLink("javascript:alert(1)")).toBe(false);
  });
});

describe("student codes", () => {
  it("is stable, differs per student and per assignment, and does not contain the id", () => {
    const a = studentCode("student-1", "assign-1");
    expect(a).toBe(studentCode("student-1", "assign-1"));
    expect(a).not.toBe(studentCode("student-2", "assign-1"));
    expect(a).not.toBe(studentCode("student-1", "assign-2"));
    expect(a).toMatch(/^[0-9A-F]{10}$/);
    expect(a).not.toContain("student");
  });
  it("is placed where the placeholder is, and found again from the code", () => {
    const code = studentCode("s1", "a1");
    expect(quizUrlFor(`https://forms.gle/x?entry.5=${STUDENT_TOKEN}`, code)).toBe(`https://forms.gle/x?entry.5=${code}`);
    expect(quizUrlFor("https://forms.gle/x", code)).toBe("https://forms.gle/x");
    expect(quizUrlFor("https://docs.google.com/forms/d/e/x/viewform?usp=pp_url&entry.5=%7Bstudent%7D", code)).toBe(`https://docs.google.com/forms/d/e/x/viewform?usp=pp_url&entry.5=${code}`);
    // A form's own Student code question: the code goes into entry.<id>, and a link with the placeholder is left to the placeholder.
    expect(quizUrlFor("https://docs.google.com/forms/d/e/x/viewform", code, "1691794639")).toBe(`https://docs.google.com/forms/d/e/x/viewform?usp=pp_url&entry.1691794639=${code}`);
    expect(quizUrlFor(`https://forms.gle/x?entry.5=${STUDENT_TOKEN}`, code, "1691794639")).toBe(`https://forms.gle/x?entry.5=${code}`);
    expect(studentForCode(code.toLowerCase(), "a1", ["s0", "s1", "s2"])).toBe("s1");
    expect(studentForCode("0000000000", "a1", ["s0", "s1"])).toBeNull();
    expect(studentForCode("", "a1", ["s1"])).toBeNull();
  });
});

describe("form check", () => {
  it("accepts only the key of its own assignment", () => {
    const script = quizCheckScript({ endpoint: "https://x.test/api/quiz-check", assignmentId: "a1" });
    const key = /const KEY = "([0-9a-f]{32})"/.exec(script)![1];
    expect(isCheckKey("a1", key)).toBe(true);
    expect(isCheckKey("a2", key)).toBe(false);
    expect(isCheckKey("a1", key.slice(1))).toBe(false);
    expect(script).toContain('const ASSIGNMENT = "a1"');
  });
  it("sees the placeholder plain or percent-encoded", () => {
    expect(hasStudentToken("https://forms.gle/x?entry.1={student}")).toBe(true);
    expect(hasStudentToken("https://forms.gle/x?entry.1=%7Bstudent%7D")).toBe(true);
    expect(hasStudentToken("https://forms.gle/x")).toBe(false);
  });
});
