import { createClient } from "@/lib/supabase/server";
import { getCurrentBusinessId } from "@/lib/data/businesses";

export type BatchHistoryRow = {
  id: string;
  batch_date: string;
  recipe_name: string;
  actual_yield_bottles: number | null;
  cost_per_bottle_snapshot: number | null;
  notes: string | null;
};

export type RecipeYieldActuals = {
  recipe_id: string;
  actual_yield_bottles: number;
  batch_count: number;
};

export async function getYieldActualsByRecipe(): Promise<RecipeYieldActuals[]> {
  const supabase = await createClient();
  const businessId = await getCurrentBusinessId();
  const { data, error } = await supabase
    .from("batches")
    .select("recipe_id, actual_yield_bottles, recipes!inner(business_id)")
    .eq("recipes.business_id", businessId)
    .not("actual_yield_bottles", "is", null);
  if (error) throw new Error(error.message);

  const byRecipe = new Map<string, { sum: number; count: number }>();
  for (const row of data ?? []) {
    const entry = byRecipe.get(row.recipe_id) ?? { sum: 0, count: 0 };
    entry.sum += row.actual_yield_bottles as number;
    entry.count += 1;
    byRecipe.set(row.recipe_id, entry);
  }

  return Array.from(byRecipe.entries()).map(([recipe_id, { sum, count }]) => ({
    recipe_id,
    actual_yield_bottles: sum / count,
    batch_count: count,
  }));
}

export async function getBatchHistory(): Promise<BatchHistoryRow[]> {
  const supabase = await createClient();
  const businessId = await getCurrentBusinessId();
  const { data, error } = await supabase
    .from("batches")
    .select(
      "id, batch_date, actual_yield_bottles, cost_per_bottle_snapshot, notes, recipes!inner(name, business_id)"
    )
    .eq("recipes.business_id", businessId)
    .order("batch_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  type Raw = {
    id: string;
    batch_date: string;
    actual_yield_bottles: number | null;
    cost_per_bottle_snapshot: number | null;
    notes: string | null;
    recipes: { name: string } | null;
  };

  return ((data ?? []) as unknown as Raw[]).map((b) => ({
    id: b.id,
    batch_date: b.batch_date,
    actual_yield_bottles: b.actual_yield_bottles,
    cost_per_bottle_snapshot: b.cost_per_bottle_snapshot,
    notes: b.notes,
    recipe_name: b.recipes?.name ?? "(deleted recipe)",
  }));
}
