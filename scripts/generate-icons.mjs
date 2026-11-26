// Generates the PNG app icons from the Pilaball mark (src/app/icon.svg). Run once
// after changing the mark, then commit the PNGs:
//   node scripts/generate-icons.mjs
// Uses Playwright's Chromium (already a dev dependency) to rasterize the SVG.
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const svg = readFileSync(new URL("../src/app/icon.svg", import.meta.url), "utf8");
// The glyph (stem + ball) without the tile, so it can sit on a full-bleed square.
const glyph = svg
  .replace(/<\?xml[^>]*>/, "")
  .replace(/^[\s\S]*?<rect width="96" height="96" rx="22" fill="#111412"\/>/, "")
  .replace(/<\/svg>\s*$/, "");

/** A full-bleed ink square (no rounded corners: the OS masks it), glyph scaled around the centre. */
const fullBleed = (scale) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" fill="#111412"/>` +
  `<g transform="translate(48 48) scale(${scale}) translate(-48 -48)">${glyph}</g></svg>`;

const outputs = [
  // "any" icons: the rounded tile on transparent corners, like the favicon.
  { file: "public/icons/icon-192.png", size: 192, svg },
  { file: "public/icons/icon-512.png", size: 512, svg },
  // Maskable: the safe zone is a circle of 40% radius; the glyph at 80% stays well inside it.
  { file: "public/icons/icon-512-maskable.png", size: 512, svg: fullBleed(0.8) },
  // iOS rounds the corners itself and shows transparency as black: full bleed.
  { file: "src/app/apple-icon.png", size: 180, svg: fullBleed(0.92) },
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const { file, size, svg: source } of outputs) {
  const sized = source.replace(/<svg([^>]*?)(?: width="\d+" height="\d+")?>/, `<svg$1 width="${size}" height="${size}">`);
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${sized}</body></html>`);
  await page.locator("svg").first().screenshot({ path: file, omitBackground: true });
  console.log(`wrote ${file} (${size}×${size})`);
}
await browser.close();
