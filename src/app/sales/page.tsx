import { getRecipes } from "@/lib/data/recipes";
import { getSales, getQuickSellDefaults } from "@/lib/data/sales";
import { getCurrentBusiness } from "@/lib/data/businesses";
import { QuickSell } from "./quick-sell";
import { SaleForm } from "./sale-form";
import { SaleListRow } from "./sale-list";

export default async function SalesPage() {
  const [recipes, sales, quickSellDefaults, business] = await Promise.all([
    getRecipes(),
    getSales(),
    getQuickSellDefaults(),
    getCurrentBusiness(),
  ]);
  const businessName = business?.name ?? "Ordexa";

  return (
    <div className="space-y-4">
      <QuickSell defaults={quickSellDefaults} />

      <SaleForm recipes={recipes.map((r) => ({ id: r.id, name: r.name }))} />

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-secondary">
          Sales history
        </p>
        {sales.length === 0 ? (
          <p className="py-4 text-center text-sm text-text-secondary">No sales logged yet.</p>
        ) : (
          <ul className="rounded-2xl border border-border bg-surface px-4 shadow-sm">
            {sales.map((s) => (
              <SaleListRow key={s.id} sale={s} businessName={businessName} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
