import { PageShell } from "@/components/page-shell";
import { MakeSwitcher } from "@/components/make-switcher";

export default function RecipesLayout({ children }: { children: React.ReactNode }) {
  return (
    <PageShell title="Make">
      <MakeSwitcher />
      {children}
    </PageShell>
  );
}
