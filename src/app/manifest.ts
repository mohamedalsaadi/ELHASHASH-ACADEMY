import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Alsaadi Academy",
    short_name: "Alsaadi",
    description: "Secondary-school lessons, live classes and real scores for students across the GCC and Egypt.",
    start_url: "/ar",
    display: "standalone",
    dir: "rtl",
    lang: "ar",
    background_color: "#F6F7FB",
    theme_color: "#2430D8",
    icons: [
      { src: "/icon.svg", type: "image/svg+xml", sizes: "any" },
      { src: "/apple-icon", type: "image/png", sizes: "180x180" },
    ],
  };
}
