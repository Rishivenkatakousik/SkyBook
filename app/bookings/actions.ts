"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/dal";
import type { Flight } from "@/lib/types";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

const ERRORS: Record<string, string> = {
  CANCEL_WINDOW_CLOSED:
    "Cancellations are blocked within 2 hours of departure.",
  NOT_FOUND: "Booking not found.",
  ALREADY_CANCELLED: "This booking is already cancelled.",
  NOT_AUTHENTICATED: "Please sign in.",
  ROUTE_MISMATCH: "The new flight must be on the same route.",
  SAME_FLIGHT: "Pick a different flight to reschedule.",
  NEW_FLIGHT_NOT_FOUND: "That flight is no longer available.",
};

function mapError(message: string) {
  const key = Object.keys(ERRORS).find((k) => message.includes(k));
  return key ? ERRORS[key] : "Something went wrong. Please try again.";
}

const idSchema = z.object({ bookingId: z.string().uuid() });
const rescheduleInputSchema = z.object({
  bookingId: z.string().uuid(),
  newFlightId: z.string().uuid(),
});

/** Atomic cancel via RPC — the DB trigger rejects within 2h of departure. */
export async function cancelBookingAction(
  input: z.infer<typeof idSchema>,
): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return { ok: false, error: "Please sign in." };

  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_booking", {
    p_booking_id: parsed.data.bookingId,
  });
  if (error) return { ok: false, error: mapError(error.message) };

  revalidatePath("/bookings");
  return { ok: true };
}

/** Same-route alternatives in the future, excluding the booking's own flight. */
export async function getAlternativesAction(
  input: z.infer<typeof idSchema>,
): Promise<ActionResult<Flight[]>> {
  const user = await getUser();
  if (!user) return { ok: false, error: "Please sign in." };

  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const supabase = await createClient();
  const { data: booking, error: bErr } = await supabase
    .from("bookings")
    .select("flight:flights(origin,destination)")
    .eq("id", parsed.data.bookingId)
    .single();
  if (bErr || !booking?.flight)
    return { ok: false, error: "Booking not found." };

  const flight = booking.flight as unknown as {
    origin: string;
    destination: string;
  };

  const { data: alternatives } = await supabase
    .from("flights")
    .select("*")
    .eq("origin", flight.origin)
    .eq("destination", flight.destination)
    .neq("status", "cancelled")
    .gt("departs_at", new Date().toISOString())
    .order("departs_at", { ascending: true });

  return { ok: true, data: (alternatives ?? []) as Flight[] };
}

/** Reschedule via the SECURITY DEFINER RPC — atomic. */
export async function rescheduleBookingAction(
  input: z.infer<typeof rescheduleInputSchema>,
): Promise<ActionResult<{ fee: number; total_price: number }>> {
  const user = await getUser();
  if (!user) return { ok: false, error: "Please sign in." };

  const parsed = rescheduleInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reschedule_booking", {
    p_booking_id: parsed.data.bookingId,
    p_new_flight_id: parsed.data.newFlightId,
  });
  if (error) return { ok: false, error: mapError(error.message) };

  const row = Array.isArray(data) ? data[0] : data;
  revalidatePath("/bookings");
  return {
    ok: true,
    data: {
      fee: Number(row?.fee ?? 0),
      total_price: Number(row?.total_price ?? 0),
    },
  };
}
