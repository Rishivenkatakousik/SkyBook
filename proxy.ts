import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

const PROTECTED = ["/bookings", "/booking", "/confirmation"];
const AUTH_ONLY = ["/login", "/signup"];

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  // Optimistic gate only — real authorization is enforced in Server
  // Components via lib/dal.ts getUser().
  if (!user && PROTECTED.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  if (user && AUTH_ONLY.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Run on everything except static assets, PWA files and API routes so the
  // service worker / manifest are never gated behind auth.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|offline|icons|api).*)",
  ],
};
