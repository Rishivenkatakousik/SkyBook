# SkyBook — Flight Management Web App

A responsive, production-leaning flight booking PWA: search flights, pick a seat on a live seat map, reschedule, cancel — built on Next.js 16 + Supabase + Zustand.

**Live demo:** _add your Vercel URL here after deploy_
**Test account:** `test@flights.dev` / `Passw0rd!`

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | **Next.js 16.2** (App Router, Turbopack, Server Components, Server Actions) |
| DB + Auth + Realtime | **Supabase** (PostgreSQL, RLS, `SECURITY DEFINER` RPCs, Realtime channels) |
| State | **Zustand 5** with `persist` + `partialize` |
| Styling | **Tailwind v4** (CSS `@theme`, no `tailwind.config.js`) |
| Forms / validation | react-hook-form + zod |
| Toasts | sonner |
| PWA | **`@ducanh2912/next-pwa`** (workbox under the hood) + custom `manifest.json` (see [PWA notes](#pwa)) |

> ⚠️ This repo uses Next.js 16, which has breaking changes from the version in most LLM training data: `params`/`searchParams`/`cookies()` are async, `middleware` is renamed to **`proxy`**, Turbopack is the default bundler. The PWA plugin wraps `workbox-webpack-plugin`, so the **production build runs on webpack** (`next build --webpack`). Dev stays on Turbopack — the SW is disabled in dev anyway.

---

## Quick start

### 1. Install

```bash
npm install
```

### 2. Create a Supabase project

[supabase.com](https://supabase.com) → New project. Copy from **Project Settings → API**:
- Project URL
- `anon` public key

### 3. Configure environment

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://<your-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your anon key>
```

The app uses only the anon key — every write goes through RLS or a `SECURITY DEFINER` RPC. The service-role key is never needed at runtime.

### 4. Apply migrations

Open Supabase Dashboard → **SQL Editor**, paste and run each file in order:

```
supabase/migrations/0001_schema.sql        # tables, enums, indexes
supabase/migrations/0002_rls.sql           # RLS policies + Realtime publication
supabase/migrations/0003_functions.sql     # reserve_seat / cancel_booking RPCs + 2h trigger
supabase/migrations/0004_seed.sql          # 9 flights / 4 routes / 1620 seats + test user
supabase/migrations/0005_reschedule.sql    # reschedule_booking RPC
supabase/migrations/0006_polish.sql        # 2h reschedule block + refresh_demo_times() helper
```

Verify:

```sql
select (select count(*) from flights)  as flights,    -- 9
       (select count(*) from seats)    as seats,      -- 1620
       (select count(*) from bookings) as bookings;   -- 2 (seeded demo)
```

If the seed's test-user `do $$ … $$;` block raised a notice, create `test@flights.dev` / `Passw0rd!` manually via **Authentication → Users → Add user** (tick *Auto Confirm User*), then re-run **only the second `do $$ … $$;` block** in `0004_seed.sql` to attach the sample bookings.

### 5. Run

```bash
npm run dev
```

Open http://localhost:3000.

### Keeping the demo "live"

Seed timestamps are anchored to `now()` when the seed first ran, so after a day or two FL103 (90 min out, used to demo the 2h cancel block) has "departed" and disappears from search. Re-anchor any time:

```sql
select public.refresh_demo_times();
```

---

## Architecture

```
app/
├── (auth)/{login,signup}/page.tsx     ← Server Component shells
├── (auth)/actions.ts                  ← 'use server' login / signup / logout
├── page.tsx                           ← search home (Server Component)
├── search/results/page.tsx            ← results list (Server Component, await searchParams)
├── booking/[flightId]/page.tsx        ← seat map + passenger form orchestration
├── booking/[flightId]/actions.ts      ← createBooking → reserve_seat RPC
├── confirmation/[pnr]/page.tsx        ← PNR + flight summary (RLS-scoped fetch)
├── bookings/page.tsx                  ← My Bookings (Server Component)
├── bookings/actions.ts                ← cancel / reschedule / list alternatives
├── offline/page.tsx                   ← static offline fallback
└── layout.tsx                         ← Nav, Toaster, SWRegister, InstallPrompt

lib/
├── supabase/{server,client,proxy}.ts  ← SSR-aware Supabase clients
├── dal.ts                             ← cached getUser() — authoritative authz
├── types.ts / validation.ts / pnr.ts / utils.ts

stores/
├── useFlightStore.ts                  ← search query / selected flight & seat / steps / passengers
└── useUserStore.ts                    ← session token + cached bookings

components/
├── Nav.tsx                            ← auth-aware header (server)
├── auth/AuthForm.tsx                  ← client form via useActionState
├── search/SearchForm.tsx
├── results/FlightCard.tsx
├── seatmap/SeatMap.tsx                ← live Realtime channel
├── booking/{BookingClient,BookingStepper,PassengerForm,ResetBookingOnMount}.tsx
├── bookings/{BookingCard,ConfirmDialog,RescheduleDialog}.tsx
├── pwa/InstallPrompt.tsx
└── ui/{Button,Badge,Input,Dialog,Spinner}.tsx

supabase/migrations/                   ← all SQL, applied via Dashboard SQL Editor
public/{manifest.json, icons/}        ← static PWA assets (sw.js + workbox-* generated at build)
proxy.ts                               ← session refresh + optimistic route guard
```

---

## Zustand store design

There are **two stores**, deliberately separated.

### `useFlightStore` (the in-progress booking)

```ts
state:
  searchQuery     : { origin, destination, date, pax } | null
  selectedFlight  : Flight | null
  selectedSeat    : Seat   | null     // updated optimistically before any DB write
  bookingStep     : 'search' | 'select-flight' | 'select-seat' | 'passenger' | 'confirm'
  passengers      : { full_name, passport_no, nationality, dob }[]
```

**Persistence** (`persist` middleware, `localStorage`):
- `partialize` includes `searchQuery`, `selectedFlight`, `selectedSeat`, `bookingStep`, and `passengers` — but **passengers are remapped to drop `passport_no`** before write. Passport numbers never reach localStorage; they live only in the RHF form until the server action submits them.
- The user can close the tab mid-flow and return — their search and seat selection are restored, but they re-enter their passport.
- `resetBooking()` is called on (a) successful booking (in `confirmation/[pnr]/page.tsx` via `ResetBookingOnMount`), (b) cancellation, (c) logout.

**Optimistic seat selection** — `selectSeatOptimistic(seat)` updates the store the moment a seat tile is clicked, *before* any RPC fires. The seat map reflects the choice instantly. If the subsequent `reserve_seat` call returns `SEAT_TAKEN` (someone else claimed it in the race), the action returns `{ error }`, the UI toasts, and `clearSeat()` is called so the user re-picks.

### `useUserStore` (the session)

```ts
state:
  sessionToken    : string | null     // PERSISTED — per the assignment brief
  user            : { id, email } | null
  cachedBookings  : BookingWithRelations[]   // last-known list, NOT persisted
```

**Persistence**: `partialize` returns `{ sessionToken }` only. Per the brief, this is the single persisted field. The `user` object and `cachedBookings` stay in memory.

**`reset()`** clears everything **and** calls `useFlightStore.getState().resetBooking()`, so logging out wipes both stores in one call.

### Why two stores

- **Lifetime is different**: booking state is a workflow that resets per attempt; the session lasts across many bookings.
- **Persistence rules are different**: passenger data leaks user identity, seats are race-prone — both want careful `partialize`. The session is simpler.
- **Components subscribe to less data**: a Realtime seat-map listener doesn't care about the session token, and the nav header doesn't care about the half-filled passenger form.

---

## Concurrency: how double-booking is prevented

A single `reserve_seat(p_flight_id, p_seat_id, p_passengers)` RPC does the whole booking transaction:

```sql
-- inside SECURITY DEFINER, set search_path = public
SELECT * FROM seats WHERE id = p_seat_id AND flight_id = p_flight_id FOR UPDATE;
-- → row lock serializes concurrent callers competing for THIS seat
IF NOT v_seat.is_available THEN RAISE EXCEPTION 'SEAT_TAKEN'; END IF;
UPDATE seats   SET is_available = false WHERE id = p_seat_id;
INSERT INTO bookings (..., status='confirmed', total_price, pnr_code) ...;
INSERT INTO passengers SELECT ... FROM jsonb_array_elements(p_passengers);
```

Two **independent** safeguards:

1. **`SELECT … FOR UPDATE`** — concurrent callers block on the row lock; only the first one through commits, the rest see `is_available = false` and raise `SEAT_TAKEN`.
2. **Partial unique index** on `bookings(seat_id) WHERE status <> 'cancelled' AND seat_id IS NOT NULL` — even if the application layer ever wrote a duplicate directly, Postgres would refuse the second insert.

The 2-hour cancel window is enforced by a **`BEFORE UPDATE` trigger** on `bookings`, not a CHECK (the rule is time-relative — `departs_at - now() < interval '2 hours'`). That makes it the single source of truth: it fires regardless of whether the cancellation came via the RPC, the SQL Editor, or any future code.

---

## Auth

- **Email + password** via Supabase Auth, accessed through `@supabase/ssr`.
- `lib/supabase/server.ts` — `await cookies()`-aware server client (Next 16 requires async cookies).
- `proxy.ts` (formerly `middleware.ts` in Next ≤15) — refreshes the session on every matched request, redirects logged-out users to `/login` *optimistically* (cookie presence only).
- **Authoritative authz** lives in `lib/dal.ts` — `getUser()` is wrapped in React `cache()` so multiple Server Components in one render share a single auth call. Every protected page calls `requireUser()` server-side.

Proxy + DAL together follow Next.js's "data security" recommendation: don't trust the proxy to enforce access, treat it as a fast cookie filter and re-check in the data layer.

---

## PWA

The PWA layer is built on **`@ducanh2912/next-pwa`** (the actively-maintained fork of `next-pwa`), which wraps Google's Workbox. Because the plugin internally uses `workbox-webpack-plugin`, the production build runs on webpack (`next build --webpack`); `next dev` stays on Turbopack and the SW is disabled there.

- `public/manifest.json` — hand-written manifest. Name, short_name, `display: standalone`, theme `#2563eb`, 192/512 + maskable icons.
- `next.config.ts` — `withPWAInit({ dest: "public", register: true, fallbacks: { document: "/offline" }, workboxOptions: { runtimeCaching: [...] } })`. The runtime-caching rules match the brief:
  - **StaleWhileRevalidate** for `/search/*` and `/api/flights*` (search results).
  - **CacheFirst** for `/_next/static/*`, `/icons/*`, fonts, and common image/font extensions.
  - **NetworkFirst** for `/bookings` so the page stays current online but the last-good HTML serves when offline.
  - `additionalManifestEntries` precaches `/offline` and `/bookings` at SW install.
- Generated artefacts (gitignored): `public/sw.js`, `public/workbox-*.js`, `public/fallback-*.js`.
- `components/pwa/InstallPrompt.tsx` — captures `beforeinstallprompt`, dismissible banner stored in `localStorage`.
- `scripts/generate-icons.mjs` — regenerate the three PNGs from inline SVG with sharp.

### How to test the PWA

```bash
npm run build && npm run start
```

1. DevTools → **Application → Service Workers** — `sw.js` activated.
2. Visit a route — see `skybook-v1-nav`, `skybook-v1-static`, `skybook-v1-data` caches populate.
3. DevTools → **Network → Offline**, reload `/bookings` — last-cached HTML serves.
4. Navigate to an unknown URL while offline — `/offline` page renders.
5. **Lighthouse → PWA audit** — see screenshot below.

> Lighthouse screenshot: _add `docs/lighthouse.png` after running the audit_

---

## Deploy (Vercel)

```bash
# from this directory, signed into Vercel
vercel
```

In the Vercel project settings:

- **Environment variables**: copy `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from `.env.local`.
- **Framework preset**: Next.js (auto-detected).
- **Build command**: `next build` (default — Turbopack is automatic).

After deploy, in your Supabase project's **Authentication → URL Configuration**, add your Vercel URL to *Site URL* and *Redirect URLs* so email-confirm links work.

---

## Trade-offs and known simplifications

These were conscious calls given the deadline; documented here per the brief's request.

- **Production build on webpack.** `@ducanh2912/next-pwa` wraps `workbox-webpack-plugin`, so `next build --webpack` is required. Dev still runs on Turbopack, so the slower bundler only kicks in for `npm run build` / `npm run start`.
- **PNR generation is server-side** inside `reserve_seat` (retry loop on unique-violation). The client-side `generatePnr()` in `lib/pnr.ts` is only used for display fallbacks and tests.
- **Reschedule drops the seat assignment** (`seat_id = null` after reschedule). A real implementation would let the user re-pick a seat on the new flight; we just free the old seat and consider the new booking seatless. The booking remains valid because of the partial unique index condition (`seat_id IS NOT NULL`). Documented in the reschedule confirmation toast.
- **Multi-passenger single-seat bookings.** The schema permits N passengers per booking but only one `seat_id` per booking row. The form collects N passengers' details (per the brief), but they all share one seat on this flight. Real-world: one booking → N seats, modeled as a `booking_seats` join table.
- **Persisting the session token in Zustand is redundant** with Supabase's cookie-based auth, and slightly increases the XSS attack surface (localStorage is reachable from any same-origin JS). Done because the brief specifies "persist only the session token". Real session enforcement still happens via the Supabase httpOnly auth cookies.
- **Offline cache leaks across browser users.** A device shared between two people who both use the app could see each other's last-cached `/bookings`. Standard PWA caveat; would mitigate with `Cache-Control: private, no-store` on `/bookings` once a "log out → clear caches" hook is wired.
- **Search results filter `departs_at >= chosen date`** rather than exact-day match. With the seeded data that's mostly indistinguishable; with real data, an "exact day" toggle is one extra `lte` filter.
- **Proxy is optimistic only** by Next 16 design — real authz is in `lib/dal.ts:requireUser()`.

### If I had more time

- A `booking_seats` join table for true multi-passenger bookings.
- Seat re-selection on reschedule (with the same `FOR UPDATE` race protection).
- Server-side log-out hook that clears the `nav` cache entries for the previous user.
- Generated Supabase types via `supabase gen types typescript` instead of hand-written `lib/types.ts`.
- Playwright E2E tests for the booking + cancel flows (the trickiest paths).
- A nicer install-prompt heuristic — currently it appears whenever the browser fires `beforeinstallprompt`; should also dismiss for users who've already installed.

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Run the production build locally |
| `npm run lint` | ESLint |
| `node scripts/generate-icons.mjs` | Regenerate PWA icons |

---

## License

MIT — internship technical assignment.
