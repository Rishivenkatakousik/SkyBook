// Database row types — mirror supabase/migrations/0001_schema.sql.

export type FlightStatus = "scheduled" | "delayed" | "departed" | "cancelled";
export type SeatClass = "economy" | "business" | "first";
export type BookingStatus = "confirmed" | "rescheduled" | "cancelled";

export interface Flight {
  id: string;
  flight_no: string;
  origin: string;
  destination: string;
  departs_at: string; // ISO timestamptz
  arrives_at: string;
  aircraft_type: string | null;
  status: FlightStatus;
  base_price: number;
}

export interface Seat {
  id: string;
  flight_id: string;
  seat_number: string;
  class: SeatClass;
  is_available: boolean;
  extra_fee: number;
}

export interface Booking {
  id: string;
  user_id: string;
  flight_id: string;
  seat_id: string | null;
  status: BookingStatus;
  booked_at: string;
  total_price: number;
  pnr_code: string;
}

export interface Passenger {
  id: string;
  booking_id: string;
  full_name: string;
  passport_no: string;
  nationality: string | null;
  dob: string | null;
}

export interface Reschedule {
  id: string;
  booking_id: string;
  old_flight_id: string;
  new_flight_id: string;
  requested_at: string;
  fee_charged: number;
}

// Joined shapes used by pages.
export interface BookingWithRelations extends Booking {
  flight: Flight | null;
  seat: Seat | null;
  passengers: Passenger[];
  reschedules: Reschedule[];
}
