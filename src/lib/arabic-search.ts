// Arabic-tolerant search for the catalogue. Postgres `contains` misses almost every real Arabic
// query because the same word is written several ways: أ/إ/آ/ا, ة/ه, ى/ي, optional diacritics,
// tatweel, and Arabic-Indic digits. Folding both sides through here makes those forms equal, and
// Latin accents fall away too so a mixed "math رياضيات" query still matches.
// Pure: no database, no dependency, so it is cheap to test and to call per row.

const DIACRITICS = /[ؐ-ًؚ-ٰٟۖ-ۭ]/g;
const TATWEEL = /ـ/g;
// أ إ آ ٱ -> ا
const ALEF_FORMS = /[أإآٱ]/g;
const ARABIC_INDIC = /[٠-٩]/g;
const EXTENDED_INDIC = /[۰-۹]/g;

export function normalizeSearch(input: string): string {
  return input
    .normalize("NFKD")
    // Latin accents: café -> cafe. Arabic marks are handled below, not here.
    .replace(/[̀-ͯ]/g, "")
    .replace(DIACRITICS, "")
    .replace(TATWEEL, "")
    .replace(ALEF_FORMS, "ا")
    .replace(/ى/g, "ي") // ى -> ي
    .replace(/ة/g, "ه") // ة -> ه
    .replace(/ؤ/g, "و") // ؤ -> و
    .replace(/ئ/g, "ي") // ئ -> ي
    .replace(ARABIC_INDIC, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(EXTENDED_INDIC, (d) => String(d.charCodeAt(0) - 0x06f0))
    .toLowerCase()
    .replace(/[\s ]+/g, " ")
    .trim();
}

function tokenMatches(haystack: string, token: string): boolean {
  if (haystack.includes(token)) return true;
  // The catalogue often carries the article where the student drops it, and vice versa:
  // "الرياضيات" should still find an entry stored as "رياضيات".
  return token.startsWith("ال") && token.length > 3 && haystack.includes(token.slice(2));
}

/**
 * Every word of the query must appear somewhere in the fields, after folding. Joining the fields
 * first means "رياضيات 12" matches a course whose subject is رياضيات and whose grade is 12.
 */
export function matchesQuery(fields: (string | null | undefined)[], query: string): boolean {
  const tokens = normalizeSearch(query).split(" ").filter(Boolean);
  if (tokens.length === 0) return false;
  const haystack = normalizeSearch(fields.filter((f): f is string => !!f).join(" "));
  return tokens.every((token) => tokenMatches(haystack, token));
}
