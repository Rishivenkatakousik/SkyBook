import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  // Only emit the SW for production builds; dev stays on Turbopack with no SW.
  disable: process.env.NODE_ENV === "development",
  register: true,
  // If a navigation has no cached HTML, fall back to /offline.
  fallbacks: { document: "/offline" },
  workboxOptions: {
    // Take control immediately on activation so the new SW serves the next nav.
    skipWaiting: true,
    clientsClaim: true,
    runtimeCaching: [
      // StaleWhileRevalidate for flight search (PRD requirement).
      {
        urlPattern: /\/search\/.*/i,
        handler: "StaleWhileRevalidate",
        options: { cacheName: "search-pages" },
      },
      {
        urlPattern: /\/api\/flights.*/i,
        handler: "StaleWhileRevalidate",
        options: { cacheName: "search-api" },
      },
      // CacheFirst for static assets (PRD requirement).
      {
        urlPattern: /\/_next\/static\/.*/i,
        handler: "CacheFirst",
        options: { cacheName: "next-static" },
      },
      {
        urlPattern: /\/icons\/.*/i,
        handler: "CacheFirst",
        options: { cacheName: "icons" },
      },
      {
        urlPattern: /\.(?:png|jpg|jpeg|svg|webp|ico|woff2?)$/i,
        handler: "CacheFirst",
        options: { cacheName: "assets" },
      },
      // /bookings — NetworkFirst keeps it current online, last-good when offline.
      {
        urlPattern: /\/bookings(\?.*)?$/i,
        handler: "NetworkFirst",
        options: { cacheName: "bookings", networkTimeoutSeconds: 3 },
      },
    ],
    // Precache the offline page (and a placeholder for /bookings so a fresh
    // install can serve a sensible response before NetworkFirst has populated
    // it). `revision: null` is safe here — runtime caching keeps them fresh.
    additionalManifestEntries: [
      { url: "/offline", revision: null },
      { url: "/bookings", revision: null },
    ],
  },
});

const nextConfig: NextConfig = {
  turbopack: {},
  async headers() {
    return [
      {
        // sw.js (workbox-generated) must always be fresh so updates roll out.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
      {
        source: "/manifest.json",
        headers: [{ key: "Cache-Control", value: "public, max-age=3600" }],
      },
    ];
  },
};

export default withPWA(nextConfig);
