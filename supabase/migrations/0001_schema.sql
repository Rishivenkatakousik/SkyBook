-- 0001_schema.sql — tables, enums, indexes
-- Run order: 0001 -> 0002 -> 0003 -> 0004

create extension if not exists pgcrypto;

-- Enums ---------------------------------------------------------------------
do $$ begin
  create type flight_status as enum ('scheduled','delayed','departed','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type seat_class as enum ('economy','business','first');
exception when duplicate_object then null; end $$;

do $$ begin
  create type booking_status as enum ('confirmed','rescheduled','cancelled');
exception when duplicate_object then null; end $$;

-- flights -------------------------------------------------------------------
create table if not exists public.flights (
  id            uuid primary key default gen_random_uuid(),
  flight_no     text not null,
  origin        text not null,
  destination   text not null,
  departs_at    timestamptz not null,
  arrives_at    timestamptz not null,
  aircraft_type text,
  status        flight_status not null default 'scheduled',
  base_price    numeric(10,2) not null check (base_price >= 0)
);
create index if not exists flights_route_idx
  on public.flights (origin, destination, departs_at);

-- seats ---------------------------------------------------------------------
create table if not exists public.seats (
  id           uuid primary key default gen_random_uuid(),
  flight_id    uuid not null references public.flights(id) on delete cascade,
  seat_number  text not null,
  class        seat_class not null,
  is_available boolean not null default true,
  extra_fee    numeric(10,2) not null default 0 check (extra_fee >= 0),
  unique (flight_id, seat_number)
);
create index if not exists seats_flight_avail_idx
  on public.seats (flight_id, is_available);

-- bookings ------------------------------------------------------------------
create table if not exists public.bookings (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  flight_id   uuid not null references public.flights(id),
  seat_id     uuid references public.seats(id),
  status      booking_status not null default 'confirmed',
  booked_at   timestamptz not null default now(),
  total_price numeric(10,2) not null check (total_price >= 0),
  pnr_code    text not null unique
);
create index if not exists bookings_user_idx on public.bookings (user_id);
-- Defense-in-depth against double-booking: a seat can back at most one
-- non-cancelled booking, regardless of the code path that wrote it.
create unique index if not exists bookings_active_seat_uidx
  on public.bookings (seat_id)
  where status <> 'cancelled' and seat_id is not null;

-- passengers ----------------------------------------------------------------
create table if not exists public.passengers (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null references public.bookings(id) on delete cascade,
  full_name   text not null,
  passport_no text not null,
  nationality text,
  dob         date
);
create index if not exists passengers_booking_idx
  on public.passengers (booking_id);

-- reschedules ---------------------------------------------------------------
create table if not exists public.reschedules (
  id            uuid primary key default gen_random_uuid(),
  booking_id    uuid not null references public.bookings(id) on delete cascade,
  old_flight_id uuid not null references public.flights(id),
  new_flight_id uuid not null references public.flights(id),
  requested_at  timestamptz not null default now(),
  fee_charged   numeric(10,2) not null default 0
);
create index if not exists reschedules_booking_idx
  on public.reschedules (booking_id);
