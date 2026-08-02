import { getRecipes, getRecipeDetail } from "@/lib/data/recipes";
import { getBatchHistory } from "@/lib/data/batches";
import { calcRecipeCost } from "@/lib/costing";
import { LogBatchForm } from "./log-batch-form";
import { BatchHistoryRow } from "./batch-history-row";

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
              <BatchHistoryRow key={b.id} batch={b} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
