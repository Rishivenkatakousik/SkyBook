"use client";

import { useEffect } from "react";
import { useFlightStore } from "@/stores/useFlightStore";
import { SeatMap } from "@/components/seatmap/SeatMap";
import { PassengerForm } from "@/components/booking/PassengerForm";
import type { Flight, Seat } from "@/lib/types";

export function BookingClient({
  flight,
  seats,
  yourSeatIds,
}: {
  flight: Flight;
  seats: Seat[];
  yourSeatIds?: string[];
}) {
  const selectedFlight = useFlightStore((s) => s.selectedFlight);
  const setSelectedFlight = useFlightStore((s) => s.setSelectedFlight);

  // Keep the store authoritative even on a direct visit / refresh.
  useEffect(() => {
    if (selectedFlight?.id !== flight.id) setSelectedFlight(flight);
  }, [flight, selectedFlight?.id, setSelectedFlight]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <SeatMap
        flightId={flight.id}
        initialSeats={seats}
        yourSeatIds={yourSeatIds}
      />
      <PassengerForm flightId={flight.id} />
    </div>
  );
}
