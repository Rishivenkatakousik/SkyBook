import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { FlightCard } from "@/components/results/FlightCard";
import type { Flight } from "@/lib/types";

export default async function ResultsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const origin = String(sp.origin ?? "");
  const destination = String(sp.destination ?? "");
  const date = String(sp.date ?? "");
  const pax = Number(sp.pax ?? 1);

  const supabase = await createClient();

  // Flights on the selected route departing on/after the chosen date.
  // (On-or-after rather than exact-day so seeded demo flights are findable —
  // documented as a deliberate simplification in the README.)
  let query = supabase
    .from("flights")
    .select("*")
    .eq("origin", origin)
    .eq("destination", destination)
    .neq("status", "cancelled")
    .order("departs_at", { ascending: true });

  if (date) query = query.gte("departs_at", new Date(date).toISOString());

  const { data: flights } = await query;
  const list = (flights ?? []) as Flight[];

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">
            {origin} → {destination}
          </h1>
          <p className="text-sm text-muted">
            {date && `From ${date} · `}
            {pax} passenger{pax > 1 ? "s" : ""} · {list.length} flight
            {list.length === 1 ? "" : "s"}
          </p>
        </div>
        <Link href="/" className="text-sm font-medium text-brand-600">
          Modify search
        </Link>
      </div>

      {list.length === 0 ? (
        <div className="rounded-2xl bg-surface p-10 text-center text-muted shadow-sm">
          No flights found for this route. Try a different date or route.
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {list.map((f) => (
            <li key={f.id}>
              <FlightCard flight={f} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
