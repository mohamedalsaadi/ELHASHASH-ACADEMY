import { describe, expect, it } from "vitest";
import { evaluateReadiness, type ReadinessInput } from "./publish-check";

const ready: ReadinessInput = {
  titleAr: "رياضيات",
  titleEn: "Maths",
  descAr: "وصف",
  descEn: null,
  coverKey: "covers/x",
  teacher: { photoUrl: "p", bioAr: "b", bioEn: null },
  lessons: [{ kind: "VIDEO", videoId: "v1", pdfKey: null, pdfPages: 0, questions: 0 }],
  skus: [{ accessType: "SEMESTER", active: true, price: 40000, aedPrice: 40000 }],
};

describe("evaluateReadiness", () => {
  it("passes a complete course with no warnings", () => {
    expect(evaluateReadiness(ready)).toEqual({ blocking: [], warnings: [] });
  });

  it("blocks an empty course on content, package, title and description", () => {
    const r = evaluateReadiness({ ...ready, titleEn: " ", descAr: null, lessons: [], skus: [] });
    expect(r.blocking).toEqual(["title", "description", "content", "package"]);
  });

  it("does not count a video lesson with no video, or a question lesson with no questions", () => {
    const lessons: ReadinessInput["lessons"] = [
      { kind: "VIDEO", videoId: null, pdfKey: null, pdfPages: 0, questions: 0 },
      { kind: "EXAM_STRUCTURE", videoId: null, pdfKey: null, pdfPages: 0, questions: 0 },
    ];
    expect(evaluateReadiness({ ...ready, lessons }).blocking).toEqual(["content"]);
    lessons.push({ kind: "PAST_QUESTIONS", videoId: null, pdfKey: null, pdfPages: 0, questions: 3 });
    expect(evaluateReadiness({ ...ready, lessons }).blocking).toEqual([]);
  });

  it("counts a PDF by its key or its pages", () => {
    expect(evaluateReadiness({ ...ready, lessons: [{ kind: "PDF", videoId: null, pdfKey: "k", pdfPages: 0, questions: 0 }] }).blocking).toEqual([]);
    expect(evaluateReadiness({ ...ready, lessons: [{ kind: "PDF", videoId: null, pdfKey: null, pdfPages: 4, questions: 0 }] }).blocking).toEqual([]);
  });

  it("needs an active whole-course package with a price and an AED price", () => {
    const sku = (o: Partial<ReadinessInput["skus"][number]>) => [{ ...ready.skus[0], ...o }];
    expect(evaluateReadiness({ ...ready, skus: sku({ active: false }) }).blocking).toEqual(["package"]);
    expect(evaluateReadiness({ ...ready, skus: sku({ aedPrice: null }) }).blocking).toEqual(["package"]);
    expect(evaluateReadiness({ ...ready, skus: sku({ price: 0 }) }).blocking).toEqual(["package"]);
    expect(evaluateReadiness({ ...ready, skus: sku({ accessType: "RENTAL" }) }).blocking).toEqual(["package"]);
    expect(evaluateReadiness({ ...ready, skus: sku({ accessType: "LIVE" }) }).blocking).toEqual(["package"]);
  });

  it("warns, but does not block, on a missing cover or teacher page", () => {
    const r = evaluateReadiness({ ...ready, coverKey: null, teacher: { photoUrl: null, bioAr: null, bioEn: null } });
    expect(r.blocking).toEqual([]);
    expect(r.warnings).toEqual(["cover", "teacher"]);
  });
});
