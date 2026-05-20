-- 0005_reschedule.sql — atomic reschedule RPC.
--
-- Reschedules must mutate `bookings`, insert into `reschedules`, AND free the
-- old seat on `seats` — which has no client write policy. A single SECURITY
-- DEFINER function keeps the whole thing atomic, applies the same ownership
-- re-check pattern we use elsewhere, and computes the fare difference as the
-- source of truth.

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
         seat_id     = null,            -- user re-picks seat on new flight
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
