// A quiz that lives on another site (Google Forms). Our pages decide who gets the link and log each open; they cannot stop a
// subscriber from sharing a link they have seen, so each opener also gets a code the teacher can match to a student.
import { createHmac, timingSafeEqual } from "node:crypto";

/** Where the student's code goes in the teacher's pre-filled link. */
export const STUDENT_TOKEN = "{student}";

/** A quiz link may only point at Google Forms: https, forms.gle or docs.google.com/forms. */
export function isAllowedQuizLink(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return false;
    if (u.hostname === "forms.gle") return true;
    return u.hostname === "docs.google.com" && u.pathname.startsWith("/forms/");
  } catch {
    return false;
  }
}

/**
 * A short code that stands for one student on one assignment: an HMAC with the server's secret, so it cannot be worked out
 * or forged from outside, and it never carries the student's id. The teacher sees it in the form's responses.
 */
export function studentCode(studentId: string, assignmentId: string): string {
  const secret = process.env.AUTH_SECRET ?? (process.env.NODE_ENV === "production" ? "" : "dev-only");
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return createHmac("sha256", secret).update(`quiz:${assignmentId}:${studentId}`).digest("hex").slice(0, 10).toUpperCase();
}

// Google's "Get pre-filled link" percent-encodes the braces, so the placeholder can arrive as %7Bstudent%7D.
const TOKEN_RE = /\{student\}|%7Bstudent%7D/i;

/** Whether the teacher's link carries the placeholder (so each student gets a code). */
export const hasStudentToken = (url: string) => TOKEN_RE.test(url);

/** The teacher's link with this student's code in place of the placeholder (a link without the placeholder is returned as is). */
export function quizUrlFor(template: string, code: string, entry?: string | null): string {
  if (entry && !hasStudentToken(template)) {
    // The form's own "Student code" question: Google reads a pre-filled value from entry.<id>.
    const u = new URL(template);
    u.searchParams.set("usp", "pp_url");
    u.searchParams.set(`entry.${entry}`, code);
    return u.toString();
  }
  return template.replace(new RegExp(TOKEN_RE.source, "gi"), encodeURIComponent(code));
}

/** The key the teacher's Google script sends to prove it belongs to this assignment. Derived from the server secret, never stored. */
export function checkKey(assignmentId: string): string {
  const secret = process.env.AUTH_SECRET ?? (process.env.NODE_ENV === "production" ? "" : "dev-only");
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return createHmac("sha256", secret).update(`quizcheck:${assignmentId}`).digest("hex").slice(0, 32);
}

export function isCheckKey(assignmentId: string, key: string): boolean {
  const want = Buffer.from(checkKey(assignmentId));
  const got = Buffer.from(key);
  return want.length === got.length && timingSafeEqual(want, got);
}

/**
 * The Google Apps Script a teacher pastes into the form. On every answer it asks the site whether the student code belongs to a
 * subscriber of the course, flags a code that comes in twice, and writes one row per answer to a "Dhirwa check" sheet.
 */
export function quizCheckScript({ endpoint, assignmentId }: { endpoint: string; assignmentId: string }): string {
  return `// Dhirwa: checks each answer's student code and records the result in the "Dhirwa check" sheet.
const API = ${JSON.stringify(endpoint)};
const ASSIGNMENT = ${JSON.stringify(assignmentId)};
const KEY = ${JSON.stringify(checkKey(assignmentId))}; // secret: share it with nobody
const CODE_QUESTION = "Student code"; // the exact title of the question that holds the code

// Run this once, then allow the permissions it asks for.
function setup() {
  const form = FormApp.getActiveForm();
  if (!form) throw new Error("This script must be opened from the form itself: in the form, menu (three dots) > Apps Script.");
  ScriptApp.newTrigger("onSubmit").forForm(form).onFormSubmit().create();
}

function onSubmit(e) {
  const r = e.response;
  let code = "";
  r.getItemResponses().forEach(function (i) {
    if (i.getItem().getTitle().trim() === CODE_QUESTION) code = String(i.getResponse()).trim().toUpperCase();
  });
  let status = "no code";
  let name = "";
  if (code) {
    try {
      const res = UrlFetchApp.fetch(API, { method: "post", contentType: "application/json", muteHttpExceptions: true, payload: JSON.stringify({ assignment: ASSIGNMENT, key: KEY, code: code }) });
      const body = JSON.parse(res.getContentText());
      status = body.status || "check failed";
      name = body.name || "";
    } catch (err) {
      status = "check failed";
    }
  }
  const book = SpreadsheetApp.openById(FormApp.getActiveForm().getDestinationId());
  const sheet = book.getSheetByName("Dhirwa check") || book.insertSheet("Dhirwa check");
  if (sheet.getLastRow() === 0) sheet.appendRow(["Time", "Email", "Code", "Student", "Result"]);
  if (code && sheet.getLastRow() > 1 && sheet.getRange(2, 3, sheet.getLastRow() - 1, 1).getValues().flat().indexOf(code) !== -1) status = "duplicate";
  sheet.appendRow([r.getTimestamp(), r.getRespondentEmail(), code, name, status]);
}
`;
}

/** The student, among `studentIds`, whose code is `code`. Null when nobody matches. */
export function studentForCode(code: string, assignmentId: string, studentIds: string[]): string | null {
  const wanted = code.trim().toUpperCase();
  if (!wanted) return null;
  return studentIds.find((id) => studentCode(id, assignmentId) === wanted) ?? null;
}
