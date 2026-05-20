import { z } from "zod";

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date (YYYY-MM-DD)");

export const searchSchema = z
  .object({
    origin: z.string().trim().min(2, "Select an origin"),
    destination: z.string().trim().min(2, "Select a destination"),
    date: dateString,
    pax: z
      .number()
      .int()
      .min(1, "At least 1 passenger")
      .max(9, "Max 9 passengers"),
  })
  .refine((d) => d.origin !== d.destination, {
    message: "Origin and destination must differ",
    path: ["destination"],
  });

export const passengerSchema = z.object({
  full_name: z.string().trim().min(2, "Full name is required"),
  passport_no: z
    .string()
    .trim()
    .min(5, "Passport number looks too short")
    .max(20, "Passport number looks too long"),
  nationality: z.string().trim().min(2, "Nationality is required"),
  dob: dateString,
});

export const rescheduleSchema = z.object({
  bookingId: z.string().uuid(),
  newFlightId: z.string().uuid(),
});

export type SearchInput = z.infer<typeof searchSchema>;
export type PassengerInput = z.infer<typeof passengerSchema>;
export type RescheduleInput = z.infer<typeof rescheduleSchema>;
