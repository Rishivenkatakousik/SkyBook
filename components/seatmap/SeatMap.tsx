"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
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
const COLS = ["A", "B", "C", "D", "E", "F"];

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

  // Live seat availability — seats booked by other users update here without
  // a page refresh.
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

  const zones = useMemo(
    () =>
      CLASS_ORDER.map((cls) => {
        const byRow = new Map<number, Map<string, Seat>>();
        for (const s of seats) {
          if (s.class !== cls) continue;
          const { row, col } = parseSeat(s.seat_number);
          if (!byRow.has(row)) byRow.set(row, new Map());
          byRow.get(row)!.set(col, s);
        }
        const rows = [...byRow.keys()].sort((a, b) => a - b);
        return { cls, byRow, rows };
      }).filter((z) => z.rows.length > 0),
    [seats],
  );

  const availableCount = seats.filter((s) => s.is_available).length;

  return (
    <div className="flex flex-col rounded-2xl bg-surface shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
        <div>
          <h3 className="text-sm font-semibold">Choose your seat</h3>
          <p className="text-xs text-muted">
            {availableCount} of {seats.length} seats available · live updates
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-muted">
          <Legend swatch="border border-seat-available-border bg-seat-available" label="Available" />
          <Legend swatch="bg-seat-selected" label="Selected" />
          <Legend swatch="bg-seat-occupied" label="Occupied" />
          <Legend swatch="bg-seat-yours" label="Your seat" />
        </div>
      </header>

      <div className="seat-grid max-h-[60vh] overflow-auto p-3 sm:p-4">
        <div className="min-w-max">
          {/* Nose-of-plane indicator */}
          <div className="mx-auto mb-3 h-4 w-20 rounded-t-full border-t border-l border-r border-border" />

          {/* Column header (aisle gap between C and D) */}
          <div className="mb-2 ml-8 flex items-center gap-1.5 text-[10px] text-muted">
            {COLS.map((c) => (
              <Fragment key={c}>
                {c === "D" && <span className="w-3" aria-hidden="true" />}
                <span className="w-9 text-center sm:w-10">{c}</span>
              </Fragment>
            ))}
          </div>

          {zones.map(({ cls, byRow, rows }, zi) => (
            <section key={cls} className={cn(zi > 0 && "mt-5 border-t border-dashed border-border pt-3")}>
              <h4 className="mb-2 ml-8 text-xs font-semibold uppercase tracking-wide text-muted">
                {CLASS_LABEL[cls]}
              </h4>
              <div className="flex flex-col gap-1.5">
                {rows.map((row) => {
                  const rowSeats = byRow.get(row)!;
                  return (
                    <div key={row} className="flex items-center gap-1.5">
                      <span className="w-6 text-right text-[11px] text-muted">
                        {row}
                      </span>
                      {COLS.map((c) => {
                        const seat = rowSeats.get(c);
                        return (
                          <Fragment key={c}>
                            {c === "D" && <span className="w-3" aria-hidden="true" />}
                            {seat ? (
                              <SeatButton
                                seat={seat}
                                isYours={yourSeatIds.includes(seat.id)}
                                isSelected={selectedSeat?.id === seat.id}
                                onSelect={() => selectSeatOptimistic(seat)}
                              />
                            ) : (
                              <span className="h-9 w-9 shrink-0 sm:h-10 sm:w-10" aria-hidden="true" />
                            )}
                          </Fragment>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>

      {selectedSeat && (
        <footer className="flex items-center justify-between border-t border-border bg-background px-4 py-3 text-sm">
          <div>
            <p className="font-semibold text-foreground">
              Seat {selectedSeat.seat_number}
            </p>
            <p className="text-xs text-muted">
              {CLASS_LABEL[selectedSeat.class]}
              {selectedSeat.extra_fee > 0 &&
                ` · +${formatPrice(selectedSeat.extra_fee)}`}
            </p>
          </div>
          <span className="text-xs text-success">Selected</span>
        </footer>
      )}
    </div>
  );
}

function SeatButton({
  seat,
  isYours,
  isSelected,
  onSelect,
}: {
  seat: Seat;
  isYours: boolean;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const occupied = !seat.is_available && !isYours;
  const tooltip = occupied
    ? `${CLASS_LABEL[seat.class]} · occupied${
        seat.extra_fee > 0 ? ` · +${formatPrice(seat.extra_fee)}` : ""
      }`
    : `${seat.seat_number} · ${CLASS_LABEL[seat.class]}${
        seat.extra_fee > 0 ? ` · +${formatPrice(seat.extra_fee)}` : ""
      }`;

  return (
    <button
      type="button"
      disabled={occupied}
      onClick={() => !occupied && onSelect()}
      title={tooltip}
      aria-label={`Seat ${seat.seat_number}, ${tooltip}`}
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border text-[10px] font-medium transition sm:h-10 sm:w-10",
        isYours && "border-seat-yours bg-seat-yours text-white",
        !isYours && isSelected && "border-seat-selected bg-seat-selected text-white",
        !isYours && !isSelected && occupied && "cursor-not-allowed border-seat-occupied bg-seat-occupied text-muted",
        !isYours && !isSelected && !occupied && "border-seat-available-border bg-seat-available text-foreground hover:border-seat-selected hover:bg-brand-50",
      )}
    >
      {seat.seat_number.replace(/^\d+/, "")}
    </button>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("h-3.5 w-3.5 rounded", swatch)} />
      {label}
    </span>
  );
}
