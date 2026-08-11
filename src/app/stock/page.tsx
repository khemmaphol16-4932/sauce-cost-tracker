import Link from "next/link";
import { getIngredientsWithLastPurchase } from "@/lib/data/ingredients";
import { IngredientRow } from "./ingredient-row";
import { AddIngredientButton } from "./add-ingredient-button";

export default async function StockPage() {
  const ingredients = await getIngredientsWithLastPurchase();
  const lowStockCount = ingredients.filter(
    (i) => i.low_stock_threshold != null && i.qty_on_hand < i.low_stock_threshold
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <AddIngredientButton />
        </div>
        {lowStockCount > 0 && (
          <Link
            href="/stock/low"
            className="shrink-0 rounded-xl border border-alert/40 bg-alert-bg px-4 py-3 text-sm font-medium text-alert"
          >
            {lowStockCount} low stock
          </Link>
        )}
      </div>

      {ingredients.length === 0 ? (
        <p className="py-8 text-center text-sm text-text-secondary">
          No ingredients yet. Add your first one above.
        </p>
      ) : (
        <ul className="rounded-2xl border border-border bg-surface px-4 shadow-sm">
          {ingredients.map((ingredient) => (
            <IngredientRow key={ingredient.id} ingredient={ingredient} />
          ))}
        </ul>
      )}
    </div>
  );
}
