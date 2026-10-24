"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

// three.js loads only when the intro actually plays, so it never enters any other page's bundle.
const IntroScene = dynamic(() => import("./IntroScene"), { ssr: false });

export function IntroStage() {
  const [play, setPlay] = useState(false);
  useEffect(() => setPlay(document.documentElement.dataset.intro === "play"), []);
  return play ? <IntroScene /> : null;
}
