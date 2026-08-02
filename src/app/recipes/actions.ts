"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

export async function createRecipe(formData: FormData) {
  const { supabase, user } = await requireUser();

  const name = String(formData.get("name") ?? "").trim();
  const bottleSizeMl = Number(formData.get("bottle_size_ml"));
  const batchVolumeMl = Number(formData.get("batch_volume_ml"));

  if (!name || !(bottleSizeMl > 0) || !(batchVolumeMl > 0)) {
    throw new Error("Name, bottle size, and batch volume are required");
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
  if (error) throw new Error(error.message);

  revalidatePath("/recipes");
  redirect(`/recipes/${data.id}`);
}

export async function updateRecipe(formData: FormData) {
  const { supabase } = await requireUser();

  const id = String(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Name is required");

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
      target_sell_price: formData.get("target_sell_price")
        ? Number(formData.get("target_sell_price"))
        : null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath(`/recipes/${id}`);
  revalidatePath("/recipes");
}

export async function deleteRecipe(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("id"));
  const { error } = await supabase.from("recipes").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/recipes");
  redirect("/recipes");
}

export async function addRecipeIngredient(formData: FormData) {
  const { supabase } = await requireUser();

  const recipeId = String(formData.get("recipe_id"));
  const ingredientId = String(formData.get("ingredient_id"));
  const qtyUsed = Number(formData.get("qty_used"));

  if (!ingredientId || !(qtyUsed > 0)) {
    throw new Error("Pick an ingredient and a quantity greater than 0");
  }

  const { error } = await supabase.from("recipe_ingredients").insert({
    recipe_id: recipeId,
    ingredient_id: ingredientId,
    qty_used: qtyUsed,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/recipes/${recipeId}`);
}

export async function updateRecipeIngredient(formData: FormData) {
  const { supabase } = await requireUser();

  const id = String(formData.get("id"));
  const recipeId = String(formData.get("recipe_id"));
  const qtyUsed = Number(formData.get("qty_used"));
  if (!(qtyUsed > 0)) throw new Error("Quantity must be greater than 0");

  const { error } = await supabase
    .from("recipe_ingredients")
    .update({ qty_used: qtyUsed })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath(`/recipes/${recipeId}`);
}

export async function removeRecipeIngredient(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("id"));
  const recipeId = String(formData.get("recipe_id"));

  const { error } = await supabase.from("recipe_ingredients").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath(`/recipes/${recipeId}`);
}

export async function addPackagingCost(formData: FormData) {
  const { supabase } = await requireUser();

  const recipeId = String(formData.get("recipe_id"));
  const itemName = String(formData.get("item_name") ?? "").trim();
  const costPerUnit = Number(formData.get("cost_per_unit"));

  if (!itemName || !(costPerUnit >= 0)) {
    throw new Error("Item name and a valid cost are required");
  }

  const { error } = await supabase.from("packaging_costs").insert({
    recipe_id: recipeId,
    item_name: itemName,
    cost_per_unit: costPerUnit,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/recipes/${recipeId}`);
}

export async function removePackagingCost(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("id"));
  const recipeId = String(formData.get("recipe_id"));

  const { error } = await supabase.from("packaging_costs").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath(`/recipes/${recipeId}`);
}
