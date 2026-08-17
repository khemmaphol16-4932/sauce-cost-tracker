import { PageShell } from "@/components/page-shell";

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  return (
    <PageShell title="Analytics" subtitle="Repeat customers, peak hours, and waste">
      {children}
    </PageShell>
  );
}
