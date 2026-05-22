"use client";

import { useRouter } from "next/navigation";
import { format, differenceInMinutes } from "date-fns";
import type { Flight } from "@/lib/types";
import { useFlightStore } from "@/stores/useFlightStore";
import { formatPrice } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

function duration(from: string, to: string) {
  const mins = differenceInMinutes(new Date(to), new Date(from));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

export function FlightCard({ flight }: { flight: Flight }) {
  const router = useRouter();
  const setSelectedFlight = useFlightStore((s) => s.setSelectedFlight);

  const select = () => {
    setSelectedFlight(flight);
    router.push(`/booking/${flight.id}`);
  };

  return (
    <div className="rounded-2xl bg-surface p-4 shadow-sm transition hover:shadow-md sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base font-semibold sm:text-lg">{flight.flight_no}</span>
            <Badge>{flight.aircraft_type ?? "Aircraft"}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted">
            {format(new Date(flight.departs_at), "MMM d, HH:mm")} →{" "}
            {format(new Date(flight.arrives_at), "MMM d, HH:mm")} ·{" "}
            {duration(flight.departs_at, flight.arrives_at)}
          </p>
          <p className="mt-1 text-xs text-muted">
            {flight.origin} → {flight.destination}
          </p>
        </div>
        <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end sm:text-right">
          <div>
            <p className="text-lg font-bold text-foreground sm:text-xl">
              {formatPrice(flight.base_price)}
            </p>
            <p className="text-xs text-muted">from · economy</p>
          </div>
          <Button onClick={select} className="sm:mt-2">
            Select
          </Button>
        </div>
      </div>
    </div>
  );
}
