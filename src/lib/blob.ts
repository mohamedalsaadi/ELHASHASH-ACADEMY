// Vercel Blob helpers shared by the upload token route, the download route and the server actions.
import { head } from "@vercel/blob";

/** What a homework handout or a student's answer may be. Anything else is refused at token time. */
export const ALLOWED_CONTENT_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_FILES = 5;

/** Path prefixes: an assignment file lives under its course, a submission under its assignment and student. */
export const homeworkPrefix = (courseId: string) => `homework/${courseId}/`;
export const submissionPrefix = (assignmentId: string, studentId: string) => `submissions/${assignmentId}/${studentId}/`;

/** The browser's filename is only a label. Strip anything that could break a header or escape the store. */
export function safeDownloadName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  const cleaned = base.replace(/[\u0000-\u001f"\\]/g, "").trim();
  return (cleaned || "file").slice(0, 200);
}

/** RFC 6266: an ASCII fallback plus the real UTF-8 name, so Arabic filenames survive. */
export function contentDisposition(name: string): string {
  const safe = safeDownloadName(name);
  const ascii = safe.replace(/[^\x20-\x7e]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(safe)}`;
}

/** The stored size and type, read from Blob rather than trusted from the client. Null when it is gone. */
export async function blobInfo(pathname: string): Promise<{ size: number; contentType: string } | null> {
  try {
    const info = await head(pathname);
    return { size: info.size, contentType: info.contentType };
  } catch {
    return null;
  }
}
