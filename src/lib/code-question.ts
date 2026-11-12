// The question a teacher puts in a Google Form for the student's code. Kept apart from the server-only modules so the browser can import it.

/** The question titles we accept (compared without case or extra spaces). */
export const CODE_QUESTION_TITLES = ["student code", "رمز الطالب", "كود الطالب"];

const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
export const isCodeTitle = (title: string) => CODE_QUESTION_TITLES.includes(norm(title));
