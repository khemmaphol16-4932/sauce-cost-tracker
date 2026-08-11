import { Nav } from "@/components/nav";

export default function StockLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-bg">
      <Nav />
      <div className="mx-auto max-w-2xl px-4 py-4 pb-[calc(5rem+env(safe-area-inset-bottom))]">
        {children}
      </div>
    </div>
  );
}
