import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Open Play Queue",
    short_name: "Open Play",
    description: "Pila, rotation at bayad para sa pickleball open play.",
    start_url: "/",
    display: "standalone",
    theme_color: "#111412",
    background_color: "#F6F6F3",
    // Placeholder icons (lime ball on ink). Replace with final artwork later.
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
