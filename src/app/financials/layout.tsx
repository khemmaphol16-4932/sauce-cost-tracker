import { PageShell } from "@/components/page-shell";

export default function FinancialsLayout({ children }: { children: React.ReactNode }) {
  return (
    <PageShell title="Financials" subtitle="Buying, expenses, and profit at a glance">
      {children}
    </PageShell>
  );
}
