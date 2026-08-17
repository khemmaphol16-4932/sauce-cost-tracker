import { PageShell } from "@/components/page-shell";

export default function SalesLayout({ children }: { children: React.ReactNode }) {
  return <PageShell title="Sales">{children}</PageShell>;
}
