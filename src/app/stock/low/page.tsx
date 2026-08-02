import { getIngredientsWithLastPurchase } from "@/lib/data/ingredients";
import { LowStockRow } from "./low-stock-row";

export default async function LowStockPage() {
  const ingredients = await getIngredientsWithLastPurchase();
  const low = ingredients.filter(
    (i) => i.low_stock_threshold != null && i.qty_on_hand < i.low_stock_threshold
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-text-secondary">
        Ingredients below their low-stock threshold. Set or edit a threshold from the{" "}
        <a href="/stock" className="underline">
          Stock
        </a>{" "}
        tab or right here.
      </p>

      {low.length === 0 ? (
        <p className="py-8 text-center text-sm text-text-secondary">
          Nothing is low right now.
        </p>
      ) : (
        <ul className="rounded-2xl border border-border bg-surface px-4 shadow-sm">
          {low.map((ingredient) => (
            <LowStockRow key={ingredient.id} ingredient={ingredient} />
          ))}
        </ul>
      )}

      <div className="pt-2">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-secondary">
          All thresholds
        </p>
        <ul className="rounded-2xl border border-border bg-surface px-4 shadow-sm">
          {ingredients.map((ingredient) => (
            <LowStockRow key={ingredient.id} ingredient={ingredient} />
          ))}
        </ul>
      </div>
    </div>
  );
}
