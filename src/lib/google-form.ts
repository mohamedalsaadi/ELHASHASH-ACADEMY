// Finds the "Student code" question of a Google Form, so a teacher only pastes the form's normal link and we add each
// student's code to it. Google shows no public API for this, but a published form's page carries its questions as data.
import { isCodeTitle } from "./code-question";
import { isAllowedQuizLink } from "./external-link";

/**
 * The field id (the number in `entry.<id>`) of the code question in a form page's HTML, or null.
 * The page holds `FB_PUBLIC_LOAD_DATA_ = [...]`; each question is `[questionId, title, help, type, [[fieldId, ...]], ...]`.
 */
export function codeEntryFromHtml(html: string): string | null {
  const m = /FB_PUBLIC_LOAD_DATA_\s*=\s*(\[[\s\S]*?\]);\s*<\/script>/.exec(html);
  if (!m) return null;
  let data: unknown;
  try {
    data = JSON.parse(m[1]);
  } catch {
    return null;
  }
  const items = (data as unknown[][] | null)?.[1]?.[1];
  if (!Array.isArray(items)) return null;
  for (const item of items as unknown[][]) {
    if (!Array.isArray(item) || typeof item[1] !== "string" || !isCodeTitle(item[1])) continue;
    const id = (item[4] as unknown[][] | null)?.[0]?.[0];
    if ((typeof id === "number" || typeof id === "string") && /^\d{4,20}$/.test(String(id))) return String(id);
  }
  return null;
}

/**
 * Opens the teacher's form link (Google addresses only, short links followed) and returns the plain form address, without
 * the query some share links carry (it can hold the owner's account id), and the code question's field id.
 * Null when the page cannot be read at all; the field id is null when the form has no code question (or needs a sign-in).
 */
export async function fetchCodeEntry(link: string): Promise<{ url: string; entry: string | null } | null> {
  if (!isAllowedQuizLink(link)) return null;
  try {
    const res = await fetch(link, { redirect: "follow", signal: AbortSignal.timeout(8000), headers: { "accept-language": "en" } });
    if (!res.ok || !isAllowedQuizLink(res.url)) return null;
    const u = new URL(res.url);
    return { url: `${u.origin}${u.pathname}`, entry: codeEntryFromHtml(await res.text()) };
  } catch {
    return null;
  }
}
