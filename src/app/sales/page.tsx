import { getRecipes } from "@/lib/data/recipes";
import { getSales } from "@/lib/data/sales";
import { SaleForm } from "./sale-form";
import { SaleListRow } from "./sale-list";

export default async function SalesPage() {
  const [recipes, sales] = await Promise.all([getRecipes(), getSales()]);

  return (
    <div className="space-y-4">
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
              <SaleListRow key={s.id} sale={s} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
