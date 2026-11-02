import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ذروة · Dhirwa",
    short_name: "ذروة",
    description: "Dhirwa (ذروة): secondary-school lessons, live classes and real scores for students across the GCC and Egypt.",
    id: "/",
    start_url: "/ar",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    dir: "rtl",
    lang: "ar",
    background_color: "#F6F3EC",
    theme_color: "#0F1B2D",
    icons: [
      { src: "/pwa-icon-192.png", type: "image/png", sizes: "192x192" },
      { src: "/pwa-icon-512.png", type: "image/png", sizes: "512x512" },
      { src: "/pwa-icon-maskable.png", type: "image/png", sizes: "512x512", purpose: "maskable" },
      { src: "/icon.svg", type: "image/svg+xml", sizes: "any" },
      { src: "/apple-icon", type: "image/png", sizes: "180x180" },
    ],
  };
}
