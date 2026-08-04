"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

type ActionResult = { error: string } | undefined;

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

export async function createRecipe(formData: FormData): Promise<ActionResult> {
  const { supabase, user } = await requireUser();

  const name = String(formData.get("name") ?? "").trim();
  const bottleSizeMl = Number(formData.get("bottle_size_ml"));
  const batchVolumeMl = Number(formData.get("batch_volume_ml"));

  if (!name || !(bottleSizeMl > 0) || !(batchVolumeMl > 0)) {
    return { error: "Name, bottle size, and batch volume are required" };
  }

  const { data, error } = await supabase
    .from("recipes")
    .insert({
      user_id: user.id,
      name,
      bottle_size_ml: bottleSizeMl,
      batch_volume_ml: batchVolumeMl,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  revalidatePath("/recipes");
  redirect(`/recipes/${data.id}`);
}

export async function updateRecipe(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireUser();

  const id = String(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name is required" };

  const { error } = await supabase
    .from("recipes")
    .update({
      name,
      bottle_size_ml: Number(formData.get("bottle_size_ml")),
      batch_volume_ml: Number(formData.get("batch_volume_ml")),
      evaporation_loss_pct: Number(formData.get("evaporation_loss_pct") || 0),
      waste_pct: Number(formData.get("waste_pct") || 0),
      labor_hours_per_batch: Number(formData.get("labor_hours_per_batch") || 0),
      labor_rate_per_hour: Number(formData.get("labor_rate_per_hour") || 0),
      overhead_per_batch: Number(formData.get("overhead_per_batch") || 0),
      platform_fee_pct: Number(formData.get("platform_fee_pct") || 0),
      vat_pct: Number(formData.get("vat_pct") || 0),
      target_sell_price: formData.get("target_sell_price")
        ? Number(formData.get("target_sell_price"))
        : null,
    })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(`/recipes/${id}`);
  revalidatePath("/recipes");
}

export async function deleteRecipe(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const id = String(formData.get("id"));
  const { error } = await supabase.from("recipes").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/recipes");
  redirect("/recipes");
}

export async function addRecipeIngredient(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireUser();

  const recipeId = String(formData.get("recipe_id"));
  const ingredientId = String(formData.get("ingredient_id"));
  const qtyUsed = Number(formData.get("qty_used"));

  if (!ingredientId || !(qtyUsed > 0)) {
    return { error: "Pick an ingredient and a quantity greater than 0" };
  }

  const { error } = await supabase.from("recipe_ingredients").insert({
    recipe_id: recipeId,
    ingredient_id: ingredientId,
    qty_used: qtyUsed,
  });
  if (error) return { error: error.message };

  revalidatePath(`/recipes/${recipeId}`);
}

export async function updateRecipeIngredient(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireUser();

  const id = String(formData.get("id"));
  const recipeId = String(formData.get("recipe_id"));
  const qtyUsed = Number(formData.get("qty_used"));
  if (!(qtyUsed > 0)) return { error: "Quantity must be greater than 0" };

  const { error } = await supabase
    .from("recipe_ingredients")
    .update({ qty_used: qtyUsed })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(`/recipes/${recipeId}`);
}

export async function removeRecipeIngredient(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const id = String(formData.get("id"));
  const recipeId = String(formData.get("recipe_id"));

  const { error } = await supabase.from("recipe_ingredients").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(`/recipes/${recipeId}`);
}

export async function addPackagingCost(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireUser();

  const recipeId = String(formData.get("recipe_id"));
  const itemName = String(formData.get("item_name") ?? "").trim();
  const costPerUnit = Number(formData.get("cost_per_unit"));

  if (!itemName || !(costPerUnit >= 0)) {
    return { error: "Item name and a valid cost are required" };
  }

  const { error } = await supabase.from("packaging_costs").insert({
    recipe_id: recipeId,
    item_name: itemName,
    cost_per_unit: costPerUnit,
  });
  if (error) return { error: error.message };

  revalidatePath(`/recipes/${recipeId}`);
}

export async function removePackagingCost(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const id = String(formData.get("id"));
  const recipeId = String(formData.get("recipe_id"));

  const { error } = await supabase.from("packaging_costs").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(`/recipes/${recipeId}`);
}

export async function addSopStep(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireUser();

  const recipeId = String(formData.get("recipe_id"));
  const instruction = String(formData.get("instruction") ?? "").trim();
  if (!instruction) return { error: "Step instructions can't be empty" };

  const { data: last, error: lastError } = await supabase
    .from("sop_steps")
    .select("step_order")
    .eq("recipe_id", recipeId)
    .order("step_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastError) return { error: lastError.message };

  const nextOrder = (last?.step_order ?? 0) + 1;

  const { error } = await supabase.from("sop_steps").insert({
    recipe_id: recipeId,
    step_order: nextOrder,
    instruction,
  });
  if (error) return { error: error.message };

  revalidatePath(`/recipes/${recipeId}`);
}

export async function updateSopStep(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireUser();

  const id = String(formData.get("id"));
  const recipeId = String(formData.get("recipe_id"));
  const instruction = String(formData.get("instruction") ?? "").trim();
  if (!instruction) return { error: "Step instructions can't be empty" };

  const { error } = await supabase.from("sop_steps").update({ instruction }).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(`/recipes/${recipeId}`);
}

export async function removeSopStep(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const id = String(formData.get("id"));
  const recipeId = String(formData.get("recipe_id"));

  const { error } = await supabase.from("sop_steps").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(`/recipes/${recipeId}`);
}
