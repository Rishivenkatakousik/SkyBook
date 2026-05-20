"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/dal";
import { passengerSchema } from "@/lib/validation";

const inputSchema = z.object({
  flightId: z.string().uuid(),
  seatId: z.string().uuid(),
  passengers: z.array(passengerSchema).min(1),
});

export type BookingResult = { error: string };

const ERRORS: Record<string, string> = {
  SEAT_TAKEN: "That seat was just taken. Please pick another.",
  SEAT_NOT_FOUND: "That seat is no longer available.",
  NOT_AUTHENTICATED: "Please sign in to book.",
  NO_PASSENGERS: "Add at least one passenger.",
  FLIGHT_NOT_FOUND: "This flight is no longer available.",
};

export async function createBooking(
  input: z.infer<typeof inputSchema>,
): Promise<BookingResult> {
  const user = await getUser();
  if (!user) return { error: "Please sign in to book." };

  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { error: "Please complete all passenger fields." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reserve_seat", {
    p_flight_id: parsed.data.flightId,
    p_seat_id: parsed.data.seatId,
    p_passengers: parsed.data.passengers,
  });

  if (error) {
    const key = Object.keys(ERRORS).find((k) => error.message.includes(k));
    return { error: key ? ERRORS[key] : "Could not complete booking." };
  }

  const row = Array.isArray(data) ? data[0] : data;
  const pnr = row?.pnr as string | undefined;
  if (!pnr) return { error: "Booking succeeded but no PNR was returned." };

  revalidatePath("/bookings");
  redirect(`/confirmation/${pnr}`);
}
