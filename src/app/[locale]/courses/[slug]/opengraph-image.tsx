import { ImageResponse } from "next/og";
import { LINES, markSvg, svgUri } from "@/app/brand-svg";
import { db } from "@/lib/db";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "A+ Academy course";

export default async function CourseImage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { slug } = await params;
  const course = await db.course.findUnique({ where: { slug, published: true }, select: { titleEn: true } });
  // Satori's default font has no Arabic shaping, so the share image uses the English title.
  const title = course?.titleEn ?? "A+ Academy";

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#FFFFFF", color: "#111418" }}>
        <div style={{ display: "flex", flex: 1, flexDirection: "column", justifyContent: "center", gap: 30, padding: "0 96px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={svgUri(markSvg())} width={112} height={84} alt="" />
            <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: -1 }}>A+ Academy</div>
          </div>
          <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.15, maxWidth: 1000 }}>{title}</div>
          <div style={{ fontSize: 30, color: "#4D535C" }}>Unit 1 is free.</div>
        </div>
        <div style={{ display: "flex", height: 14, background: "#111418" }} />
        <div style={{ display: "flex", height: 34 }}>
          {LINES.map((c) => <div key={c} style={{ flex: 1, background: c }} />)}
        </div>
      </div>
    ),
    size,
  );
}
