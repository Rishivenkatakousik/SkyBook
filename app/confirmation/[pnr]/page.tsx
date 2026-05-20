import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/dal";
import { ResetBookingOnMount } from "@/components/booking/ResetBookingOnMount";
import { formatPrice } from "@/lib/utils";
import type { Flight, Seat, Passenger } from "@/lib/types";

type Row = {
  pnr_code: string;
  total_price: number;
  status: string;
  flight: Flight | null;
  seat: Seat | null;
  passengers: Passenger[];
};

export default async function ConfirmationPage({
  params,
}: {
  params: Promise<{ pnr: string }>;
}) {
  await requireUser();
  const { pnr } = await params;

  const supabase = await createClient();
  // RLS scopes this to the owning user automatically.
  const { data } = await supabase
    .from("bookings")
    .select(
      "pnr_code,total_price,status,flight:flights(*),seat:seats(*),passengers(*)",
    )
    .eq("pnr_code", pnr)
    .single();

  if (!data) notFound();
  const booking = data as unknown as Row;

  return (
    <div className="mx-auto w-full max-w-xl flex-1 px-4 py-12">
      <ResetBookingOnMount />
      <div className="rounded-2xl bg-surface p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/10 text-3xl">
          ✓
        </div>
        <h1 className="mt-4 text-2xl font-bold">Booking confirmed</h1>
        <p className="mt-1 text-sm text-muted">
          Your reservation is secured.
        </p>

        <div className="mt-6 rounded-xl border border-border bg-background p-4">
          <p className="text-xs uppercase tracking-wide text-muted">
            Booking reference (PNR)
          </p>
          <p className="font-mono text-2xl font-bold tracking-widest text-brand-600">
            {booking.pnr_code}
          </p>
        </div>

        {booking.flight && (
          <div className="mt-6 space-y-1 text-left text-sm">
            <Row label="Flight" value={booking.flight.flight_no} />
            <Row
              label="Route"
              value={`${booking.flight.origin} → ${booking.flight.destination}`}
            />
            <Row
              label="Departs"
              value={format(
                new Date(booking.flight.departs_at),
                "EEE, MMM d · HH:mm",
              )}
            />
            <Row label="Seat" value={booking.seat?.seat_number ?? "—"} />
            <Row
              label="Passengers"
              value={booking.passengers.map((p) => p.full_name).join(", ")}
            />
            <Row label="Total paid" value={formatPrice(booking.total_price)} />
          </div>
        )}

        <div className="mt-8 flex gap-3">
          <Link
            href="/bookings"
            className="flex-1 rounded-lg bg-brand-600 px-4 py-3 text-sm font-medium text-white"
          >
            View my bookings
          </Link>
          <Link
            href="/"
            className="flex-1 rounded-lg border border-border px-4 py-3 text-sm font-medium"
          >
            Book another
          </Link>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-border py-2 last:border-0">
      <span className="text-muted">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}
