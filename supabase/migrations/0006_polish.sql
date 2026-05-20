-- 0006_polish.sql — small additions on top of 0005:
--   1. Add a 2-hour-before-departure block to reschedule_booking (parity
--      with the cancellation rule).
--   2. refresh_demo_times(): a dev convenience that re-anchors all seeded
--      flight times to "now". Useful for keeping the demo realistic over
--      time without resetting the whole DB.

-- 1. reschedule_booking with 2h block --------------------------------------
create or replace function public.reschedule_booking(
  p_booking_id    uuid,
  p_new_flight_id uuid
)
returns table (fee numeric, total_price numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_booking   public.bookings%rowtype;
  v_old_route record;
  v_new_route record;
  v_old_dep   timestamptz;
  v_fee       numeric(10,2);
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select * into v_booking
  from public.bookings
  where id = p_booking_id and user_id = v_uid
  for update;

  if not found then
    raise exception 'NOT_FOUND';
  end if;
  if v_booking.status = 'cancelled' then
    raise exception 'ALREADY_CANCELLED';
  end if;
  if v_booking.flight_id = p_new_flight_id then
    raise exception 'SAME_FLIGHT';
  end if;

  -- New: enforce the same 2-hour window for reschedules as for cancels.
  select departs_at into v_old_dep
  from public.flights where id = v_booking.flight_id;
  if v_old_dep is not null and v_old_dep - now() < interval '2 hours' then
    raise exception 'RESCHEDULE_WINDOW_CLOSED';
  end if;

  select origin, destination, base_price
    into v_old_route
  from public.flights where id = v_booking.flight_id;

  select origin, destination, base_price
    into v_new_route
  from public.flights where id = p_new_flight_id;

  if v_new_route is null then
    raise exception 'NEW_FLIGHT_NOT_FOUND';
  end if;
  if v_new_route.origin <> v_old_route.origin
     or v_new_route.destination <> v_old_route.destination then
    raise exception 'ROUTE_MISMATCH';
  end if;

  v_fee := greatest(0, v_new_route.base_price - v_old_route.base_price);

  insert into public.reschedules
    (booking_id, old_flight_id, new_flight_id, fee_charged)
  values (p_booking_id, v_booking.flight_id, p_new_flight_id, v_fee);

  update public.bookings
     set flight_id   = p_new_flight_id,
         status      = 'rescheduled',
         seat_id     = null,
         total_price = total_price + v_fee
   where id = p_booking_id;

  if v_booking.seat_id is not null then
    update public.seats set is_available = true where id = v_booking.seat_id;
  end if;

  return query select v_fee, v_booking.total_price + v_fee;
end;
$$;

revoke all on function public.reschedule_booking(uuid, uuid) from public, anon;
grant execute on function public.reschedule_booking(uuid, uuid) to authenticated;

-- 2. refresh_demo_times() ---------------------------------------------------
-- Re-anchors all seeded flight times to be relative to now() again. Call
-- with `select public.refresh_demo_times();` whenever the demo data has
-- decayed. Execute is granted to the postgres role only — anyone running
-- this from the SQL Editor is already authenticated as the project owner.
create or replace function public.refresh_demo_times()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.flights f
     set departs_at = now() + v.offset_,
         arrives_at = now() + v.offset_ + v.dur
    from (values
      ('FL101', interval '3 days',     interval '6 hours'),
      ('FL102', interval '5 days',     interval '6 hours'),
      ('FL103', interval '90 minutes', interval '6 hours'),
      ('FL201', interval '2 days',     interval '1 hour 30 minutes'),
      ('FL202', interval '4 days',     interval '1 hour 30 minutes'),
      ('FL301', interval '2 days',     interval '2 hours'),
      ('FL302', interval '6 days',     interval '2 hours'),
      ('FL401', interval '3 days',     interval '5 hours 30 minutes'),
      ('FL402', interval '7 days',     interval '5 hours 30 minutes')
    ) as v(fn, offset_, dur)
   where f.flight_no = v.fn;
end;
$$;

revoke all on function public.refresh_demo_times() from public, anon, authenticated;
