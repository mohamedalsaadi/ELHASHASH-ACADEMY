// Meeting-link rules for live lectures. Pure, so the tests never load a database.

/** The providers a teacher may paste a link for. Anything else is refused, so a stale or hostile
 *  link cannot be stored and later shown to a student. */
export const MEETING_HOSTS = ["zoom.us", "teams.microsoft.com", "teams.live.com", "meet.google.com"] as const;

/** Bumped when the consent wording shown to a guardian changes. */
export const CONSENT_VERSION = "2026-11-05";

/** null when the link is usable, otherwise the reason. https only, and only the allowed hosts. */
export function meetingUrlError(raw: string): "empty" | "invalid" | null {
  const value = raw.trim();
  if (!value) return "empty";
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return "invalid";
  }
  if (url.protocol !== "https:") return "invalid";
  const allowed = MEETING_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
  return allowed ? null : "invalid";
}

/** The provider named in copy, for a link that already passed meetingUrlError. */
export function meetingProvider(raw: string): "Zoom" | "Microsoft Teams" | "Google Meet" | null {
  let host: string;
  try {
    host = new URL(raw.trim()).hostname;
  } catch {
    return null;
  }
  if (host === "zoom.us" || host.endsWith(".zoom.us")) return "Zoom";
  if (host === "teams.microsoft.com" || host === "teams.live.com") return "Microsoft Teams";
  if (host === "meet.google.com") return "Google Meet";
  return null;
}
