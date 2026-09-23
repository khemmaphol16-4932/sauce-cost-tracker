import { PageShell } from "@/components/page-shell";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <PageShell title="Home">{children}</PageShell>;
}
