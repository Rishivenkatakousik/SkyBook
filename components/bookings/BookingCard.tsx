"use client";

import { useState, useTransition } from "react";
import { format, differenceInMinutes } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/Badge";
import { ConfirmDialog } from "./ConfirmDialog";
import { RescheduleDialog } from "./RescheduleDialog";
import { cancelBookingAction } from "@/app/bookings/actions";
import { formatPrice } from "@/lib/utils";
import type { BookingWithRelations } from "@/lib/types";

export function BookingCard({ booking }: { booking: BookingWithRelations }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [resOpen, setResOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const flight = booking.flight;
  const minsToDep = flight
    ? differenceInMinutes(new Date(flight.departs_at), new Date())
    : Infinity;

  const isCancelled = booking.status === "cancelled";
  const tooLateToCancel = minsToDep < 120;
  const tooLateToReschedule = minsToDep < 120;

  const doCancel = () => {
    startTransition(async () => {
      const res = await cancelBookingAction({ bookingId: booking.id });
      if (res.ok) {
        toast.success("Booking cancelled.");
        setConfirmOpen(false);
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <article className="rounded-2xl bg-surface p-4 shadow-sm sm:p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold sm:text-base">
              {flight ? `${flight.flight_no} · ${flight.origin} → ${flight.destination}` : "Booking"}
            </h3>
            <StatusBadge status={booking.status} />
          </div>
          {flight && (
            <p className="mt-1 text-sm text-muted">
              {format(new Date(flight.departs_at), "EEE, MMM d · HH:mm")}
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs uppercase tracking-wide text-muted">PNR</p>
          <p className="font-mono text-sm font-bold tracking-widest text-brand-600 sm:text-base">
            {booking.pnr_code}
          </p>
        </div>
      </header>

      <dl className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <Detail label="Seat" value={booking.seat?.seat_number ?? "—"} />
        <Detail
          label="Passengers"
          value={String(booking.passengers?.length ?? 0)}
        />
        <Detail label="Total" value={formatPrice(booking.total_price)} />
        <Detail
          label="Reschedules"
          value={String(booking.reschedules?.length ?? 0)}
        />
      </dl>

      {!isCancelled && (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setResOpen(true)}
            disabled={tooLateToReschedule}
            title={
              tooLateToReschedule
                ? "Reschedule unavailable within 2 hours of departure"
                : undefined
            }
          >
            Reschedule
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => setConfirmOpen(true)}
            disabled={tooLateToCancel}
            title={
              tooLateToCancel
                ? "Cancellations blocked within 2 hours of departure"
                : undefined
            }
          >
            Cancel booking
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={doCancel}
        title="Cancel booking?"
        message={`This will free seat ${
          booking.seat?.seat_number ?? "(none)"
        } and mark PNR ${booking.pnr_code} as cancelled. This cannot be undone.`}
        confirmLabel="Yes, cancel"
        destructive
        pending={pending}
      />

      {resOpen && flight && (
        <RescheduleDialog
          onClose={() => setResOpen(false)}
          bookingId={booking.id}
          currentFlightId={flight.id}
          currentBasePrice={Number(flight.base_price)}
        />
      )}
    </article>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  );
}
