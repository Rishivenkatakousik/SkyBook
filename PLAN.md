# Flight Management Web App — Implementation Plan

## Context

`prd.md` is an internship assignment: a responsive Flight Management app (search → book → seat select → reschedule → cancel) on Next.js 16 + Supabase + Zustand + Tailwind, with a basic PWA. The repo is a bare `create-next-app` scaffold.

Two constraints shape everything:

1. **Modified Next.js 16.2.6** (verified from bundled docs): `params`/`searchParams`/`cookies()` are **async** (`await` them); middleware → **`proxy.ts`**; **Turbopack** default; Server Components default; Server Actions via `'use server'`; Tailwind v4 (CSS `@theme`, no config file).
2. **`next-pwa@5` is webpack-only → fails on Turbopack.** PWA is built **manually** (hand-written manifest + `public/sw.js`).

**Confirmed:** Supabase creds provided (live testing). Auth = email+password. PWA = manual. Scope = solid Tasks 01–04 + basic PWA.

---

## Phase 0 — Foundations

- `lib/utils.ts`: `cn()` = `twMerge(clsx(...))`.
- `app/globals.css`: add `@theme` tokens — brand colors + **seat-state colors**: `--color-seat-available`, `--seat-selected`, `--seat-occupied`, `--seat-yours`.
- `components/ui/`: `Button`, `Badge`, `Dialog` (modal), `Spinner`, `Input` — small Tailwind primitives.
- `lib/types.ts`: TS row types for all 5 tables + enums.
- `lib/validation.ts`: zod schemas — `searchSchema`, `passengerSchema`, `rescheduleSchema`.
- `lib/pnr.ts`: `generatePnr()` → 6-char A–Z0–9.
- `.env.example`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (+ comment: no service_role key — RLS + DEFINER RPCs cover writes).

---

## Phase 1 — Database (`supabase/migrations/`)

### 0001_schema.sql

```
create type flight_status  as enum ('scheduled','delayed','departed','cancelled');
create type seat_class      as enum ('economy','business','first');
create type booking_status  as enum ('confirmed','rescheduled','cancelled');

flights(
  id uuid pk default gen_random_uuid(),
  flight_no text not null, origin text not null, destination text not null,
  departs_at timestamptz not null, arrives_at timestamptz not null,
  aircraft_type text, status flight_status default 'scheduled',
  base_price numeric(10,2) not null )
  index (origin, destination, departs_at)

seats(
  id uuid pk, flight_id uuid not null references flights on delete cascade,
  seat_number text not null, class seat_class not null,
  is_available boolean not null default true, extra_fee numeric(10,2) not null default 0,
  unique(flight_id, seat_number) )
  index (flight_id, is_available)

bookings(
  id uuid pk, user_id uuid not null references auth.users(id),
  flight_id uuid not null references flights, seat_id uuid references seats,
  status booking_status default 'confirmed', booked_at timestamptz default now(),
  total_price numeric(10,2) not null, pnr_code text not null unique )
  -- defense-in-depth against double-book:
  unique index on (seat_id) where status <> 'cancelled'

passengers(
  id uuid pk, booking_id uuid not null references bookings on delete cascade,
  full_name text not null, passport_no text not null,
  nationality text, dob date )

reschedules(
  id uuid pk, booking_id uuid not null references bookings on delete cascade,
  old_flight_id uuid not null references flights,
  new_flight_id uuid not null references flights,
  requested_at timestamptz default now(), fee_charged numeric(10,2) default 0 )
```

### 0002_rls.sql

Enable RLS on all 5. Policies:

- `flights` / `seats`: `for select using (true)` — public catalog + realtime needs readable seats. **No client insert/update/delete.**
- `bookings`: `for all using (auth.uid() = user_id) with check (auth.uid() = user_id)` — the core "only your own bookings".
- `passengers` / `reschedules`: scoped through the parent booking —
  `using (exists (select 1 from bookings b where b.id = booking_id and b.user_id = auth.uid()))` (same in `with check`).
- `alter publication supabase_realtime add table seats;` — enables Realtime stream on seats.

### 0003_functions.sql — RPCs & trigger (the correctness core)

**`reserve_seat`** — prevents double-booking via a row lock inside one transaction:

```sql
create function reserve_seat(p_flight_id uuid, p_seat_id uuid, p_passengers jsonb)
returns table(booking_id uuid, pnr text)
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_seat seats; v_price numeric; v_pnr text; v_bid uuid;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;

  -- lock this seat row: concurrent callers block here, serializing the check
  select * into v_seat from seats
    where id = p_seat_id and flight_id = p_flight_id for update;
  if not found            then raise exception 'SEAT_NOT_FOUND'; end if;
  if not v_seat.is_available then raise exception 'SEAT_TAKEN';  end if;

  select base_price into v_price from flights where id = p_flight_id;
  v_price := v_price + v_seat.extra_fee;

  loop  -- unique PNR
    v_pnr := upper(substr(md5(gen_random_uuid()::text),1,6));
    exit when not exists (select 1 from bookings where pnr_code = v_pnr);
  end loop;

  update seats set is_available = false where id = p_seat_id;

  insert into bookings(user_id,flight_id,seat_id,status,total_price,pnr_code)
    values (v_uid,p_flight_id,p_seat_id,'confirmed',v_price,v_pnr)
    returning id into v_bid;

  insert into passengers(booking_id,full_name,passport_no,nationality,dob)
    select v_bid, x->>'full_name', x->>'passport_no', x->>'nationality',
           nullif(x->>'dob','')::date
    from jsonb_array_elements(p_passengers) x;

  return query select v_bid, v_pnr;
end $$;
revoke execute on function reserve_seat from anon;
grant   execute on function reserve_seat to authenticated;
```
`user_id` is taken from `auth.uid()` **inside** the function — never trusted from the client. `FOR UPDATE` + the partial unique index = two independent guarantees against race double-booking.

**`cancel_booking`** — atomic status flip + seat free:

```sql
create function cancel_booking(p_booking_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_b bookings;
begin
  select * into v_b from bookings
    where id = p_booking_id and user_id = auth.uid() for update;
  if not found                 then raise exception 'NOT_FOUND'; end if;
  if v_b.status = 'cancelled'  then raise exception 'ALREADY_CANCELLED'; end if;
  update bookings set status = 'cancelled' where id = p_booking_id; -- trigger checks 2h
  update seats set is_available = true where id = v_b.seat_id;
end $$;
```

**2-hour cancellation rule — trigger (single source of truth, all write paths):**

```sql
create function enforce_cancel_window() returns trigger
language plpgsql as $$
declare v_dep timestamptz;
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    select departs_at into v_dep from flights where id = old.flight_id;
    if v_dep - now() < interval '2 hours' then
      raise exception 'CANCEL_WINDOW_CLOSED';
    end if;
  end if;
  return new;
end $$;
create trigger trg_cancel_window before update on bookings
  for each row execute function enforce_cancel_window();
```
Trigger, not a CHECK constraint, because the rule depends on `now()` (time-relative) and must apply on every path (RPC, SQL console, future code).

### 0004_seed.sql

4 routes (JFK–LAX, LAX–SFO, SFO–SEA, SEA–JFK), ≥8 flights with **future** `departs_at` spread over coming days — include **one flight <2h out** to demo the cancel block. Seat maps via `generate_series`: rows 1–2 = first (high `extra_fee`), 3–6 = business (mid), 7–30 = economy (0); columns A–F. Create a known test user (via Supabase dashboard if pure-SQL `auth.users` insert is unreliable on the project) and 2–3 pre-made bookings for it so My Bookings + offline have data on first run.

**Verify Phase 1 live:** open two SQL sessions, both `select ... for update` same seat then `reserve_seat` → 2nd fails `SEAT_TAKEN`. Update a booking to cancelled when its flight is <2h out → `CANCEL_WINDOW_CLOSED`. Query bookings as a different user → RLS returns none.

---

## Phase 2 — Supabase clients, proxy, auth

- `lib/supabase/server.ts` — `async createClient()`: `const c = await cookies();` → `createServerClient(URL, ANON, { cookies: { getAll: ()=>c.getAll(), setAll:(l)=>{ try{ l.forEach(x=>c.set(x.name,x.value,x.options)) }catch{} } } })`.
- `lib/supabase/client.ts` — module-singleton `createBrowserClient(URL, ANON)` for realtime + optimistic reads.
- `lib/supabase/proxy.ts` — `updateSession(req)`: server client bound to `req.cookies` + a `NextResponse`, `await supabase.auth.getUser()`, mirror refreshed auth cookies onto the response.
- `proxy.ts` (root): call `updateSession`; **optimistic** (cookie presence only) — no user + path in `/bookings|/booking|/confirmation` → redirect `/login`; user on `/login|/signup` → redirect `/`. `config.matcher` excludes `_next`, static, `manifest.json`, `sw.js`, `icons`, `offline`, `api`.
- `lib/dal.ts` — `getUser = cache(async()=>{ const s=await createClient(); return (await s.auth.getUser()).data.user })` — **authoritative** check used inside every protected Server Component (proxy is optimistic only, per Next 16 docs).
- `app/(auth)/actions.ts` (`'use server'`): `login` (`signInWithPassword`), `signup` (`signUp`), `logout` (`signOut`) — then `revalidatePath('/','layout')` + `redirect`. Errors surfaced via `useActionState`.
- `app/(auth)/login/page.tsx`, `signup/page.tsx`: client RHF+zod forms.

**Verify:** signup→login sets cookies; logged-out hit on `/bookings` redirects; `getUser()` returns the user.

---

## Phase 3 — Zustand stores (Task 04)

`stores/useFlightStore.ts` (persist `flight-store`, localStorage):
- state: `searchQuery {origin,destination,date,pax}`, `selectedFlight`, `selectedSeat`, `bookingStep`, `passengers[]`.
- actions: `setSearchQuery`, `setSelectedFlight`, `selectSeatOptimistic(seat)`, `clearSeat`, `setStep`, `setPassengers`, `resetBooking()`.
- **`partialize`**: persist `searchQuery, selectedFlight, selectedSeat, bookingStep`, and `passengers` **mapped to drop `passportNo`**. Passport never enters localStorage — it lives only in RHF/component state until the server action.

`stores/useUserStore.ts` (persist `user-store`): state `sessionToken | user | cachedBookings`; **`partialize` persists only `sessionToken`**. `reset()` (logout) also calls `useFlightStore.getState().resetBooking()`.

`resetBooking()` triggers: successful booking, cancellation, logout.

**Verify:** DevTools → Application → Local Storage shows `flight-store` with **no `passportNo`**, `user-store` with only `sessionToken`.

---

## Phase 4 — Task 01: Search → Book → Confirm

1. `app/page.tsx` → `SearchForm` (client, RHF+zod). Submit → `setSearchQuery` + `router.push('/search/results?origin=&destination=&date=&pax=')`.
2. `app/search/results/page.tsx` (Server Component): `await searchParams`, `createClient()`, query flights by route + date range, compute duration with `date-fns`. Render `FlightCard` list (price, duration, class chips). Select → `setSelectedFlight` + push `/booking/[flightId]`.
3. `app/booking/[flightId]/page.tsx` (Server Component): `await params`, fetch flight + seats. Render `BookingStepper` + `SeatMap` (client) + `PassengerForm` (client).
4. `app/booking/[flightId]/actions.ts` → `createBooking` (`'use server'`): `getUser()` (DAL), zod-validate passengers, call `supabase.rpc('reserve_seat',{...})`. Map errors: `SEAT_TAKEN` → return `{error}` (client toasts + clears seat, reselect); success → `revalidatePath('/bookings')` + `redirect('/confirmation/'+pnr)`.
5. `app/confirmation/[pnr]/page.tsx` (Server Component): `await params`, fetch booking by `pnr_code` joined flight+seat+passengers (RLS scopes to owner). Show PNR, flight details, seat.

**Verify:** full flow yields a PNR; another user cannot open that confirmation URL.

---

## Phase 5 — Task 02: Interactive seat map + Realtime

`components/seatmap/SeatMap.tsx` (`'use client'`):
- Receives server-fetched `seats` as prop; copies into local `useState`.
- Subscribe on mount:
```ts
const ch = supabase.channel('seats-'+flightId)
  .on('postgres_changes',
      { event:'UPDATE', schema:'public', table:'seats', filter:`flight_id=eq.${flightId}` },
      ({ new: s }) => setSeats(prev => prev.map(x => x.id===s.id ? {...x,...s} : x)))
  .subscribe();
return () => { supabase.removeChannel(ch); };
```
So when another user's `reserve_seat` flips `is_available`, every open map updates **without refresh**.
- Render 3 labeled zones (First / Business / Economy) with visual separators; grid rows × cols A–F.
- `Seat.tsx` color via `cn()`: **available** (clickable) / **selected** (from `useFlightStore.selectedSeat`) / **occupied** (`disabled`, tooltip = `class • $extra_fee`) / **your seat** (matches one of the user's bookings on this flight).
- Click available seat → `selectSeatOptimistic(seat)` (store updates instantly, before any DB write).
- Container `overflow-auto`, generous tap targets, `touch-action: manipulation` → scrollable + touch-friendly on mobile.

**Verify:** two browsers on same flight; book a seat in A → it greys out in B within ~1s, no reload. Occupied tooltip shows class + fee. Mobile width scrolls/taps cleanly.

---

## Phase 6 — Task 03: My Bookings, Reschedule, Cancel

- `app/bookings/page.tsx` (Server Component, `getUser()`): fetch user's bookings + joined flight/seat/reschedules. Render `BookingCard` with status `Badge` (confirmed=green, rescheduled=amber, cancelled=grey). This page's responses are what the SW caches for offline.

- **Reschedule** — `RescheduleDialog` (client): fetches alternative flights on the **same origin+destination** (server action / `/api/flights`). On confirm → `reschedule` server action:
  1. fetch old + new flight prices;
  2. `fee = max(0, new.base_price - old.total_price_basis)` (charge only if pricier);
  3. `insert into reschedules(booking_id, old_flight_id, new_flight_id, fee_charged)`;
  4. `update bookings set flight_id = new, status = 'rescheduled', total_price = total_price + fee`;
  5. free old seat / leave seat selection to a follow-up (document: seat re-pick on new flight is a known simplification if time-constrained);
  6. `revalidatePath('/bookings')`.

- **Cancel** — `ConfirmDialog` → `cancel` server action → `supabase.rpc('cancel_booking',{p_booking_id})`. The DB trigger raises `CANCEL_WINDOW_CLOSED` when <2h → caught, shown as a Sonner toast: "Cannot cancel within 2 hours of departure." Success → seat freed atomically by the RPC → `revalidatePath('/bookings')`.

- **Every destructive action (cancel, reschedule) is gated behind `ConfirmDialog`** before firing.

**Verify:** reschedule to a pricier flight adds the fare diff; to a cheaper one charges 0. Cancel >2h frees the seat (visible on its seat map). Cancel <2h is rejected by the DB and toasted.

---

## Phase 7 — Task 05: Manual PWA (basic)

- `public/manifest.json`: `name`, `short_name`, `start_url:"/"`, `display:"standalone"`, `theme_color`, `background_color`, icons 192 / 512 / 512-maskable. Linked via `app/layout.tsx` metadata (`manifest`, `themeColor`).
- `public/sw.js` (static file → Turbopack never processes it; scope `/`):
  - `install`: precache app shell + `/offline`.
  - `fetch` routing: navigations → network-first → cache → `/offline`; `/api/flights` & `/search/results` → **StaleWhileRevalidate**; `/_next/static`, `/icons`, fonts → **CacheFirst**; `/bookings` → network-first, fall back to last cached (readable offline).
  - versioned cache name; `activate` deletes old caches.
- `components/pwa/SWRegister.tsx` (client, in layout): `navigator.serviceWorker.register('/sw.js')`.
- `components/pwa/InstallPrompt.tsx` (client): capture `beforeinstallprompt`, dismissible mobile-first banner (localStorage flag), `prompt()` on click.
- `app/offline/page.tsx`: static fallback.
- `next.config.ts`: `headers()` → `Service-Worker-Allowed: /`, `Cache-Control: no-cache` for `sw.js`.

**Verify:** install banner appears on mobile viewport; DevTools offline → `/bookings` shows last-cached data, unknown route shows `/offline`. Lighthouse PWA ≥90 → screenshot for README.

---

## Phase 8 — Polish, deploy, README

- Responsive sweep (mobile → desktop), loading/error states, empty states.
- Full E2E: logged-out → signup → search → seat → book → confirm → My Bookings → reschedule → cancel.
- Deploy to Vercel, set env vars, re-verify against live Supabase.
- `README.md`: setup steps, env vars, how to run migrations/seed, **Zustand store design explanation**, Lighthouse screenshot, and the trade-offs below.

---

## Critical Files

- `supabase/migrations/0003_functions.sql` — RPCs + 2h trigger (correctness core)
- `lib/supabase/server.ts` — async-cookies SSR client
- `proxy.ts` — session refresh + optimistic protection
- `stores/useFlightStore.ts` — persist + partialize excluding passport
- `components/seatmap/SeatMap.tsx` — Realtime subscription
- `public/sw.js` — manual PWA caching under Turbopack

## Trade-offs (documented in README)

- `next-pwa` unusable on Turbopack → manual SW (PRD asked for next-pwa — explained).
- `SECURITY DEFINER` RPCs bypass RLS → mitigated: `user_id` from `auth.uid()` internally, ownership re-checks, `revoke from anon`.
- 2h rule as trigger (not CHECK) — time-relative; enforced on all write paths.
- Double-booking guarded twice: `FOR UPDATE` lock + partial unique index.
- Persisting session token in Zustand is redundant with Supabase cookie auth (slight XSS surface) — done because the PRD explicitly requires it; real auth stays cookie-based.
- Proxy optimistic-only by Next 16 design; true authz in DAL.
- Offline My Bookings shows last-cached (stale) data → surfaced with an "offline/cached" indicator.
- If time-constrained: defer multi-passenger seat selection and seat re-pick on reschedule — documented.
