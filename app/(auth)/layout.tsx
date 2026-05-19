export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4">
      <div className="mb-6 text-center">
        <span className="text-2xl font-bold tracking-tight text-brand-600">
          ✈ SkyBook
        </span>
      </div>
      {children}
    </div>
  );
}
