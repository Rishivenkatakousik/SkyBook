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
    <div className="rounded-2xl bg-surface p-5 shadow-sm transition hover:shadow-md">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold">{flight.flight_no}</span>
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
        <div className="text-right">
          <p className="text-xl font-bold text-foreground">
            {formatPrice(flight.base_price)}
          </p>
          <p className="text-xs text-muted">from · economy</p>
          <Button onClick={select} className="mt-2">
            Select
          </Button>
        </div>
      </div>
    </div>
  );
}
