"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const API = "https://player.vdocipher.com/v2/api.js";

type Player = { video: { addEventListener: (e: string, cb: () => void) => void } };
type Api = { getInstance: (frame: HTMLIFrameElement) => Player };

/** The protected player. When the video reaches its end it calls `onEnded` (a server action), which marks the lesson complete. */
export function VdoFrame({ src, title, onEnded }: { src: string; title: string; onEnded?: () => Promise<void> }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!onEnded) return;
    let dead = false;
    const attach = () => {
      const api = (window as unknown as { VdoPlayer?: Api }).VdoPlayer;
      if (dead || !api || !frame.current) return;
      api.getInstance(frame.current).video.addEventListener("ended", () => {
        void onEnded().then(() => router.refresh());
      });
    };
    if ((window as unknown as { VdoPlayer?: Api }).VdoPlayer) attach();
    else {
      const s = document.createElement("script");
      s.src = API;
      s.async = true;
      s.onload = attach;
      document.head.appendChild(s);
    }
    return () => {
      dead = true;
    };
  }, [onEnded, router]);

  return <iframe ref={frame} src={src} title={title} allow="encrypted-media; fullscreen" allowFullScreen className="size-full" />;
}
