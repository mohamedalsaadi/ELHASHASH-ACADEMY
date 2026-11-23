import { ImageResponse } from "next/og";
import { NIGHT, SNOW, markSvg, svgUri } from "@/app/brand-svg";
import { db } from "@/lib/db";
import { courseZone } from "@/lib/format";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Dhirwa free live stream";

export default async function PremiereImage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { slug } = await params;
  const p = await db.premiere.findUnique({
    where: { slug },
    select: { titleEn: true, startsAt: true, cancelledAt: true, course: { select: { published: true, grade: { select: { country: { select: { timeZone: true } } } } } } },
  });
  const live = p && !p.cancelledAt && p.course.published ? p : null;
  // Satori's default font has no Arabic shaping, so the share image uses English.
  const title = live?.titleEn ?? "Dhirwa";
  const when = live
    ? new Intl.DateTimeFormat("en-GB", { timeZone: courseZone(live.course), weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(live.startsAt)
    : "";

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: NIGHT, color: SNOW }}>
        <div style={{ display: "flex", flex: 1, flexDirection: "column", justifyContent: "center", gap: 28, padding: "0 96px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={svgUri(markSvg(SNOW))} width={96} height={72} alt="" />
            <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: 2 }}>Dhirwa</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, background: "#C8343E", color: "#FFFFFF", padding: "10px 26px", borderRadius: 999, fontSize: 34, fontWeight: 700, letterSpacing: 3 }}>
              <div style={{ width: 16, height: 16, borderRadius: 999, background: "#FFFFFF" }} />
              LIVE
            </div>
            <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", opacity: 0.85 }}>Free live stream</div>
          </div>
          <div style={{ fontSize: 72, fontWeight: 700, lineHeight: 1.15, maxWidth: 1000 }}>{title}</div>
          {when && <div style={{ fontSize: 34, opacity: 0.85 }}>{when}</div>}
        </div>
      </div>
    ),
    size,
  );
}
