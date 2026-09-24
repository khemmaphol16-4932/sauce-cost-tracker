import { PageShell } from "@/components/page-shell";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <PageShell title="Shop & label" subtitle="What prints on the receipt you stick on each bag">
      {children}
    </PageShell>
  );
}
