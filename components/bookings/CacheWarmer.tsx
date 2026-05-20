"use client";

import { useEffect } from "react";

/**
 * On every visit to /bookings, quietly re-fetch the page with `Accept:
 * text/html` so the service worker's network-first nav handler intercepts and
 * caches a fresh copy of the HTML. Without this, Next's client-side
 * navigation makes only RSC fetches (Accept: text/x-component) which the SW
 * does NOT intercept, so the cache never gets primed and /bookings is not
 * readable offline.
 */
export function CacheWarmer({ path }: { path: string }) {
  useEffect(() => {
    if (!navigator.onLine) return;
    if (!("serviceWorker" in navigator) || !navigator.serviceWorker.controller)
      return;

    // Discard the response — we only care that the SW cached it on the way past.
    fetch(path, {
      headers: { Accept: "text/html" },
      credentials: "include",
      cache: "no-store",
    }).catch(() => {
      /* offline mid-warm — fine, next online visit will retry */
    });
  }, [path]);

  return null;
}
