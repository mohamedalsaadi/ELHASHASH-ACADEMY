"use client";

import { CONTACT_EMAIL } from "@/lib/site";

/**
 * Replaces the root layout when it fails; no provider is available, so the copy is bilingual. No stylesheet loads
 * either, so the colours are written out here (the one place besides email where hex is allowed).
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <title>خطأ · ذروة · Dhirwa</title>
        <meta name="robots" content="noindex" />
      </head>
      <body style={{ margin: 0, background: "#F5F5F7", color: "#1D1D1F", fontFamily: "Tahoma, Arial, sans-serif" }}>
        <main style={{ maxWidth: 520, margin: "0 auto", padding: "96px 24px", textAlign: "center" }}>
          <p aria-hidden="true" style={{ margin: "0 0 16px", fontSize: 22, fontWeight: 700 }}>
            ذروة<span style={{ color: "#E8B04B" }}> •</span>
          </p>
          <h1 style={{ fontSize: 28, margin: "0 0 12px" }}>حدث خطأ</h1>
          <p style={{ color: "#636366", lineHeight: 1.7, margin: 0 }}>تعذّر تحميل الصفحة. حاول مرة أخرى أو تواصل مع الدعم.</p>
          <p lang="en" dir="ltr" style={{ color: "#636366", lineHeight: 1.7, marginTop: 8 }}>
            The page could not load. Try again or contact support.
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 24, flexWrap: "wrap" }}>
            <button
              onClick={reset}
              style={{ background: "#1D1D1F", color: "#FFFFFF", border: 0, borderRadius: 999, padding: "12px 20px", minHeight: 44, fontSize: 15, fontWeight: 600, cursor: "pointer" }}
            >
              إعادة المحاولة / Try again
            </button>
            <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: "#1D1D1F", padding: "12px 6px" }}>
              تواصل / Contact
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
