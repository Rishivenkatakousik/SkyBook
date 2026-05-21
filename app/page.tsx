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
    <section className="relative flex flex-1 flex-col overflow-hidden bg-gradient-to-br from-[#EEF4FF] via-[#F5F8FF] to-white">

      {/* Organic blur blobs — purely decorative */}
      <div aria-hidden="true" className="pointer-events-none select-none">
        <div className="absolute -right-20 -top-36 h-[580px] w-[580px] rounded-full bg-indigo-100/55 blur-[110px]" />
        <div className="absolute -bottom-20 -left-16 h-[400px] w-[400px] rounded-full bg-violet-100/40 blur-[95px]" />
        <div className="absolute left-1/3 top-1/3 h-[260px] w-[260px] rounded-full bg-blue-100/30 blur-[80px]" />
      </div>

      {/* Content */}
      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col px-5 lg:px-10">

        {/* Hero — split layout */}
        <div className="flex-1 grid grid-cols-1 items-center gap-4 py-8 lg:grid-cols-[1.15fr_0.85fr] lg:gap-0 lg:py-0">

          {/* ── Left: airplane ── */}
          <div className="order-2 flex items-center justify-center lg:order-1 lg:justify-start">
            <div className="relative w-full max-w-[460px] lg:max-w-none">
              {/* Indigo glow halo behind plane */}
              <div
                aria-hidden="true"
                className="absolute left-1/2 top-1/2 h-[280px] w-[280px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-200/40 blur-[55px] lg:h-[360px] lg:w-[360px]"
              />
              <img
                src="/flight.png"
                alt="Commercial airplane in flight"
                className="relative w-full rounded-2xl object-cover motion-safe:animate-float"
                style={{ filter: "drop-shadow(0px 24px 48px rgba(0,0,0,0.18))" }}
              />
            </div>
          </div>

          {/* ── Right: heading + stats ── */}
          <div className="order-1 flex flex-col justify-center space-y-5 text-center lg:order-2 lg:pl-8 lg:text-left xl:pl-14">

            {/* "Now Boarding" badge */}
            <div className="inline-flex items-center gap-2 self-center rounded-full border border-indigo-100 bg-indigo-50/80 px-4 py-1.5 lg:self-start motion-safe:animate-fade-up">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 motion-safe:animate-pulse" />
              <span className="text-[11px] font-semibold uppercase tracking-widest text-indigo-600">
                Now Boarding
              </span>
            </div>

            {/* Main heading */}
            <h1
              className="text-[2.6rem] font-extrabold leading-[1.04] tracking-[-0.03em] text-gray-950 motion-safe:animate-fade-up lg:text-5xl xl:text-[3.5rem]"
              style={{ animationDelay: "80ms" }}
            >
              Your Ticket
              <br className="hidden lg:block" /> to Explore
              <br className="hidden lg:block" /> the World
            </h1>

            {/* Subtitle */}
            <p
              className="mx-auto max-w-[340px] text-base leading-relaxed text-gray-500 motion-safe:animate-fade-up lg:mx-0"
              style={{ animationDelay: "160ms" }}
            >
              Discover the world at your fingertips. Our flight booking opens
              doors to global destinations with convenience and ease.
            </p>

            {/* Stats row */}
            <div
              className="flex items-center justify-center gap-5 motion-safe:animate-fade-up lg:justify-start"
              style={{ animationDelay: "240ms" }}
            >
              <div className="text-center lg:text-left">
                <div className="text-xl font-extrabold text-gray-900">500+</div>
                <div className="mt-0.5 text-xs text-gray-400">Destinations</div>
              </div>
              <div className="h-8 w-px bg-gray-200" />
              <div className="text-center lg:text-left">
                <div className="text-xl font-extrabold text-gray-900">2M+</div>
                <div className="mt-0.5 text-xs text-gray-400">Travelers</div>
              </div>
              <div className="h-8 w-px bg-gray-200" />
              <div className="text-center lg:text-left">
                <div className="text-xl font-extrabold text-gray-900">24/7</div>
                <div className="mt-0.5 text-xs text-gray-400">Support</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Floating search card ── */}
        <div
          className="pb-10 motion-safe:animate-fade-up lg:pb-14"
          style={{ animationDelay: "320ms" }}
        >
          <SearchForm origins={origins} destinations={destinations} />
        </div>

      </div>
    </section>
  );
}
