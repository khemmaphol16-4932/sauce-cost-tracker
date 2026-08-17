import { PageShell } from "@/components/page-shell";

export default function ExportLayout({ children }: { children: React.ReactNode }) {
  return <PageShell title="Export">{children}</PageShell>;
}
