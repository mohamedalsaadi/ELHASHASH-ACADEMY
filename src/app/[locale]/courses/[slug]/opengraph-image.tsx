import { ImageResponse } from "next/og";
import { monogramSvg, svgUri } from "@/app/brand-svg";
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
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", gap: 30, background: "#0B0F4A", color: "#F6F7FB", padding: "0 96px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={svgUri(monogramSvg("#F6F7FB"))} width={132} height={82} alt="" />
          <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: -1 }}>A+ Academy</div>
        </div>
        <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.15, maxWidth: 960 }}>{title}</div>
        <div style={{ fontSize: 30, color: "#F2B544" }}>Every page counts.</div>
      </div>
    ),
    size,
  );
}
