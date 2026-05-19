import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Flight, Seat } from "@/lib/types";

export type BookingStep =
  | "search"
  | "select-flight"
  | "select-seat"
  | "passenger"
  | "confirm";

export interface SearchQuery {
  origin: string;
  destination: string;
  date: string;
  pax: number;
}

/** Passenger as captured in the booking form. */
export interface PassengerDraft {
  full_name: string;
  passport_no: string;
  nationality: string;
  dob: string;
}

interface FlightState {
  searchQuery: SearchQuery | null;
  selectedFlight: Flight | null;
  selectedSeat: Seat | null;
  bookingStep: BookingStep;
  passengers: PassengerDraft[];

  setSearchQuery: (q: SearchQuery) => void;
  setSelectedFlight: (f: Flight | null) => void;
  /** Optimistic: marks the seat selected in the store before any DB write. */
  selectSeatOptimistic: (s: Seat) => void;
  clearSeat: () => void;
  setStep: (s: BookingStep) => void;
  setPassengers: (p: PassengerDraft[]) => void;
  resetBooking: () => void;
}

const initial = {
  searchQuery: null,
  selectedFlight: null,
  selectedSeat: null,
  bookingStep: "search" as BookingStep,
  passengers: [] as PassengerDraft[],
};

export const useFlightStore = create<FlightState>()(
  persist(
    (set) => ({
      ...initial,
      setSearchQuery: (searchQuery) =>
        set({ searchQuery, bookingStep: "select-flight" }),
      setSelectedFlight: (selectedFlight) =>
        set({
          selectedFlight,
          bookingStep: selectedFlight ? "select-seat" : "select-flight",
        }),
      selectSeatOptimistic: (selectedSeat) =>
        set({ selectedSeat, bookingStep: "passenger" }),
      clearSeat: () => set({ selectedSeat: null, bookingStep: "select-seat" }),
      setStep: (bookingStep) => set({ bookingStep }),
      setPassengers: (passengers) => set({ passengers }),
      resetBooking: () =>
        set({
          selectedFlight: null,
          selectedSeat: null,
          bookingStep: "search",
          passengers: [],
        }),
    }),
    {
      name: "flight-store",
      storage: createJSONStorage(() => localStorage),
      // Persist in-progress booking so the user can resume after closing the
      // tab — but NEVER persist passport numbers to localStorage.
      partialize: (state) => ({
        searchQuery: state.searchQuery,
        selectedFlight: state.selectedFlight,
        selectedSeat: state.selectedSeat,
        bookingStep: state.bookingStep,
        passengers: state.passengers.map((p) => ({
          full_name: p.full_name,
          nationality: p.nationality,
          dob: p.dob,
        })),
      }),
    },
  ),
);
