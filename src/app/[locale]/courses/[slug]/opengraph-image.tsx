import { ImageResponse } from "next/og";
import { GOLD, NIGHT, SNOW, contourBandSvg, markSvg, svgUri } from "@/app/brand-svg";
import { db } from "@/lib/db";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Dhirwa course";

export default async function CourseImage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { slug } = await params;
  const course = await db.course.findUnique({ where: { slug, published: true }, select: { titleEn: true } });
  // Satori's default font has no Arabic shaping, so the share image uses the English title.
  const title = course?.titleEn ?? "Dhirwa";

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: NIGHT, color: SNOW }}>
        <div style={{ display: "flex", flex: 1, flexDirection: "column", justifyContent: "center", gap: 30, padding: "0 96px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={svgUri(markSvg(SNOW))} width={96} height={72} alt="" />
            <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: 2 }}>Dhirwa</div>
          </div>
          <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.15, maxWidth: 1000 }}>{title}</div>
          <div style={{ display: "flex", width: 240, height: 7, borderRadius: 4, background: GOLD }} />
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={svgUri(contourBandSvg(1200, 110))} width={1200} height={110} alt="" />
      </div>
    ),
    size,
  );
}
