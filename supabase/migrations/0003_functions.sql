-- 0003_functions.sql — booking RPCs + the 2-hour cancellation trigger.
-- These run as SECURITY DEFINER because the seats table has no client write
-- policy; every function derives the user from auth.uid() internally and never
-- trusts a client-supplied user id.

-- reserve_seat ---------------------------------------------------------------
-- Atomically: lock the seat row, verify availability, price the fare, mint a
-- unique PNR, flip the seat, insert the booking + passengers. The row lock
-- (FOR UPDATE) serializes concurrent callers competing for the same seat, and
-- the partial unique index on bookings(seat_id) is a second, independent guard
-- against a double-booking race.
create or replace function public.reserve_seat(
  p_flight_id  uuid,
  p_seat_id    uuid,
  p_passengers jsonb
)
returns table (booking_id uuid, pnr text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_seat  public.seats%rowtype;
  v_price numeric(10,2);
  v_pnr   text;
  v_bid   uuid;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  if p_passengers is null or jsonb_array_length(p_passengers) = 0 then
    raise exception 'NO_PASSENGERS';
  end if;

  -- Serialize concurrent reservations of this exact seat.
  select * into v_seat
  from public.seats
  where id = p_seat_id and flight_id = p_flight_id
  for update;

  if not found then
    raise exception 'SEAT_NOT_FOUND';
  end if;
  if not v_seat.is_available then
    raise exception 'SEAT_TAKEN';
  end if;

  select base_price + v_seat.extra_fee
    into v_price
  from public.flights
  where id = p_flight_id;

  if v_price is null then
    raise exception 'FLIGHT_NOT_FOUND';
  end if;

  -- Mint a unique PNR (collisions are astronomically rare but handled).
  loop
    v_pnr := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    exit when not exists (select 1 from public.bookings where pnr_code = v_pnr);
  end loop;

  update public.seats set is_available = false where id = p_seat_id;

  insert into public.bookings (user_id, flight_id, seat_id, status, total_price, pnr_code)
  values (v_uid, p_flight_id, p_seat_id, 'confirmed', v_price, v_pnr)
  returning id into v_bid;

  insert into public.passengers (booking_id, full_name, passport_no, nationality, dob)
  select v_bid,
         x->>'full_name',
         x->>'passport_no',
         nullif(x->>'nationality', ''),
         nullif(x->>'dob', '')::date
  from jsonb_array_elements(p_passengers) x;

  return query select v_bid, v_pnr;
end;
$$;

revoke all on function public.reserve_seat(uuid, uuid, jsonb) from public, anon;
grant execute on function public.reserve_seat(uuid, uuid, jsonb) to authenticated;

-- cancel_booking -------------------------------------------------------------
-- Atomically flip the booking to cancelled and free its seat. Ownership is
-- re-checked here because SECURITY DEFINER bypasses RLS. The 2-hour rule is
-- enforced by the trigger below (single source of truth), so the UPDATE will
-- raise CANCEL_WINDOW_CLOSED if it is too late.
create or replace function public.cancel_booking(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_b public.bookings%rowtype;
begin
  select * into v_b
  from public.bookings
  where id = p_booking_id and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'NOT_FOUND';
  end if;
  if v_b.status = 'cancelled' then
    raise exception 'ALREADY_CANCELLED';
  end if;

  update public.bookings set status = 'cancelled' where id = p_booking_id;

  if v_b.seat_id is not null then
    update public.seats set is_available = true where id = v_b.seat_id;
  end if;
end;
$$;

revoke all on function public.cancel_booking(uuid) from public, anon;
grant execute on function public.cancel_booking(uuid) to authenticated;

-- 2-hour cancellation window -------------------------------------------------
-- A trigger (not a CHECK constraint) because the rule is time-relative
-- (depends on now()); enforced on every write path, not just the RPC.
create or replace function public.enforce_cancel_window()
returns trigger
language plpgsql
as $$
declare
  v_dep timestamptz;
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    select departs_at into v_dep from public.flights where id = old.flight_id;
    if v_dep is not null and v_dep - now() < interval '2 hours' then
      raise exception 'CANCEL_WINDOW_CLOSED';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_cancel_window on public.bookings;
create trigger trg_cancel_window
  before update on public.bookings
  for each row
  execute function public.enforce_cancel_window();
