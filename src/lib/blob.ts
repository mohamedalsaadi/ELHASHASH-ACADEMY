// Vercel Blob helpers shared by the upload token route, the download route and the server actions.
import { get, head, put } from "@vercel/blob";

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

/** Course covers and teacher avatars are images only, and small. */
export const COVER_CONTENT_TYPES = ["image/png", "image/jpeg", "image/webp"];
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Path prefixes: an assignment file lives under its course, a submission under its assignment and student. */
export const homeworkPrefix = (courseId: string) => `homework/${courseId}/`;
export const submissionPrefix = (assignmentId: string, studentId: string) => `submissions/${assignmentId}/${studentId}/`;
export const lessonPagesPrefix = (courseId: string) => `lesson-pages/${courseId}/`;
export const questionMediaPrefix = (courseId: string) => `question-media/${courseId}/`;
export const coverPrefix = (courseId: string) => `covers/${courseId}/`;
export const avatarPrefix = (userId: string) => `avatars/${userId}/`;

/**
 * A path list that came from the browser, cut down to objects the record may reference: under this course's prefix, or
 * already stored on the record (a copied unit keeps the source course's pages).
 */
export const ownPaths = (paths: string[], prefix: string, existing: string[] = []) =>
  paths.filter((p) => !p.includes("..") && (p.startsWith(prefix) || existing.includes(p)));

/** The browser's filename is only a label. Strip anything that could break a header or escape the store. */
export function safeDownloadName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  const cleaned = base.replace(/[\u0000-\u001f"\\]/g, "").trim();
  return (cleaned || "file").slice(0, 200);
}

/** Types a browser may show in place. Never HTML or SVG: those run script. */
export const INLINE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];

/** RFC 6266: an ASCII fallback plus the real UTF-8 name, so Arabic filenames survive. */
export function contentDisposition(name: string, inline = false): string {
  const safe = safeDownloadName(name);
  const ascii = safe.replace(/[^\x20-\x7e]/g, "_");
  return `${inline ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(safe)}`;
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

/** Streams a private image through a same-origin URL, so it is cacheable and needs no public store. */
export async function streamBlob(pathname: string, contentType: string | null, cacheControl: string) {
  const blob = await get(pathname, { access: "private" });
  if (!blob || blob.statusCode !== 200) return new Response(null, { status: 404 });
  return new Response(blob.stream, {
    headers: {
      "Content-Type": contentType ?? "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": cacheControl,
    },
  });
}

/** Issued invoices and statements. Private, overwritten only by the same document id. */
export const documentPrefix = (id: string) => `documents/${id}.pdf`;

/** Stores a generated document. No token means local development: the route serves the bytes directly. */
export async function putDocument(pathname: string, bytes: Uint8Array): Promise<boolean> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return false;
  await put(pathname, Buffer.from(bytes), { access: "private", addRandomSuffix: false, allowOverwrite: true });
  return true;
}
