import { PageShell } from "@/components/page-shell";

export default function ClosingLayout({ children }: { children: React.ReactNode }) {
  return (
    <PageShell title="Daily closing" subtitle="Count the drawer, compare to expected cash">
      {children}
    </PageShell>
  );
}
