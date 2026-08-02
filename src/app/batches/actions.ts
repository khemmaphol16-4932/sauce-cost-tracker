"use server";

import { createClient } from "@/lib/supabase/server";
import { getRecipeDetail } from "@/lib/data/recipes";
import { calcRecipeCost } from "@/lib/costing";
import { revalidatePath } from "next/cache";

export async function logBatch(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const recipeId = String(formData.get("recipe_id"));
  if (!recipeId) throw new Error("Pick a recipe");

  const detail = await getRecipeDetail(recipeId);
  if (!detail) throw new Error("Recipe not found");

  const cost = calcRecipeCost(
    detail.recipe,
    detail.ingredients.map((i) => ({ qty_used: i.qty_used, avg_price_per_unit: i.avg_price_per_unit })),
    detail.packaging.map((p) => ({ cost_per_unit: p.cost_per_unit }))
  );

  const overrideRaw = String(formData.get("actual_yield_bottles") ?? "").trim();
  const actualYieldBottles = overrideRaw ? Number(overrideRaw) : cost.bottlesPerBatch;

  const batchDateRaw = String(formData.get("batch_date") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  const { error } = await supabase.from("batches").insert({
    user_id: user.id,
    recipe_id: recipeId,
    batch_date: batchDateRaw || undefined,
    actual_yield_bottles: actualYieldBottles,
    notes: notes || null,
    cost_per_bottle_snapshot: cost.costPerBottle,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/batches");
  revalidatePath("/stock");
  revalidatePath("/stock/low");
}
