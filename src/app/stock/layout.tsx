import { PageShell } from "@/components/page-shell";

export default function StockLayout({ children }: { children: React.ReactNode }) {
  return (
    <PageShell title="Stock" subtitle="Ingredients, purchases, and finished goods on hand">
      {children}
    </PageShell>
  );
}
