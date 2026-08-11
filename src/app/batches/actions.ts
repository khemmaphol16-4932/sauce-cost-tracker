"use server";

import { createClient } from "@/lib/supabase/server";
import { getRecipeDetail } from "@/lib/data/recipes";
import { calcRecipeCost } from "@/lib/costing";
import { revalidatePath } from "next/cache";

type ActionResult = { error: string } | undefined;

export async function logBatch(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const recipeId = String(formData.get("recipe_id"));
  if (!recipeId) return { error: "Pick a recipe" };

  const detail = await getRecipeDetail(recipeId);
  if (!detail) return { error: "Recipe not found" };

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
  if (error) return { error: error.message };

  revalidatePath("/batches");
  revalidatePath("/stock");
  revalidatePath("/stock/low");
}

export async function updateBatch(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const id = String(formData.get("id"));
  const batchDateRaw = String(formData.get("batch_date") ?? "").trim();
  const yieldRaw = String(formData.get("actual_yield_bottles") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const newYield = Number(yieldRaw);

  if (!batchDateRaw || !(newYield > 0)) {
    return { error: "Date and a bottle yield greater than 0 are required" };
  }

  const { data: existing, error: fetchError } = await supabase
    .from("batches")
    .select("recipe_id, actual_yield_bottles")
    .eq("id", id)
    .maybeSingle();
  if (fetchError) return { error: fetchError.message };
  if (!existing) return { error: "Batch not found" };

  const { error } = await supabase
    .from("batches")
    .update({
      batch_date: batchDateRaw,
      actual_yield_bottles: newYield,
      notes: notes || null,
    })
    .eq("id", id);
  if (error) return { error: error.message };

  const oldYield = existing.actual_yield_bottles ?? 0;
  const delta = newYield - oldYield;
  if (delta !== 0) {
    const { data: stock, error: stockError } = await supabase
      .from("finished_goods_stock")
      .select("qty_on_hand")
      .eq("recipe_id", existing.recipe_id)
      .maybeSingle();
    if (stockError) return { error: stockError.message };

    if (stock) {
      const { error: adjustError } = await supabase
        .from("finished_goods_stock")
        .update({ qty_on_hand: stock.qty_on_hand + delta })
        .eq("recipe_id", existing.recipe_id);
      if (adjustError) return { error: adjustError.message };
    } else {
      const { error: insertError } = await supabase
        .from("finished_goods_stock")
        .insert({ user_id: user.id, recipe_id: existing.recipe_id, qty_on_hand: Math.max(0, delta) });
      if (insertError) return { error: insertError.message };
    }
  }

  revalidatePath("/batches");
  revalidatePath("/stock");
}
