// Generate PWA icons (192/512/maskable) from inline SVG using sharp.
// Run: `node scripts/generate-icons.mjs` whenever you change the brand.
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

await mkdir("public/icons", { recursive: true });

// Full-bleed icon: airplane glyph nearly edge-to-edge.
const standard = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#2563eb"/>
  <text x="256" y="356" font-family="Apple Color Emoji,Segoe UI Emoji,sans-serif"
        font-size="320" text-anchor="middle" fill="white">✈</text>
</svg>`;

// Maskable: keep the glyph inside the 80% safe zone (centre).
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#2563eb"/>
  <text x="256" y="320" font-family="Apple Color Emoji,Segoe UI Emoji,sans-serif"
        font-size="220" text-anchor="middle" fill="white">✈</text>
</svg>`;

await sharp(Buffer.from(standard)).resize(192, 192).png().toFile("public/icons/icon-192.png");
await sharp(Buffer.from(standard)).resize(512, 512).png().toFile("public/icons/icon-512.png");
await sharp(Buffer.from(maskable)).resize(512, 512).png().toFile("public/icons/maskable-512.png");

console.log("✓ Generated public/icons/{icon-192,icon-512,maskable-512}.png");
