import { getIngredientsWithLastPurchase } from "@/lib/data/ingredients";
import { getFinishedGoodsStock } from "@/lib/data/finished-goods";
import { LowStockRow } from "./low-stock-row";
import { FinishedGoodsRow } from "../finished-goods-row";

export default async function LowStockPage() {
  const [ingredients, finishedGoods] = await Promise.all([
    getIngredientsWithLastPurchase(),
    getFinishedGoodsStock(),
  ]);
  const low = ingredients.filter(
    (i) => i.low_stock_threshold != null && i.qty_on_hand < i.low_stock_threshold
  );
  const lowFinishedGoods = finishedGoods.filter(
    (fg) => fg.low_stock_threshold != null && fg.qty_on_hand < fg.low_stock_threshold
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-text-secondary">
        Ingredients and bottled recipes below their low-stock threshold. Set or edit a threshold
        from the{" "}
        <a href="/stock" className="underline">
          Stock
        </a>{" "}
        tab or right here.
      </p>

      {low.length === 0 && lowFinishedGoods.length === 0 ? (
        <p className="py-8 text-center text-sm text-text-secondary">
          Nothing is low right now.
        </p>
      ) : (
        <>
          {lowFinishedGoods.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-secondary">
                Bottles
              </p>
              <ul className="rounded-2xl border border-border bg-surface px-4 shadow-sm">
                {lowFinishedGoods.map((fg) => (
                  <FinishedGoodsRow key={fg.id} item={fg} />
                ))}
              </ul>
            </div>
          )}
          {low.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-secondary">
                Ingredients
              </p>
              <ul className="rounded-2xl border border-border bg-surface px-4 shadow-sm">
                {low.map((ingredient) => (
                  <LowStockRow key={ingredient.id} ingredient={ingredient} />
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      <div className="pt-2">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-secondary">
          All thresholds
        </p>
        {finishedGoods.length > 0 && (
          <ul className="mb-3 rounded-2xl border border-border bg-surface px-4 shadow-sm">
            {finishedGoods.map((fg) => (
              <FinishedGoodsRow key={fg.id} item={fg} />
            ))}
          </ul>
        )}
        <ul className="rounded-2xl border border-border bg-surface px-4 shadow-sm">
          {ingredients.map((ingredient) => (
            <LowStockRow key={ingredient.id} ingredient={ingredient} />
          ))}
        </ul>
      </div>
    </div>
  );
}
