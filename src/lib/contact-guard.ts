// Contact masking for text written by students and teachers. Pure: no DB, no React.
// Phone numbers, social/WhatsApp links, emails and @handles are replaced with •••; the academy's own
// channels (site.ts plus OFFICIAL_CONTACTS) are left alone.
import { CONTACT_EMAIL, SUPPORT_PHONE, SUPPORT_WHATSAPP } from "./site";

export type ContactKind = "link" | "email" | "phone" | "handle";
export type ContactScan = { text: string; masked: boolean; kinds: ContactKind[] };

const MASK = "•••";

const toAsciiDigits = (s: string) =>
  s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));

// Priority order: a link or email claims its span before a phone or handle can match inside it.
const PATTERNS: { kind: ContactKind; re: RegExp }[] = [
  {
    kind: "link",
    re: /(?:https?:\/\/)?(?:www\.)?(?:wa\.me|chat\.whatsapp\.com|api\.whatsapp\.com|t\.me|telegram\.me|instagram\.com|instagr\.am|snapchat\.com|tiktok\.com|facebook\.com|fb\.me|x\.com|twitter\.com)\/[^\s<>"']*/gi,
  },
  { kind: "email", re: /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g },
  // Any international number with a country code (+20, 00966…).
  { kind: "phone", re: /(?:\+|00)\s?\d{1,3}(?:[\s\-().]*\d){7,12}/g },
  // Egypt: 01[0125] + 8 digits. Saudi/UAE: 05 + 8 digits.
  { kind: "phone", re: /(?<!\d)0?1[0125](?:[\s\-().]*\d){8}(?!\d)/g },
  { kind: "phone", re: /(?<!\d)0?5(?:[\s\-().]*\d){8}(?!\d)/g },
  { kind: "handle", re: /(?<![\w@.])@[A-Za-z0-9_.]{3,30}/g },
];

// ponytail: 8-digit Gulf locals (Kuwait/Qatar/Bahrain/Oman) are masked only with a country code — bare
// 8-digit runs are too close to ordinary numbers. Add local forms here if the owner sees them slipping through.
function normalizeTarget(raw: string): string {
  const s = raw.trim().toLowerCase();
  if (!s) return "";
  if (s.startsWith("@") || s.includes("@")) return s;
  if (/^[\d+\s\-().]+$/.test(s)) return s.replace(/\D/g, "").replace(/^00/, "");
  return s.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/+$/, "");
}

function allowList(extra?: Iterable<string>): Set<string> {
  const raw = [CONTACT_EMAIL, SUPPORT_PHONE, SUPPORT_WHATSAPP, ...(process.env.OFFICIAL_CONTACTS ?? "").split(","), ...(extra ?? [])];
  return new Set(raw.map((x) => (x ? normalizeTarget(x) : "")).filter(Boolean));
}

/** Masks contact details in `input`; returns the safe text and which kinds were hidden. */
export function maskContacts(input: string, extraAllow?: Iterable<string>): ContactScan {
  if (!input) return { text: input, masked: false, kinds: [] };
  const ascii = toAsciiDigits(input);
  const allow = allowList(extraAllow);
  const claimed: { start: number; end: number }[] = [];
  const hits: { start: number; end: number; kind: ContactKind; keep: boolean }[] = [];

  for (const { kind, re } of PATTERNS) {
    for (const m of ascii.matchAll(re)) {
      const start = m.index ?? 0;
      const end = start + m[0].length;
      if (claimed.some((c) => start < c.end && end > c.start)) continue;
      claimed.push({ start, end });
      hits.push({ start, end, kind, keep: allow.has(normalizeTarget(m[0])) });
    }
  }

  const hidden = hits.filter((h) => !h.keep).sort((a, b) => a.start - b.start);
  if (!hidden.length) return { text: input, masked: false, kinds: [] };

  let text = "";
  let at = 0;
  for (const h of hidden) {
    text += input.slice(at, h.start) + MASK;
    at = h.end;
  }
  text += input.slice(at);

  return { text, masked: true, kinds: [...new Set(hidden.map((h) => h.kind))] };
}
