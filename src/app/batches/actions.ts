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

  const { data: batch, error } = await supabase
    .from("batches")
    .insert({
      user_id: user.id,
      recipe_id: recipeId,
      batch_date: batchDateRaw || undefined,
      actual_yield_bottles: actualYieldBottles,
      notes: notes || null,
      cost_per_bottle_snapshot: cost.costPerBottle,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  if (detail.ingredients.length > 0) {
    const { error: usageError } = await supabase.from("batch_ingredient_usage").insert(
      detail.ingredients.map((i) => ({
        batch_id: batch.id,
        ingredient_id: i.ingredient_id,
        qty_used: i.qty_used,
      }))
    );
    if (usageError) return { error: usageError.message };
  }

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
    const { error: adjustError } = await supabase.rpc("adjust_finished_goods_stock", {
      p_recipe_id: existing.recipe_id,
      p_delta: delta,
    });
    if (adjustError) return { error: adjustError.message };
  }

  revalidatePath("/batches");
  revalidatePath("/stock");
}

export async function deleteBatch(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const id = String(formData.get("id"));

  const { data: existing, error: fetchError } = await supabase
    .from("batches")
    .select("recipe_id, actual_yield_bottles")
    .eq("id", id)
    .maybeSingle();
  if (fetchError) return { error: fetchError.message };
  if (!existing) return { error: "Batch not found" };

  const yielded = existing.actual_yield_bottles ?? 0;

  // Block deletion if some of this batch's bottles were already sold — you
  // can't un-produce stock that's no longer there.
  const { data: stock, error: stockError } = await supabase
    .from("finished_goods_stock")
    .select("qty_on_hand")
    .eq("recipe_id", existing.recipe_id)
    .maybeSingle();
  if (stockError) return { error: stockError.message };

  const available = stock?.qty_on_hand ?? 0;
  if (yielded > 0 && available < yielded) {
    return {
      error: `Can't delete this batch: ${(yielded - available).toFixed(0)} of its ${yielded} bottles have already been sold`,
    };
  }

  // Restore the raw ingredients this batch used, from the snapshot taken
  // when the batch was logged — NOT today's recipe_ingredients, which may
  // have been edited since (that would restore the wrong amounts).
  const { data: usage, error: usageError } = await supabase
    .from("batch_ingredient_usage")
    .select("ingredient_id, qty_used")
    .eq("batch_id", id);
  if (usageError) return { error: usageError.message };

  const ingredientIds = (usage ?? []).map((u) => u.ingredient_id);
  if (ingredientIds.length > 0) {
    const { data: ingredients, error: ingredientsError } = await supabase
      .from("ingredients")
      .select("id, qty_on_hand")
      .in("id", ingredientIds);
    if (ingredientsError) return { error: ingredientsError.message };

    const qtyById = new Map((ingredients ?? []).map((i) => [i.id, i.qty_on_hand]));
    for (const u of usage ?? []) {
      const current = qtyById.get(u.ingredient_id) ?? 0;
      const { error: restoreError } = await supabase
        .from("ingredients")
        .update({ qty_on_hand: current + u.qty_used })
        .eq("id", u.ingredient_id);
      if (restoreError) return { error: restoreError.message };
    }
  }

  // Reverse the finished-goods credit this batch made.
  if (yielded > 0 && stock) {
    const { error: adjustError } = await supabase.rpc("adjust_finished_goods_stock", {
      p_recipe_id: existing.recipe_id,
      p_delta: -yielded,
    });
    if (adjustError) return { error: adjustError.message };
  }

  const { error } = await supabase.from("batches").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/batches");
  revalidatePath("/stock");
  revalidatePath("/stock/low");
}
