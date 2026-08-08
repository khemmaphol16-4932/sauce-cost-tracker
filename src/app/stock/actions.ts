"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentBusinessId } from "@/lib/data/businesses";
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

export async function addIngredient(formData: FormData): Promise<ActionResult> {
  const { supabase, user } = await requireUser();

  const name = String(formData.get("name") ?? "").trim();
  const unit = String(formData.get("unit") ?? "").trim();
  const thresholdRaw = String(formData.get("low_stock_threshold") ?? "").trim();

  if (!name || !unit) return { error: "Name and unit are required" };

  const businessId = await getCurrentBusinessId();

  const { error } = await supabase.from("ingredients").insert({
    user_id: user.id,
    business_id: businessId,
    name,
    unit,
    low_stock_threshold: thresholdRaw ? Number(thresholdRaw) : null,
  });
  if (error) return { error: error.message };

  revalidatePath("/stock");
  revalidatePath("/stock/low");
}

export async function updateIngredient(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireUser();

  const id = String(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  const unit = String(formData.get("unit") ?? "").trim();
  const thresholdRaw = String(formData.get("low_stock_threshold") ?? "").trim();

  if (!name || !unit) return { error: "Name and unit are required" };

  const { error } = await supabase
    .from("ingredients")
    .update({
      name,
      unit,
      low_stock_threshold: thresholdRaw ? Number(thresholdRaw) : null,
    })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/stock");
  revalidatePath("/stock/low");
}

export async function updateLowStockThreshold(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireUser();

  const id = String(formData.get("id"));
  const thresholdRaw = String(formData.get("low_stock_threshold") ?? "").trim();

  const { error } = await supabase
    .from("ingredients")
    .update({ low_stock_threshold: thresholdRaw ? Number(thresholdRaw) : null })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/stock");
  revalidatePath("/stock/low");
}

export async function deleteIngredient(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireUser();

  const id = String(formData.get("id"));
  const { error } = await supabase.from("ingredients").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/stock");
  revalidatePath("/stock/low");
}

export async function logPurchase(formData: FormData): Promise<ActionResult> {
  const { supabase, user } = await requireUser();

  const ingredientId = String(formData.get("ingredient_id"));
  const qtyBought = Number(formData.get("qty_bought"));
  const pricePaidTotal = Number(formData.get("price_paid_total"));
  const purchaseDateRaw = String(formData.get("purchase_date") ?? "").trim();

  if (!ingredientId || !(qtyBought > 0) || !(pricePaidTotal >= 0)) {
    return { error: "Valid ingredient, quantity, and price are required" };
  }

  const { error } = await supabase.from("purchases").insert({
    user_id: user.id,
    ingredient_id: ingredientId,
    qty_bought: qtyBought,
    price_paid_total: pricePaidTotal,
    purchase_date: purchaseDateRaw || undefined,
  });
  if (error) return { error: error.message };

  revalidatePath("/stock");
  revalidatePath("/stock/low");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
