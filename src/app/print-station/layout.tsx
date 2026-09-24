import { PageShell } from "@/components/page-shell";

export default function PrintStationLayout({ children }: { children: React.ReactNode }) {
  return (
    <PageShell title="Print station" subtitle="Keep this open on the shop computer — labels print by themselves">
      {children}
    </PageShell>
  );
}
