// Server-only: the API secret never reaches the browser. Docs: https://www.vdocipher.com/docs/server/playbackauth/anno

export type Playback = { otp: string; playbackInfo: string };

/**
 * Asks VdoCipher for a 5-minute playback token with a moving watermark (name · phone · IP),
 * per DESIGN.md: 40% opacity, ink colour, moves every ~10s.
 */
export async function getPlayback(videoId: string, watermark: string): Promise<Playback> {
  const secret = process.env.VDOCIPHER_API_SECRET;
  if (!secret) throw new Error("VDOCIPHER_API_SECRET is not set");
  const res = await fetch(`https://dev.vdocipher.com/api/videos/${encodeURIComponent(videoId)}/otp`, {
    method: "POST",
    headers: { Authorization: `Apisecret ${secret}`, "Content-Type": "application/json", Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
    body: JSON.stringify({
      ttl: 300,
      annotate: JSON.stringify([
        { type: "rtext", text: watermark, alpha: "0.40", color: "0xECE6DA", size: "15", interval: "10000" },
      ]),
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`VdoCipher OTP failed: ${res.status}`);
  return res.json();
}

export type UploadTicket = { videoId: string; uploadLink: string; fields: Record<string, string> };

/** Opens an upload slot on the academy's one VdoCipher account; the browser then sends the file straight to the returned link. */
export async function createUpload(title: string): Promise<UploadTicket> {
  const secret = process.env.VDOCIPHER_API_SECRET;
  if (!secret) throw new Error("VDOCIPHER_API_SECRET is not set");
  const res = await fetch(`https://dev.vdocipher.com/api/videos?title=${encodeURIComponent(title.slice(0, 120))}`, {
    method: "PUT",
    headers: { Authorization: `Apisecret ${secret}`, Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`VdoCipher upload slot failed: ${res.status}`);
  const { clientPayload, videoId } = (await res.json()) as { clientPayload: Record<string, string>; videoId: string };
  const { uploadLink, ...fields } = clientPayload;
  return { videoId, uploadLink, fields };
}

export function playerUrl({ otp, playbackInfo }: Playback) {
  return `https://player.vdocipher.com/v2/?otp=${encodeURIComponent(otp)}&playbackInfo=${encodeURIComponent(playbackInfo)}`;
}
