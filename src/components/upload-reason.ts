/** Asks the server why an upload was refused; null when it cannot say (the upload failed for another reason). */
export async function refusalReason(purpose: string, courseId: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/blob/check?purpose=${encodeURIComponent(purpose)}&courseId=${encodeURIComponent(courseId)}`, { cache: "no-store" });
    const body = (await res.json()) as { ok: boolean; reason: string | null };
    return body.ok ? null : body.reason;
  } catch {
    return null;
  }
}
