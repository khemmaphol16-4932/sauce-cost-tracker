import { getRecipes } from "@/lib/data/recipes";
import { getSales, getQuickSellDefaults } from "@/lib/data/sales";
import { getCurrentBusiness } from "@/lib/data/businesses";
import { getFinishedGoodsStock } from "@/lib/data/finished-goods";
import { SellCart } from "./sell-cart";
import { SaleForm } from "./sale-form";
import { SaleListRow } from "./sale-list";

export default async function SalesPage() {
  const [recipes, sales, quickSellDefaults, business, finishedGoods] = await Promise.all([
    getRecipes(),
    getSales(),
    getQuickSellDefaults(),
    getCurrentBusiness(),
    getFinishedGoodsStock(),
  ]);
  const businessName = business?.name ?? "Ordexa";
  const stockByRecipe = new Map(finishedGoods.map((fg) => [fg.recipe_id, fg.qty_on_hand]));
  // No finished_goods_stock row yet reads as 0 — the sale trigger rejects
  // those too, so the tile shows "Out" rather than failing at checkout.
  const tiles = quickSellDefaults.map((d) => ({
    ...d,
    inStock: stockByRecipe.get(d.recipeId) ?? 0,
  }));

  return (
    <div className="space-y-4">
      <SellCart tiles={tiles} />

      {recipes.length > 0 && (
        <details className="card group">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-sm font-medium text-text">
            Custom sale
            <span className="text-xs font-normal text-text-secondary group-open:hidden">
              other date, pending payment, odd quantity…
            </span>
          </summary>
          <div className="mt-3">
            <SaleForm recipes={recipes.map((r) => ({ id: r.id, name: r.name }))} />
          </div>
        </details>
      )}

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
