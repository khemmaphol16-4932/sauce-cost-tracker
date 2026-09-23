import { PageShell } from "@/components/page-shell";

export default function SalesLayout({ children }: { children: React.ReactNode }) {
  return <PageShell title="Sell">{children}</PageShell>;
}
