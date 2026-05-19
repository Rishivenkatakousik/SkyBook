-- 0002_rls.sql — Row Level Security + Realtime
-- Users can only read/write their OWN bookings (and the passengers /
-- reschedules attached to them). The flight & seat catalog is public-read so
-- anonymous visitors can search and the seat map can stream live updates.

alter table public.flights     enable row level security;
alter table public.seats       enable row level security;
alter table public.bookings    enable row level security;
alter table public.passengers  enable row level security;
alter table public.reschedules enable row level security;

-- flights: public catalog, read-only for clients -----------------------------
drop policy if exists flights_select on public.flights;
create policy flights_select on public.flights
  for select using (true);

-- seats: public read (needed to render map + receive Realtime events).
-- No client write policy — seat writes happen only inside SECURITY DEFINER
-- RPCs (reserve_seat / cancel_booking).
drop policy if exists seats_select on public.seats;
create policy seats_select on public.seats
  for select using (true);

-- bookings: owner-scoped for every command -----------------------------------
drop policy if exists bookings_owner on public.bookings;
create policy bookings_owner on public.bookings
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- passengers: scoped through the parent booking ------------------------------
drop policy if exists passengers_owner on public.passengers;
create policy passengers_owner on public.passengers
  for all
  using (
    exists (
      select 1 from public.bookings b
      where b.id = passengers.booking_id and b.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.bookings b
      where b.id = passengers.booking_id and b.user_id = auth.uid()
    )
  );

-- reschedules: scoped through the parent booking -----------------------------
drop policy if exists reschedules_owner on public.reschedules;
create policy reschedules_owner on public.reschedules
  for all
  using (
    exists (
      select 1 from public.bookings b
      where b.id = reschedules.booking_id and b.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.bookings b
      where b.id = reschedules.booking_id and b.user_id = auth.uid()
    )
  );

-- Realtime: stream seat availability changes to every connected client.
do $$ begin
  alter publication supabase_realtime add table public.seats;
exception when duplicate_object then null; end $$;
