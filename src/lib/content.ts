/**
 * Content written in two languages, read in one.
 *
 * `ar ? titleAr : titleEn` shows an empty heading to an English visitor when the teacher only filled
 * the Arabic title. Falling back to the other language is always better than showing nothing.
 */
export function pick(ar: boolean, arabic: string | null | undefined, english: string | null | undefined): string {
  return (ar ? arabic || english : english || arabic) ?? "";
}
