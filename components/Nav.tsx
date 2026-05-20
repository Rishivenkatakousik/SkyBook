import Link from "next/link";
import { getUser } from "@/lib/dal";
import { logout } from "@/app/(auth)/actions";

export async function Nav() {
  const user = await getUser();

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
        <Link href="/" className="font-bold tracking-tight text-brand-600">
          ✈ SkyBook
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          {user ? (
            <>
              <Link href="/" className="text-muted hover:text-foreground">
                Search
              </Link>
              <Link
                href="/bookings"
                className="text-muted hover:text-foreground"
              >
                My Bookings
              </Link>
              <form action={logout}>
                <button
                  type="submit"
                  className="font-medium text-foreground hover:text-brand-600"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="text-muted hover:text-foreground">
                Sign in
              </Link>
              <Link
                href="/signup"
                className="rounded-lg bg-brand-600 px-3 py-1.5 font-medium text-white"
              >
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
