"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client — a module singleton so Realtime channels and
 * optimistic reads share one connection.
 */
let client: ReturnType<typeof createBrowserClient> | undefined;

export function getSupabaseBrowserClient() {
  client ??= createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  return client;
}
