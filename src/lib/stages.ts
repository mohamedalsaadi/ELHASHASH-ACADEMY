// School stages per country, as each ministry groups grades 1–12. Grade pages group tiles by these.
export type Stage = { from: number; to: number; ar: string; en: string };
type Country = "EG" | "SA" | "AE" | "KW" | "QA" | "BH" | "OM";

const PRIMARY = { ar: "المرحلة الابتدائية", en: "Primary" };
const SECONDARY = { ar: "المرحلة الثانوية", en: "Secondary" };

export const STAGES: Record<Country, Stage[]> = {
  EG: [{ from: 1, to: 6, ...PRIMARY }, { from: 7, to: 9, ar: "المرحلة الإعدادية", en: "Preparatory" }, { from: 10, to: 12, ...SECONDARY }],
  SA: [{ from: 1, to: 6, ...PRIMARY }, { from: 7, to: 9, ar: "المرحلة المتوسطة", en: "Intermediate" }, { from: 10, to: 12, ...SECONDARY }],
  BH: [{ from: 1, to: 6, ...PRIMARY }, { from: 7, to: 9, ar: "المرحلة الإعدادية", en: "Intermediate" }, { from: 10, to: 12, ...SECONDARY }],
  QA: [{ from: 1, to: 6, ...PRIMARY }, { from: 7, to: 9, ar: "المرحلة الإعدادية", en: "Preparatory" }, { from: 10, to: 12, ...SECONDARY }],
  KW: [{ from: 1, to: 5, ...PRIMARY }, { from: 6, to: 9, ar: "المرحلة المتوسطة", en: "Intermediate" }, { from: 10, to: 12, ...SECONDARY }],
  AE: [
    { from: 1, to: 4, ar: "الحلقة الأولى", en: "Cycle 1" },
    { from: 5, to: 8, ar: "الحلقة الثانية", en: "Cycle 2" },
    { from: 9, to: 12, ar: "الحلقة الثالثة", en: "Cycle 3" },
  ],
  OM: [
    { from: 1, to: 4, ar: "الحلقة الأولى", en: "Cycle 1" },
    { from: 5, to: 10, ar: "الحلقة الثانية", en: "Cycle 2" },
    { from: 11, to: 12, ar: "ما بعد الأساسي", en: "Post-basic" },
  ],
};

const ORDINAL = ["الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع", "الثامن", "التاسع", "العاشر", "الحادي عشر", "الثاني عشر"];
// Countries that count grades within each stage ("الصف الأول المتوسط"); the rest count 1–12 ("الصف السابع").
const PER_STAGE: Partial<Record<Country, [string, string, string]>> = {
  EG: ["الابتدائي", "الإعدادي", "الثانوي"],
  SA: ["الابتدائي", "المتوسط", "الثانوي"],
  BH: ["الابتدائي", "الإعدادي", "الثانوي"],
};

export function stageOf(country: Country, level: number): Stage {
  return STAGES[country].find((s) => level >= s.from && level <= s.to)!;
}

export function gradeName(country: Country, level: number): { nameAr: string; nameEn: string } {
  const words = PER_STAGE[country];
  if (!words) return { nameAr: `الصف ${ORDINAL[level - 1]}`, nameEn: `Grade ${level}` };
  const i = STAGES[country].findIndex((s) => level >= s.from && level <= s.to);
  const stage = STAGES[country][i];
  const n = level - stage.from + 1;
  return { nameAr: `الصف ${ORDINAL[n - 1]} ${words[i]}`, nameEn: `${stage.en} ${n}` };
}
