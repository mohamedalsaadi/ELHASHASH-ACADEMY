type ProfileUser = { role: string; phone: string | null; gradeId: string | null; dateOfBirth: Date | null };

/**
 * A first Google (or Microsoft) sign-in creates a STUDENT row with no grade, birth date or phone. What is still missing
 * decides what the profile page asks: grade and birth date right after sign-in, the phone only when the student is
 * about to pay. Other roles have nothing to finish.
 */
export function missingProfile(user: ProfileUser): { grade: boolean; dob: boolean; phone: boolean } {
  const student = user.role === "STUDENT";
  return { grade: student && !user.gradeId, dob: student && !user.dateOfBirth, phone: student && !user.phone };
}

/** The sign-in screen is still open: without a grade the student cannot be shown their courses. */
export function needsGrade(user: ProfileUser): boolean {
  return missingProfile(user).grade;
}

/**
 * Not ready to buy. A missing birth date reads as an adult and would skip the guardian check that every minor needs
 * before paying, and the phone is the student's sign-in and the receipt contact.
 */
export function profileIncomplete(user: ProfileUser): boolean {
  return Object.values(missingProfile(user)).some(Boolean);
}

/** Where an unfinished student is sent, with the page they were heading to kept for afterwards. `phone` also asks for the number (checkout). */
export function completeProfileUrl(locale: string, next?: string, phone = false): string {
  const query = [next ? `next=${encodeURIComponent(next)}` : "", phone ? "phone=1" : ""].filter(Boolean).join("&");
  return `/${locale}/complete-profile${query ? `?${query}` : ""}`;
}
