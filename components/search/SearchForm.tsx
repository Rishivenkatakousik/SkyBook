"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { searchSchema, type SearchInput } from "@/lib/validation";
import { useFlightStore } from "@/stores/useFlightStore";
import { Button } from "@/components/ui/Button";

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

  const selectCls =
    "h-11 rounded-lg border border-border bg-surface px-3 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20";

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="grid grid-cols-1 gap-4 rounded-2xl bg-surface p-6 shadow-sm sm:grid-cols-2"
    >
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">From</span>
        <select className={selectCls} {...register("origin")}>
          {origins.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        {errors.origin && (
          <span className="text-xs text-danger">{errors.origin.message}</span>
        )}
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">To</span>
        <select className={selectCls} {...register("destination")}>
          {destinations.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        {errors.destination && (
          <span className="text-xs text-danger">
            {errors.destination.message}
          </span>
        )}
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Departure date</span>
        <input
          type="date"
          min={today}
          className={selectCls}
          {...register("date")}
        />
        {errors.date && (
          <span className="text-xs text-danger">{errors.date.message}</span>
        )}
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Passengers</span>
        <input
          type="number"
          min={1}
          max={9}
          className={selectCls}
          {...register("pax", { valueAsNumber: true })}
        />
        {errors.pax && (
          <span className="text-xs text-danger">{errors.pax.message}</span>
        )}
      </label>

      <Button type="submit" size="lg" className="sm:col-span-2">
        Search flights
      </Button>
    </form>
  );
}
