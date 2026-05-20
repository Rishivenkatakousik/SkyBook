"use client";

import { useEffect } from "react";
import { useFlightStore } from "@/stores/useFlightStore";

/** Clears the in-progress booking once the confirmation page is shown. */
export function ResetBookingOnMount() {
  const resetBooking = useFlightStore((s) => s.resetBooking);
  useEffect(() => {
    resetBooking();
  }, [resetBooking]);
  return null;
}
