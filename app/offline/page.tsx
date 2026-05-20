import Link from "next/link";

export const metadata = {
  title: "Offline — SkyBook",
};

export default function OfflinePage() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-3xl">
        ✈
      </div>
      <h1 className="text-2xl font-bold">You&apos;re offline</h1>
      <p className="mt-2 text-sm text-muted">
        We can&apos;t reach the network right now. Your previously visited
        bookings are still readable.
      </p>
      <Link
        href="/bookings"
        className="mt-6 rounded-lg bg-brand-600 px-5 py-3 text-sm font-medium text-white"
      >
        View cached bookings
      </Link>
    </div>
  );
}
