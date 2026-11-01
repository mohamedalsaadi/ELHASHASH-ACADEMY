"use client";

import { CONTACT_EMAIL } from "@/lib/site";

/** Replaces the root layout when it fails; no provider is available, so the copy is bilingual. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <head>
        <title>Error · A+ Academy</title>
        <meta name="robots" content="noindex" />
      </head>
      <body style={{ margin: 0, background: "#F6F7FB", color: "#0D1030", fontFamily: "Tahoma, Arial, sans-serif" }}>
        <main style={{ maxWidth: 520, margin: "0 auto", padding: "96px 24px", textAlign: "center" }}>
          <h1 style={{ fontSize: 28, margin: "0 0 12px" }}>Something went wrong</h1>
          <p style={{ color: "#545A7A", lineHeight: 1.7 }}>حدث خطأ في تحميل الصفحة. حاول مرة أخرى أو تواصل مع الدعم.</p>
          <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 24, flexWrap: "wrap" }}>
            <button onClick={reset} style={{ background: "#1F6FD1", color: "#fff", border: 0, borderRadius: 2, padding: "12px 18px", fontSize: 15, cursor: "pointer" }}>
              Try again / إعادة المحاولة
            </button>
            <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: "#1F6FD1", padding: "12px 6px" }}>
              Contact / تواصل
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
