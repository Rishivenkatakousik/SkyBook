import { createClient } from "@/lib/supabase/server";
import { SearchForm } from "@/components/search/SearchForm";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: flights } = await supabase
    .from("flights")
    .select("origin, destination");

  const origins = [...new Set((flights ?? []).map((f) => f.origin))].sort();
  const destinations = [
    ...new Set((flights ?? []).map((f) => f.destination)),
  ].sort();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-4 py-12 sm:py-20">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Where are you flying?
        </h1>
        <p className="mt-2 text-muted">
          Search live flights, pick your seat, and manage bookings.
        </p>
      </div>
      <div className="mt-8 w-full max-w-2xl">
        <SearchForm origins={origins} destinations={destinations} />
      </div>
    </div>
  );
}
