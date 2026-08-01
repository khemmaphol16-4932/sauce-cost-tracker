import { StockNav } from "@/components/stock-nav";

export default function StockLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-neutral-50">
      <StockNav />
      <div className="mx-auto max-w-2xl px-4 py-4">{children}</div>
    </div>
  );
}
