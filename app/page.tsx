import Image from "next/image";
import { SearchForm } from "@/components/search/SearchForm";
import { getAirports } from "@/lib/airports";

export default async function HomePage() {
  const { origins, destinations } = await getAirports();

  return (
    <section className="relative flex flex-1 flex-col overflow-hidden bg-gradient-to-br from-[#EEF4FF] via-[#F5F8FF] to-white">

      {/* Organic blur blobs — purely decorative */}
      <div aria-hidden="true" className="pointer-events-none select-none">
        <div className="absolute -right-20 -top-36 h-[320px] w-[320px] rounded-full bg-indigo-100/55 blur-[90px] sm:h-[460px] sm:w-[460px] lg:h-[580px] lg:w-[580px] lg:blur-[110px]" />
        <div className="absolute -bottom-20 -left-16 h-[240px] w-[240px] rounded-full bg-violet-100/40 blur-[80px] sm:h-[320px] sm:w-[320px] lg:h-[400px] lg:w-[400px] lg:blur-[95px]" />
        <div className="absolute left-1/3 top-1/3 hidden h-[260px] w-[260px] rounded-full bg-blue-100/30 blur-[80px] sm:block" />
      </div>

      {/* Content */}
      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 sm:px-6 lg:px-10">

        {/* Hero — split layout */}
        <div className="flex-1 grid grid-cols-1 items-center gap-6 py-6 sm:gap-4 sm:py-8 lg:grid-cols-[1.15fr_0.85fr] lg:gap-0 lg:py-0">

          {/* ── Left: airplane ── */}
          <div className="order-2 flex items-center justify-center lg:order-1 lg:justify-start">
            <div className="relative w-full max-w-[320px] sm:max-w-[420px] lg:max-w-none">
              {/* Indigo glow halo behind plane */}
              <div
                aria-hidden="true"
                className="absolute left-1/2 top-1/2 h-[200px] w-[200px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-200/40 blur-[55px] sm:h-[280px] sm:w-[280px] lg:h-[360px] lg:w-[360px]"
              />
              <Image
                src="/flight.png"
                alt="Commercial airplane in flight"
                width={677}
                height={368}
                sizes="(max-width: 640px) 320px, (max-width: 1024px) 420px, 50vw"
                loading="eager"
                fetchPriority="high"
                className="relative h-auto w-full rounded-2xl object-cover motion-safe:animate-float"
                style={{ filter: "drop-shadow(0px 24px 48px rgba(0,0,0,0.18))" }}
              />
            </div>
          </div>

          {/* ── Right: heading + stats ── */}
          <div className="order-1 flex flex-col justify-center space-y-4 text-center sm:space-y-5 lg:order-2 lg:pl-8 lg:text-left xl:pl-14">

            {/* "Now Boarding" badge */}
            <div className="inline-flex items-center gap-2 self-center rounded-full border border-indigo-100 bg-indigo-50/80 px-3 py-1.5 sm:px-4 lg:self-start motion-safe:animate-fade-up">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 motion-safe:animate-pulse" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-indigo-600 sm:text-[11px]">
                Now Boarding
              </span>
            </div>

            {/* Main heading */}
            <h1
              className="text-3xl font-extrabold leading-[1.08] tracking-[-0.03em] text-gray-950 motion-safe:animate-fade-up sm:text-[2.6rem] sm:leading-[1.04] lg:text-5xl xl:text-[3.5rem]"
              style={{ animationDelay: "80ms" }}
            >
              Your Ticket
              <br className="hidden lg:block" /> to Explore
              <br className="hidden lg:block" /> the World
            </h1>

            {/* Subtitle */}
            <p
              className="mx-auto max-w-[340px] text-sm leading-relaxed text-gray-500 motion-safe:animate-fade-up sm:text-base lg:mx-0"
              style={{ animationDelay: "160ms" }}
            >
              Discover the world at your fingertips. Our flight booking opens
              doors to global destinations with convenience and ease.
            </p>

            {/* Stats row */}
            <div
              className="flex flex-wrap items-center justify-center gap-3 motion-safe:animate-fade-up sm:gap-5 lg:justify-start"
              style={{ animationDelay: "240ms" }}
            >
              <div className="text-center lg:text-left">
                <div className="text-lg font-extrabold text-gray-900 sm:text-xl">500+</div>
                <div className="mt-0.5 text-[11px] text-gray-400 sm:text-xs">Destinations</div>
              </div>
              <div className="h-8 w-px bg-gray-200" />
              <div className="text-center lg:text-left">
                <div className="text-lg font-extrabold text-gray-900 sm:text-xl">2M+</div>
                <div className="mt-0.5 text-[11px] text-gray-400 sm:text-xs">Travelers</div>
              </div>
              <div className="h-8 w-px bg-gray-200" />
              <div className="text-center lg:text-left">
                <div className="text-lg font-extrabold text-gray-900 sm:text-xl">24/7</div>
                <div className="mt-0.5 text-[11px] text-gray-400 sm:text-xs">Support</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Floating search card ── */}
        <div
          className="min-h-[460px] pb-8 motion-safe:animate-fade-up sm:min-h-[280px] sm:pb-10 lg:min-h-[180px] lg:pb-14"
          style={{ animationDelay: "320ms" }}
        >
          <SearchForm origins={origins} destinations={destinations} />
        </div>

      </div>
    </section>
  );
}
