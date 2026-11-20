/**
 * A first Google (or Microsoft) sign-in creates a STUDENT row with no phone, grade or birth date; the profile page
 * collects them. Until it has, the account is unfinished: it cannot buy, because a missing birth date reads as an
 * adult and would skip the guardian check that every minor needs before paying.
 */
export function profileIncomplete(user: { role: string; phone: string | null; gradeId: string | null }): boolean {
  return user.role === "STUDENT" && (!user.phone || !user.gradeId);
}

/** Where an unfinished student is sent, with the page they were heading to kept for afterwards. */
export function completeProfileUrl(locale: string, next?: string): string {
  return `/${locale}/complete-profile${next ? `?next=${encodeURIComponent(next)}` : ""}`;
}
