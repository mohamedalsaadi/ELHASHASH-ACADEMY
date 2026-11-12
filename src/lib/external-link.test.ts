import { describe, expect, it } from "vitest";
import { isAllowedQuizLink, quizUrlFor, STUDENT_TOKEN, studentCode, studentForCode } from "./external-link";

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
    expect(studentForCode(code.toLowerCase(), "a1", ["s0", "s1", "s2"])).toBe("s1");
    expect(studentForCode("0000000000", "a1", ["s0", "s1"])).toBeNull();
    expect(studentForCode("", "a1", ["s1"])).toBeNull();
  });
});
