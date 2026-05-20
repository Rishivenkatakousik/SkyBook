"use client";

import { useFlightStore, type BookingStep } from "@/stores/useFlightStore";
import { cn } from "@/lib/utils";

const STEPS: { key: BookingStep; label: string }[] = [
  { key: "select-flight", label: "Flight" },
  { key: "select-seat", label: "Seat" },
  { key: "passenger", label: "Passengers" },
  { key: "confirm", label: "Confirm" },
];

export function BookingStepper() {
  const step = useFlightStore((s) => s.bookingStep);
  const activeIdx = Math.max(
    0,
    STEPS.findIndex((s) => s.key === step),
  );

  return (
    <ol className="flex items-center gap-2 text-sm">
      {STEPS.map((s, i) => (
        <li key={s.key} className="flex items-center gap-2">
          <span
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold",
              i <= activeIdx
                ? "bg-brand-600 text-white"
                : "bg-background text-muted",
            )}
          >
            {i + 1}
          </span>
          <span
            className={cn(
              i <= activeIdx ? "text-foreground" : "text-muted",
              "hidden sm:inline",
            )}
          >
            {s.label}
          </span>
          {i < STEPS.length - 1 && (
            <span className="mx-1 h-px w-6 bg-border" />
          )}
        </li>
      ))}
    </ol>
  );
}
