import { PageShell } from "@/components/page-shell";

export default function MoreLayout({ children }: { children: React.ReactNode }) {
  return <PageShell title="More">{children}</PageShell>;
}
