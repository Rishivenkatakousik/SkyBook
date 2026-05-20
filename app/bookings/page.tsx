import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/dal";
import { BookingCard } from "@/components/bookings/BookingCard";
import { CacheWarmer } from "@/components/bookings/CacheWarmer";
import type { BookingWithRelations } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function BookingsPage() {
  await requireUser();
  const supabase = await createClient();

  // RLS scopes this to the current user automatically.
  const { data } = await supabase
    .from("bookings")
    .select(
      "*, flight:flights(*), seat:seats(*), passengers(*), reschedules(*)",
    )
    .order("booked_at", { ascending: false });

  const bookings = (data ?? []) as unknown as BookingWithRelations[];

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <CacheWarmer path="/bookings" />
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">My bookings</h1>
        <Link
          href="/"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white"
        >
          Book another flight
        </Link>
      </div>

      {bookings.length === 0 ? (
        <div className="rounded-2xl bg-surface p-10 text-center text-muted shadow-sm">
          You haven&apos;t booked any flights yet.
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {bookings.map((b) => (
            <li key={b.id}>
              <BookingCard booking={b} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
