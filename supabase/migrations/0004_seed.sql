-- 0004_seed.sql — demo data: 9 flights across 4 routes, full seat maps,
-- a test user, and sample bookings so My Bookings / offline have content.
-- Safe to run once on a fresh DB; flight insert is skipped if any exist.

-- Flights (times are relative to now() so the demo is always "live").
-- One flight departs in 90 minutes to demonstrate the 2-hour cancel block.
insert into public.flights
  (flight_no, origin, destination, departs_at, arrives_at, aircraft_type, base_price)
select * from (values
  ('FL101','JFK','LAX', now() + interval '3 days',  now() + interval '3 days 6 hours',  'Boeing 737',  320.00),
  ('FL102','JFK','LAX', now() + interval '5 days',  now() + interval '5 days 6 hours',  'Airbus A320', 289.00),
  ('FL103','JFK','LAX', now() + interval '90 minutes', now() + interval '7 hours 30 minutes','Boeing 737', 410.00),
  ('FL201','LAX','SFO', now() + interval '2 days',  now() + interval '2 days 1 hour 30 minutes','Embraer E175', 145.00),
  ('FL202','LAX','SFO', now() + interval '4 days',  now() + interval '4 days 1 hour 30 minutes','Airbus A319', 132.00),
  ('FL301','SFO','SEA', now() + interval '2 days',  now() + interval '2 days 2 hours','Boeing 737',  178.00),
  ('FL302','SFO','SEA', now() + interval '6 days',  now() + interval '6 days 2 hours','Airbus A320', 165.00),
  ('FL401','SEA','JFK', now() + interval '3 days',  now() + interval '3 days 5 hours 30 minutes','Boeing 757', 365.00),
  ('FL402','SEA','JFK', now() + interval '7 days',  now() + interval '7 days 5 hours 30 minutes','Airbus A321', 342.00)
) as v
where not exists (select 1 from public.flights);

-- Seat map per flight: rows 1-2 first, 3-6 business, 7-30 economy; cols A-F.
insert into public.seats (flight_id, seat_number, class, extra_fee)
select f.id,
       r::text || c,
       case when r <= 2 then 'first'::seat_class
            when r <= 6 then 'business'::seat_class
            else 'economy'::seat_class end,
       case when r <= 2 then 150.00
            when r <= 6 then 75.00
            else 0.00 end
from public.flights f
cross join generate_series(1, 30) as r
cross join unnest(array['A','B','C','D','E','F']) as c
where not exists (select 1 from public.seats s where s.flight_id = f.id);

-- ---------------------------------------------------------------------------
-- Test user: test@flights.dev / Passw0rd!
-- Pure-SQL auth.users creation can be brittle across GoTrue versions. If this
-- block errors, create the user in the Supabase dashboard (Authentication ->
-- Add user) with the same email/password, then re-run ONLY the "sample
-- bookings" block below — it resolves the user by email either way.
-- ---------------------------------------------------------------------------
do $$
declare
  v_uid uuid := '00000000-0000-0000-0000-000000000001';
begin
  if not exists (select 1 from auth.users where email = 'test@flights.dev') then
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data
    ) values (
      '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated',
      'authenticated', 'test@flights.dev',
      crypt('Passw0rd!', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb
    );

    insert into auth.identities (
      id, user_id, identity_data, provider, provider_id,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), v_uid,
      jsonb_build_object('sub', v_uid::text, 'email', 'test@flights.dev'),
      'email', v_uid::text, now(), now(), now()
    );
  end if;
exception when others then
  raise notice 'Test user auto-create skipped (%). Create via dashboard.', sqlerrm;
end $$;

-- Sample bookings for the test user (resolved by email so it works whether
-- the user was made by SQL above or via the dashboard).
do $$
declare
  v_uid     uuid;
  v_flight  uuid;
  v_seat    uuid;
  v_bid     uuid;
begin
  select id into v_uid from auth.users where email = 'test@flights.dev';
  if v_uid is null then
    raise notice 'No test user — skipping sample bookings.';
    return;
  end if;

  if exists (select 1 from public.bookings where user_id = v_uid) then
    return; -- already seeded
  end if;

  -- Booking 1: confirmed, on FL101 (cancellable / reschedulable).
  select id into v_flight from public.flights where flight_no = 'FL101';
  select id into v_seat from public.seats
    where flight_id = v_flight and is_available order by seat_number limit 1;

  insert into public.bookings (user_id, flight_id, seat_id, status, total_price, pnr_code)
  values (v_uid, v_flight, v_seat, 'confirmed',
          (select base_price from public.flights where id = v_flight)
            + (select extra_fee from public.seats where id = v_seat),
          'DEMO01')
  returning id into v_bid;
  update public.seats set is_available = false where id = v_seat;
  insert into public.passengers (booking_id, full_name, passport_no, nationality, dob)
  values (v_bid, 'Test Traveller', 'X1234567', 'United States', '1990-04-12');

  -- Booking 2: confirmed, on FL301 (different route).
  select id into v_flight from public.flights where flight_no = 'FL301';
  select id into v_seat from public.seats
    where flight_id = v_flight and is_available order by seat_number limit 1;

  insert into public.bookings (user_id, flight_id, seat_id, status, total_price, pnr_code)
  values (v_uid, v_flight, v_seat, 'confirmed',
          (select base_price from public.flights where id = v_flight)
            + (select extra_fee from public.seats where id = v_seat),
          'DEMO02')
  returning id into v_bid;
  update public.seats set is_available = false where id = v_seat;
  insert into public.passengers (booking_id, full_name, passport_no, nationality, dob)
  values (v_bid, 'Test Traveller', 'X1234567', 'United States', '1990-04-12');
end $$;
