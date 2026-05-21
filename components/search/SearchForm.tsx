"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { searchSchema, type SearchInput } from "@/lib/validation";
import { useFlightStore } from "@/stores/useFlightStore";
import {
  PlaneTakeoff,
  PlaneLanding,
  Calendar,
  Users,
  ArrowRight,
  ChevronDown,
} from "lucide-react";

const today = new Date().toISOString().slice(0, 10);

export function SearchForm({
  origins,
  destinations,
}: {
  origins: string[];
  destinations: string[];
}) {
  const router = useRouter();
  const setSearchQuery = useFlightStore((s) => s.setSearchQuery);
  const saved = useFlightStore((s) => s.searchQuery);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SearchInput>({
    resolver: zodResolver(searchSchema),
    defaultValues: {
      origin: saved?.origin ?? origins[0] ?? "",
      destination: saved?.destination ?? destinations[1] ?? "",
      date: saved?.date ?? today,
      pax: saved?.pax ?? 1,
    },
  });

  const onSubmit = (data: SearchInput) => {
    setSearchQuery(data);
    const params = new URLSearchParams({
      origin: data.origin,
      destination: data.destination,
      date: data.date,
      pax: String(data.pax),
    });
    router.push(`/search/results?${params.toString()}`);
  };

  const fieldCls = "flex flex-col gap-1.5";
  const labelCls =
    "flex items-center gap-1.5 px-0.5 text-[11px] font-semibold uppercase tracking-wider text-indigo-500";
  const iconCls = "h-3.5 w-3.5 shrink-0";
  const inputCls =
    "h-12 w-full rounded-xl border-0 bg-gray-50/80 px-4 text-sm font-medium text-gray-900 outline-none transition-all focus:bg-white focus:ring-2 focus:ring-indigo-500/20";
  const selectCls = `${inputCls} appearance-none cursor-pointer pr-9`;
  const errorCls = "px-0.5 text-xs text-danger";

  return (
    <div className="rounded-3xl border border-white/60 bg-white/85 p-6 shadow-2xl shadow-indigo-100/30 backdrop-blur-2xl lg:p-7">
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">

          {/* ── Four input fields ── */}
          <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">

            {/* From */}
            <div className={fieldCls}>
              <span className={labelCls}>
                <PlaneTakeoff className={iconCls} />
                From
              </span>
              <div className="relative">
                <select className={selectCls} {...register("origin")}>
                  {origins.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              </div>
              {errors.origin && (
                <span className={errorCls}>{errors.origin.message}</span>
              )}
            </div>

            {/* To */}
            <div className={fieldCls}>
              <span className={labelCls}>
                <PlaneLanding className={iconCls} />
                To
              </span>
              <div className="relative">
                <select className={selectCls} {...register("destination")}>
                  {destinations.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              </div>
              {errors.destination && (
                <span className={errorCls}>{errors.destination.message}</span>
              )}
            </div>

            {/* Departure date */}
            <div className={fieldCls}>
              <span className={labelCls}>
                <Calendar className={iconCls} />
                Departure
              </span>
              <input
                type="date"
                min={today}
                className={`${inputCls} [color-scheme:light]`}
                {...register("date")}
              />
              {errors.date && (
                <span className={errorCls}>{errors.date.message}</span>
              )}
            </div>

            {/* Passengers */}
            <div className={fieldCls}>
              <span className={labelCls}>
                <Users className={iconCls} />
                Passengers
              </span>
              <input
                type="number"
                min={1}
                max={9}
                className={inputCls}
                {...register("pax", { valueAsNumber: true })}
              />
              {errors.pax && (
                <span className={errorCls}>{errors.pax.message}</span>
              )}
            </div>
          </div>

          {/* ── Search button ── */}
          <button
            type="submit"
            className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-8 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all duration-200 hover:scale-[1.02] hover:shadow-indigo-500/40 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-indigo-600 lg:shrink-0"
          >
            Search flights
            <ArrowRight className="h-4 w-4" />
          </button>

        </div>
      </form>
    </div>
  );
}
