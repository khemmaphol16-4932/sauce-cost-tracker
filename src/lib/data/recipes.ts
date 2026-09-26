import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentBusinessId } from "@/lib/data/businesses";

export type RecipeSummary = {
  id: string;
  name: string;
  bottle_size_ml: number;
  target_sell_price: number | null;
};

// cache(): the Sell page calls this directly and again via getQuickSellDefaults.
export const getRecipes = cache(async (): Promise<RecipeSummary[]> => {
  const supabase = await createClient();
  const businessId = await getCurrentBusinessId();
  const { data, error } = await supabase
    .from("recipes")
    .select("id, name, bottle_size_ml, target_sell_price")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
});

export type RecipeDetail = {
  id: string;
  name: string;
  bottle_size_ml: number;
  target_sell_price: number | null;
  platform_fee_pct: number;
  vat_pct: number;
  labor_hours_per_batch: number;
  labor_rate_per_hour: number;
  overhead_per_batch: number;
  waste_pct: number;
  evaporation_loss_pct: number;
  batch_volume_ml: number;
};

export type RecipeIngredientRow = {
  id: string;
  ingredient_id: string;
  qty_used: number;
  ingredient_name: string;
  ingredient_unit: string;
  avg_price_per_unit: number;
};

export type PackagingCostRow = {
  id: string;
  item_name: string;
  cost_per_unit: number;
};

export type SopStepRow = {
  id: string;
  step_order: number;
  instruction: string;
};

export async function getRecipeDetail(id: string): Promise<{
  recipe: RecipeDetail;
  ingredients: RecipeIngredientRow[];
  packaging: PackagingCostRow[];
  sopSteps: SopStepRow[];
} | null> {
  const supabase = await createClient();
  const businessId = await getCurrentBusinessId();

  const [
    { data: recipe, error: recipeError },
    { data: recipeIngredients, error: riError },
    { data: packaging, error: pkgError },
    { data: sopSteps, error: sopError },
  ] = await Promise.all([
    supabase.from("recipes").select("*").eq("id", id).eq("business_id", businessId).maybeSingle(),
    supabase
      .from("recipe_ingredients")
      .select("id, ingredient_id, qty_used, ingredients(name, unit, avg_price_per_unit)")
      .eq("recipe_id", id),
    supabase.from("packaging_costs").select("*").eq("recipe_id", id),
    supabase
      .from("sop_steps")
      .select("id, step_order, instruction")
      .eq("recipe_id", id)
      .order("step_order", { ascending: true }),
  ]);

  if (recipeError) throw new Error(recipeError.message);
  if (riError) throw new Error(riError.message);
  if (pkgError) throw new Error(pkgError.message);
  if (sopError) throw new Error(sopError.message);
  if (!recipe) return null;

  type RawRecipeIngredient = {
    id: string;
    ingredient_id: string;
    qty_used: number;
    ingredients: { name: string; unit: string; avg_price_per_unit: number } | null;
  };

  const ingredients: RecipeIngredientRow[] = ((recipeIngredients ?? []) as unknown as RawRecipeIngredient[]).map(
    (ri) => ({
      id: ri.id,
      ingredient_id: ri.ingredient_id,
      qty_used: ri.qty_used,
      ingredient_name: ri.ingredients?.name ?? "(deleted ingredient)",
      ingredient_unit: ri.ingredients?.unit ?? "",
      avg_price_per_unit: ri.ingredients?.avg_price_per_unit ?? 0,
    })
  );

  return { recipe, ingredients, packaging: packaging ?? [], sopSteps: sopSteps ?? [] };
}
