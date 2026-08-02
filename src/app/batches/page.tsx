import { getRecipes, getRecipeDetail } from "@/lib/data/recipes";
import { getBatchHistory } from "@/lib/data/batches";
import { calcRecipeCost } from "@/lib/costing";
import { LogBatchForm } from "./log-batch-form";

export default async function BatchesPage() {
  const recipeSummaries = await getRecipes();

  const recipes = await Promise.all(
    recipeSummaries.map(async (r) => {
      const detail = await getRecipeDetail(r.id);
      const estimatedBottles = detail
        ? calcRecipeCost(
            detail.recipe,
            detail.ingredients.map((i) => ({
              qty_used: i.qty_used,
              avg_price_per_unit: i.avg_price_per_unit,
            })),
            detail.packaging.map((p) => ({ cost_per_unit: p.cost_per_unit }))
          ).bottlesPerBatch
        : 0;
      return { id: r.id, name: r.name, estimatedBottles };
    })
  );

  const history = await getBatchHistory();

  return (
    <div className="space-y-4">
      <LogBatchForm recipes={recipes} />

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-secondary">
          Batch history
        </p>
        {history.length === 0 ? (
          <p className="py-4 text-center text-sm text-text-secondary">No batches logged yet.</p>
        ) : (
          <ul className="rounded-2xl border border-border bg-surface px-4 shadow-sm">
            {history.map((b) => (
              <li key={b.id} className="border-b border-border py-3 last:border-0">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-text">{b.recipe_name}</span>
                  <span className="text-xs text-text-secondary">{b.batch_date}</span>
                </div>
                <p className="mt-0.5 text-xs text-text-secondary">
                  {b.actual_yield_bottles ?? "?"} bottles
                  {b.cost_per_bottle_snapshot != null && (
                    <> · ฿{b.cost_per_bottle_snapshot.toFixed(2)}/bottle at the time</>
                  )}
                </p>
                {b.notes && <p className="mt-1 text-sm text-text-secondary">{b.notes}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
