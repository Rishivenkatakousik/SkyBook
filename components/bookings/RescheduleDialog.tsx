"use client";

import { useEffect, useState, useTransition } from "react";
import { format, differenceInMinutes } from "date-fns";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { formatPrice, cn } from "@/lib/utils";
import {
  getAlternativesAction,
  rescheduleBookingAction,
} from "@/app/bookings/actions";
import type { Flight } from "@/lib/types";

function duration(from: string, to: string) {
  const m = differenceInMinutes(new Date(to), new Date(from));
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

/**
 * The parent conditionally mounts this dialog, so picked/alternatives reset
 * naturally on each open — no synchronous setState in effects.
 */
export function RescheduleDialog({
  onClose,
  bookingId,
  currentFlightId,
  currentBasePrice,
}: {
  onClose: () => void;
  bookingId: string;
  currentFlightId: string;
  currentBasePrice: number;
}) {
  // `null` means "still loading"; an array (even empty) means loaded.
  const [alternatives, setAlternatives] = useState<Flight[] | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    getAlternativesAction({ bookingId }).then((res) => {
      if (cancelled) return;
      if (res.ok)
        setAlternatives(res.data!.filter((f) => f.id !== currentFlightId));
      else {
        toast.error(res.error);
        setAlternatives([]);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [bookingId, currentFlightId]);

  const confirm = () => {
    if (!picked) return;
    startTransition(async () => {
      const res = await rescheduleBookingAction({
        bookingId,
        newFlightId: picked,
      });
      if (res.ok) {
        const fee = res.data?.fee ?? 0;
        toast.success(
          fee > 0
            ? `Rescheduled · fare difference ${formatPrice(fee)} added`
            : "Rescheduled — no extra charge",
        );
        onClose();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title="Reschedule flight"
      className="max-w-lg"
    >
      <p className="text-sm text-muted">
        Pick another flight on the same route. Fare difference is added if the
        new flight is more expensive; you keep your booking otherwise.
      </p>

      <div className="mt-4 max-h-80 overflow-y-auto">
        {alternatives === null ? (
          <div className="flex justify-center py-8 text-muted">
            <Spinner />
          </div>
        ) : alternatives.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">
            No other flights available on this route.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {alternatives.map((f) => {
              const diff = Number(f.base_price) - currentBasePrice;
              const isPicked = picked === f.id;
              return (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => setPicked(f.id)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-xl border p-3 text-left text-sm transition",
                      isPicked
                        ? "border-brand-600 bg-brand-50"
                        : "border-border hover:border-brand-600/40",
                    )}
                  >
                    <div>
                      <p className="font-semibold">{f.flight_no}</p>
                      <p className="text-xs text-muted">
                        {format(new Date(f.departs_at), "EEE, MMM d · HH:mm")} ·{" "}
                        {duration(f.departs_at, f.arrives_at)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">
                        {formatPrice(f.base_price)}
                      </p>
                      <p
                        className={cn(
                          "text-xs",
                          diff > 0
                            ? "text-warning"
                            : diff < 0
                              ? "text-success"
                              : "text-muted",
                        )}
                      >
                        {diff > 0
                          ? `+${formatPrice(diff)} fee`
                          : diff < 0
                            ? `${formatPrice(diff)} (no charge)`
                            : "Same price"}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button onClick={confirm} disabled={!picked || pending}>
          {pending && <Spinner className="h-4 w-4" />}
          Confirm reschedule
        </Button>
      </div>
    </Dialog>
  );
}
