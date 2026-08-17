import { PageShell } from "@/components/page-shell";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <PageShell title="Dashboard">{children}</PageShell>;
}
