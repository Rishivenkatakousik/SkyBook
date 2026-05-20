"use client";

import { useTransition } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { passengerSchema } from "@/lib/validation";
import { useFlightStore } from "@/stores/useFlightStore";
import { createBooking } from "@/app/booking/[flightId]/actions";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { formatPrice } from "@/lib/utils";

const formSchema = z.object({ passengers: z.array(passengerSchema).min(1) });
type FormValues = z.infer<typeof formSchema>;

export function PassengerForm({ flightId }: { flightId: string }) {
  const [pending, startTransition] = useTransition();
  const pax = useFlightStore((s) => s.searchQuery?.pax ?? 1);
  const selectedSeat = useFlightStore((s) => s.selectedSeat);
  const selectedFlight = useFlightStore((s) => s.selectedFlight);
  const setPassengers = useFlightStore((s) => s.setPassengers);

  const { register, control, handleSubmit, formState } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      passengers: Array.from({ length: pax }, () => ({
        full_name: "",
        passport_no: "",
        nationality: "",
        dob: "",
      })),
    },
  });
  const { fields } = useFieldArray({ control, name: "passengers" });

  const total =
    (selectedFlight?.base_price ?? 0) + (selectedSeat?.extra_fee ?? 0);

  const onSubmit = (values: FormValues) => {
    if (!selectedSeat) {
      toast.error("Please select a seat first.");
      return;
    }
    setPassengers(values.passengers);
    startTransition(async () => {
      const res = await createBooking({
        flightId,
        seatId: selectedSeat.id,
        passengers: values.passengers,
      });
      if (res?.error) toast.error(res.error);
    });
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-6 rounded-2xl bg-surface p-6 shadow-sm"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Passenger details</h3>
        <span className="text-sm text-muted">
          Seat{" "}
          <strong className="text-foreground">
            {selectedSeat?.seat_number ?? "—"}
          </strong>
        </span>
      </div>

      {fields.map((field, i) => (
        <fieldset
          key={field.id}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        >
          <legend className="mb-2 text-xs font-medium text-muted">
            Passenger {i + 1}
          </legend>
          <Input
            label="Full name"
            {...register(`passengers.${i}.full_name`)}
            error={formState.errors.passengers?.[i]?.full_name?.message}
          />
          <Input
            label="Passport number"
            {...register(`passengers.${i}.passport_no`)}
            error={formState.errors.passengers?.[i]?.passport_no?.message}
          />
          <Input
            label="Nationality"
            {...register(`passengers.${i}.nationality`)}
            error={formState.errors.passengers?.[i]?.nationality?.message}
          />
          <Input
            type="date"
            label="Date of birth"
            {...register(`passengers.${i}.dob`)}
            error={formState.errors.passengers?.[i]?.dob?.message}
          />
        </fieldset>
      ))}

      <div className="flex items-center justify-between border-t border-border pt-4">
        <span className="text-sm text-muted">Total</span>
        <span className="text-xl font-bold">{formatPrice(total)}</span>
      </div>

      <Button type="submit" size="lg" disabled={pending || !selectedSeat}>
        {pending && <Spinner className="h-4 w-4" />}
        Confirm booking
      </Button>
    </form>
  );
}
