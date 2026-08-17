import { getRecipes, getRecipeDetail } from "@/lib/data/recipes";
import { getBatchHistory, getYieldActualsByRecipe } from "@/lib/data/batches";
import { calcRecipeCost } from "@/lib/costing";
import { LogBatchForm } from "./log-batch-form";
import { BatchHistoryRow } from "./batch-history-row";
import { YieldVarianceCard } from "./yield-variance-card";

export default async function BatchesPage() {
  const allRecipes = await getRecipes();
  const recipeSummaries = allRecipes.filter((r) => !r.is_made_to_order);

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
      const sopSteps = detail?.sopSteps.map((s) => ({ id: s.id, instruction: s.instruction })) ?? [];
      return { id: r.id, name: r.name, estimatedBottles, sopSteps };
    })
  );

  const yieldActuals = await getYieldActualsByRecipe();
  const yieldVariance = recipes
    .map((r) => {
      const actual = yieldActuals.find((y) => y.recipe_id === r.id);
      if (!actual || r.estimatedBottles <= 0) return null;
      const variancePct =
        ((actual.actual_yield_bottles - r.estimatedBottles) / r.estimatedBottles) * 100;
      return {
        recipeId: r.id,
        recipeName: r.name,
        estimatedBottles: r.estimatedBottles,
        avgActualBottles: actual.actual_yield_bottles,
        batchCount: actual.batch_count,
        variancePct,
      };
    })
    .filter((v): v is NonNullable<typeof v> => v !== null);

  const history = await getBatchHistory();

  return (
    <div className="space-y-4">
      <LogBatchForm recipes={recipes} />

      {yieldVariance.length > 0 && <YieldVarianceCard rows={yieldVariance} />}

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
