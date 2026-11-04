import { describe, expect, it } from "vitest";
import { matchesQuery, normalizeSearch } from "./arabic-search";

describe("normalizeSearch", () => {
  it("folds the alef forms, so أ إ آ ا all match", () => {
    for (const written of ["أحياء", "إحياء", "آحياء", "احياء"]) {
      expect(normalizeSearch(written)).toBe(normalizeSearch("احياء"));
    }
  });

  it("folds taa marbuta to haa and alef maqsura to yaa", () => {
    expect(normalizeSearch("رياضة")).toBe(normalizeSearch("رياضه"));
    expect(normalizeSearch("مستشفى")).toBe(normalizeSearch("مستشفي"));
  });

  it("drops diacritics and tatweel", () => {
    expect(normalizeSearch("الرِّيَاضِيَّات")).toBe(normalizeSearch("الرياضيات"));
    expect(normalizeSearch("فيــزياء")).toBe(normalizeSearch("فيزياء"));
  });

  it("reads Arabic-Indic digits as Latin ones", () => {
    expect(normalizeSearch("الصف ١٢")).toBe(normalizeSearch("الصف 12"));
  });

  it("folds hamza carriers onto their seats", () => {
    expect(normalizeSearch("مؤمن")).toBe(normalizeSearch("مومن"));
    expect(normalizeSearch("مسائل")).toBe(normalizeSearch("مسايل"));
  });

  it("strips Latin accents and lowercases", () => {
    expect(normalizeSearch("Café Maths")).toBe("cafe maths");
  });

  it("collapses whitespace", () => {
    expect(normalizeSearch("  رياضيات   ١٢  ")).toBe("رياضيات 12");
  });
});

describe("matchesQuery", () => {
  const english = { title: "Mathematics, Grade 12", subject: "Mathematics", grade: "Grade 12" };
  const fields = [english.title, english.subject, english.grade];

  it("matches the spelling the student actually types", () => {
    // The catalogue says "الرياضيات"; students type it without the article or with another alef.
    const catalogue = ["الرياضيات للصف الثاني عشر", "الرياضيات"];
    for (const typed of ["رياضيات", "الرياضيات", "الرياضيات"]) {
      expect(matchesQuery(catalogue, typed)).toBe(true);
    }
  });

  it("matches a word without its article, in either direction", () => {
    expect(matchesQuery(["الأحياء"], "احياء")).toBe(true);
    expect(matchesQuery(["احياء"], "الأحياء")).toBe(true);
  });

  it("requires every word of the query", () => {
    expect(matchesQuery(fields, "math 12")).toBe(true);
    expect(matchesQuery(fields, "math 11")).toBe(false);
  });

  it("matches across Arabic and English in one query", () => {
    expect(matchesQuery(["رياضيات Mathematics"], "math رياضيات")).toBe(true);
  });

  it("is false for an empty query and for empty fields", () => {
    expect(matchesQuery(fields, "")).toBe(false);
    expect(matchesQuery(fields, "   ")).toBe(false);
    expect(matchesQuery([null, undefined, ""], "رياضيات")).toBe(false);
  });
});
