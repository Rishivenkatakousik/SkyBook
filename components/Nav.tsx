import Link from "next/link";
import { Plane } from "lucide-react";
import { getUser } from "@/lib/dal";
import { logout } from "@/app/(auth)/actions";

export async function Nav() {
  const user = await getUser();

  return (
    <header className="sticky top-0 z-40 border-b border-white/20 bg-white/75 backdrop-blur-xl">
      <div className="relative mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-5 lg:px-8">

        {/* Logo */}
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2.5 font-extrabold tracking-tight text-gray-900"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 shadow-md shadow-indigo-500/30">
            <Plane className="h-[15px] w-[15px] -rotate-[35deg] text-white" />
          </span>
          <span className="text-base">
            Sky<span className="text-indigo-600">Book</span>
          </span>
        </Link>

        {/* Center nav — guests only, hidden on mobile */}
        {!user && (
          <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-8 text-sm font-medium text-gray-500 md:flex">
            <Link href="/" className="transition-colors hover:text-gray-900">Home</Link>
            <Link href="/" className="transition-colors hover:text-gray-900">Destinations</Link>
            <Link href="/" className="transition-colors hover:text-gray-900">Offers</Link>
          </nav>
        )}

        {/* Right side */}
        <div className="flex shrink-0 items-center gap-3 sm:gap-4">
          {user ? (
            <>
              <Link
                href="/"
                className="hidden text-sm font-medium text-gray-600 transition-colors hover:text-indigo-600 sm:inline"
              >
                Search
              </Link>
              <Link
                href="/bookings"
                className="text-sm font-medium text-gray-700 transition-colors hover:text-indigo-600"
              >
                My Bookings
              </Link>
              <form action={logout}>
                <button
                  type="submit"
                  className="cursor-pointer text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-indigo-500/20 transition-all hover:bg-indigo-700 hover:scale-[1.02] hover:shadow-indigo-500/35 active:scale-[0.98] sm:px-5"
              >
                Sign up
              </Link>
            </>
          )}
        </div>

      </div>
    </header>
  );
}
