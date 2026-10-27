"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

// three.js loads only when the intro actually plays, so it never enters any other page's bundle.
const IntroScene = dynamic(() => import("./IntroScene"), { ssr: false });

export function IntroStage() {
  const [play, setPlay] = useState(false);
  useEffect(() => {
    const state = document.documentElement.dataset.intro;
    // "ready" still mounts the scene: it promotes itself to "play" once it is on screen.
    setPlay(state === "play" || state === "ready");
  }, []);
  return play ? <IntroScene /> : null;
}
