import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";

/**
 * Cached lookup of the origin/destination airport lists shown on the
 * homepage. Uses a cookie-less Supabase client so the result can be cached
 * across requests (the cookie-bound server client is not cacheable, since
 * `cookies()` may not be read inside `unstable_cache`).
 */
export const getAirports = unstable_cache(
  async () => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } },
    );

    const { data } = await supabase.from("flights").select("origin, destination");
    const origins = [...new Set((data ?? []).map((f) => f.origin))].sort();
    const destinations = [
      ...new Set((data ?? []).map((f) => f.destination)),
    ].sort();
    return { origins, destinations };
  },
  ["airports-v1"],
  { revalidate: 3600, tags: ["airports"] },
);
