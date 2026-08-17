import { PageShell } from "@/components/page-shell";

export default function RecipesLayout({ children }: { children: React.ReactNode }) {
  return <PageShell title="Recipes">{children}</PageShell>;
}
