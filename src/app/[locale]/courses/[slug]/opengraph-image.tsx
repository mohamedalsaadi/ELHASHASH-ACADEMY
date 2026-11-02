import { ImageResponse } from "next/og";
import { CHALKS, CHALK_WHITE, PAPER, SLATE, WOOD, markSvg, svgUri } from "@/app/brand-svg";
import { db } from "@/lib/db";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Sabboura course";

export default async function CourseImage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { slug } = await params;
  const course = await db.course.findUnique({ where: { slug, published: true }, select: { titleEn: true } });
  // Satori's default font has no Arabic shaping, so the share image uses the English title.
  const title = course?.titleEn ?? "Sabboura";

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: SLATE, color: CHALK_WHITE }}>
        <div style={{ display: "flex", flex: 1, flexDirection: "column", justifyContent: "center", gap: 30, padding: "0 96px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            {/* The board sits on a paper tile, as on the app icon, so it reads on the slate. */}
            <div style={{ display: "flex", padding: 12, borderRadius: 20, background: PAPER }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={svgUri(markSvg())} width={112} height={84} alt="" />
            </div>
            <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: -1 }}>Sabboura</div>
          </div>
          <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.15, maxWidth: 1000 }}>{title}</div>
          <div style={{ display: "flex", width: 240, height: 7, borderRadius: 4, background: CHALKS[0] }} />
        </div>
        <div style={{ display: "flex", height: 40, background: WOOD }} />
      </div>
    ),
    size,
  );
}
