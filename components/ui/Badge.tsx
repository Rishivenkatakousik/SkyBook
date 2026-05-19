import { cn } from "@/lib/utils";
import type { BookingStatus } from "@/lib/types";

const statusStyles: Record<BookingStatus, string> = {
  confirmed: "bg-success/10 text-success",
  rescheduled: "bg-warning/10 text-warning",
  cancelled: "bg-muted/15 text-muted",
};

export function StatusBadge({ status }: { status: BookingStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize",
        statusStyles[status],
      )}
    >
      {status}
    </span>
  );
}

export function Badge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700",
        className,
      )}
    >
      {children}
    </span>
  );
}
