import { notFound } from "next/navigation";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/dal";
import { BookingStepper } from "@/components/booking/BookingStepper";
import { BookingClient } from "@/components/booking/BookingClient";
import type { Flight, Seat } from "@/lib/types";

export default async function BookingPage({
  params,
}: {
  params: Promise<{ flightId: string }>;
}) {
  await requireUser();
  const { flightId } = await params;

  const supabase = await createClient();
  const [{ data: flight }, { data: seats }, { data: myBookings }] =
    await Promise.all([
      supabase.from("flights").select("*").eq("id", flightId).single(),
      supabase
        .from("seats")
        .select("*")
        .eq("flight_id", flightId)
        .order("seat_number"),
      // RLS scopes this to the current user — used to light up their seats.
      supabase
        .from("bookings")
        .select("seat_id")
        .eq("flight_id", flightId)
        .neq("status", "cancelled"),
    ]);

  if (!flight) notFound();
  const f = flight as Flight;
  const yourSeatIds = (myBookings ?? [])
    .map((b) => b.seat_id as string | null)
    .filter((id): id is string => !!id);

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">
            {f.flight_no} · {f.origin} → {f.destination}
          </h1>
          <p className="text-sm text-muted">
            {format(new Date(f.departs_at), "EEE, MMM d · HH:mm")}
          </p>
        </div>
        <BookingStepper />
      </div>

      <BookingClient
        flight={f}
        seats={(seats ?? []) as Seat[]}
        yourSeatIds={yourSeatIds}
      />
    </div>
  );
}
