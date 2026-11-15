import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ApnaHaath — Dawai unke haath se",
    short_name: "ApnaHaath",
    description:
      "A shared medicine log for an elder, her caretaker and her family. Only the elder marks a dose as taken; AI can warn but never change a prescription.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f6f3",
    theme_color: "#0f5c4c",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
