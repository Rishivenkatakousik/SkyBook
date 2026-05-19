import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Authoritative, request-scoped auth check. `cache` dedupes the call within a
 * single render so multiple Server Components can each call getUser() cheaply.
 */
export const getUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/** Use inside protected Server Components — redirects to /login if signed out. */
export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}
