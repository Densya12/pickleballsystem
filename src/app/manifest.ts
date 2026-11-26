import type { MetadataRoute } from "next";
import { APP_NAME, BRAND_INK } from "@/lib/brand";
import { en } from "@/lib/i18n/dictionary";

/**
 * PWA manifest (D21). Icons come from the Pilaball mark (src/app/icon.svg),
 * rendered by scripts/generate-icons.mjs; the maskable one has safe padding.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    description: en.common.appDescription,
    start_url: "/",
    display: "standalone",
    theme_color: BRAND_INK,
    background_color: BRAND_INK,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
