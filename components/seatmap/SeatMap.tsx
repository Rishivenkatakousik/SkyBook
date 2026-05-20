"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useFlightStore } from "@/stores/useFlightStore";
import type { Seat, SeatClass } from "@/lib/types";
import { formatPrice, cn } from "@/lib/utils";

const CLASS_ORDER: SeatClass[] = ["first", "business", "economy"];
const CLASS_LABEL: Record<SeatClass, string> = {
  first: "First Class",
  business: "Business",
  economy: "Economy",
};

function parseSeat(n: string) {
  const m = n.match(/^(\d+)([A-Z])$/);
  return m ? { row: Number(m[1]), col: m[2] } : { row: 0, col: n };
}

export function SeatMap({
  flightId,
  initialSeats,
  yourSeatIds = [],
}: {
  flightId: string;
  initialSeats: Seat[];
  yourSeatIds?: string[];
}) {
  const [seats, setSeats] = useState<Seat[]>(initialSeats);
  const selectedSeat = useFlightStore((s) => s.selectedSeat);
  const selectSeatOptimistic = useFlightStore((s) => s.selectSeatOptimistic);

  // Subscribe to live seat availability — seats booked by other users update
  // here without a page refresh.
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(`seats-${flightId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "seats",
          filter: `flight_id=eq.${flightId}`,
        },
        (payload: { new: Seat }) => {
          const updated = payload.new;
          setSeats((prev) =>
            prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s)),
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [flightId]);

  const zones = useMemo(() => {
    return CLASS_ORDER.map((cls) => {
      const zoneSeats = seats
        .filter((s) => s.class === cls)
        .sort((a, b) => {
          const pa = parseSeat(a.seat_number);
          const pb = parseSeat(b.seat_number);
          return pa.row - pb.row || pa.col.localeCompare(pb.col);
        });
      const rows = [...new Set(zoneSeats.map((s) => parseSeat(s.seat_number).row))];
      return { cls, zoneSeats, rows };
    }).filter((z) => z.zoneSeats.length > 0);
  }, [seats]);

  return (
    <div className="seat-grid max-h-[60vh] overflow-auto rounded-2xl bg-surface p-4 shadow-sm">
      <div className="mb-4 flex flex-wrap gap-4 text-xs text-muted">
        <Legend className="border border-seat-available-border bg-seat-available" label="Available" />
        <Legend className="bg-seat-selected" label="Selected" />
        <Legend className="bg-seat-occupied" label="Occupied" />
        <Legend className="bg-seat-yours" label="Your seat" />
      </div>

      {zones.map(({ cls, zoneSeats, rows }) => (
        <section key={cls} className="mb-6">
          <h3 className="mb-2 text-sm font-semibold text-foreground">
            {CLASS_LABEL[cls]}
          </h3>
          <div className="flex flex-col gap-1.5">
            {rows.map((row) => (
              <div key={row} className="flex items-center gap-1.5">
                <span className="w-6 text-right text-xs text-muted">{row}</span>
                {zoneSeats
                  .filter((s) => parseSeat(s.seat_number).row === row)
                  .map((seat) => {
                    const isYours = yourSeatIds.includes(seat.id);
                    const isSelected = selectedSeat?.id === seat.id;
                    const occupied = !seat.is_available && !isYours;

                    return (
                      <button
                        key={seat.id}
                        type="button"
                        disabled={occupied}
                        onClick={() => !occupied && selectSeatOptimistic(seat)}
                        title={
                          occupied
                            ? `${CLASS_LABEL[seat.class]} · occupied`
                            : `${seat.seat_number} · ${CLASS_LABEL[seat.class]}${
                                seat.extra_fee > 0
                                  ? ` · +${formatPrice(seat.extra_fee)}`
                                  : ""
                              }`
                        }
                        aria-label={`Seat ${seat.seat_number}`}
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border text-[10px] font-medium transition",
                          isYours &&
                            "border-seat-yours bg-seat-yours text-white",
                          !isYours &&
                            isSelected &&
                            "border-seat-selected bg-seat-selected text-white",
                          !isYours &&
                            !isSelected &&
                            occupied &&
                            "cursor-not-allowed border-seat-occupied bg-seat-occupied text-muted",
                          !isYours &&
                            !isSelected &&
                            !occupied &&
                            "border-seat-available-border bg-seat-available text-foreground hover:border-seat-selected",
                        )}
                      >
                        {seat.seat_number.replace(/^\d+/, "")}
                      </button>
                    );
                  })}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("h-4 w-4 rounded", className)} />
      {label}
    </span>
  );
}
