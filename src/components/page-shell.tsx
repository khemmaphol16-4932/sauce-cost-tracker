import { Nav } from "@/components/nav";

export function PageShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-bg">
      <Nav />
      <div className="mx-auto max-w-2xl px-4 py-4 pb-[calc(5rem+env(safe-area-inset-bottom))]">
        <div className="mb-4">
          <h1 className="text-2xl font-bold tracking-tight text-text">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-text-secondary">{subtitle}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}
