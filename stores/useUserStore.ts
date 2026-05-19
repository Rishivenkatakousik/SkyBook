import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { BookingWithRelations } from "@/lib/types";
import { useFlightStore } from "./useFlightStore";

interface SessionUser {
  id: string;
  email: string;
}

interface UserState {
  sessionToken: string | null;
  user: SessionUser | null;
  /** Last-known bookings — surfaced read-only when offline. */
  cachedBookings: BookingWithRelations[];

  setSession: (token: string | null, user: SessionUser | null) => void;
  setCachedBookings: (b: BookingWithRelations[]) => void;
  /** On logout/cancel: clear session AND the in-progress booking. */
  reset: () => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      sessionToken: null,
      user: null,
      cachedBookings: [],
      setSession: (sessionToken, user) => set({ sessionToken, user }),
      setCachedBookings: (cachedBookings) => set({ cachedBookings }),
      reset: () => {
        useFlightStore.getState().resetBooking();
        set({ sessionToken: null, user: null, cachedBookings: [] });
      },
    }),
    {
      name: "user-store",
      storage: createJSONStorage(() => localStorage),
      // Per the brief: persist ONLY the session token. The user object and
      // cached bookings stay in memory (Supabase cookies + the SW handle the
      // real session and offline data respectively).
      partialize: (state) => ({ sessionToken: state.sessionToken }),
    },
  ),
);
