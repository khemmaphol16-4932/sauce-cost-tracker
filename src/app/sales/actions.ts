"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentBusinessId } from "@/lib/data/businesses";
import { getRecipeDetail } from "@/lib/data/recipes";
import { calcRecipeCost } from "@/lib/costing";
import { revalidatePath } from "next/cache";

type ActionResult = { error: string } | undefined;

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

export async function logSale(formData: FormData): Promise<ActionResult> {
  const { supabase, user } = await requireUser();

  const recipeId = String(formData.get("recipe_id"));
  if (!recipeId) return { error: "Pick a recipe" };

  const qtyBottles = Number(formData.get("qty_bottles"));
  const priceChargedTotal = Number(formData.get("price_charged_total"));
  if (!(qtyBottles > 0) || !(priceChargedTotal >= 0)) {
    return { error: "Valid quantity and price are required" };
  }

  const platform = String(formData.get("platform") ?? "self").trim() || "self";
  const platformFeeRaw = String(formData.get("platform_fee_pct") ?? "").trim();
  const platformFeePct = platformFeeRaw ? Number(platformFeeRaw) : null;
  const paymentStatus = String(formData.get("payment_status") ?? "paid").trim() || "paid";
  const paymentMethod = String(formData.get("payment_method") ?? "").trim();
  const saleDateRaw = String(formData.get("sale_date") ?? "").trim();
  const customerRef = String(formData.get("customer_ref") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  const detail = await getRecipeDetail(recipeId);
  if (!detail) return { error: "Recipe not found" };

  const cost = calcRecipeCost(
    detail.recipe,
    detail.ingredients.map((i) => ({ qty_used: i.qty_used, avg_price_per_unit: i.avg_price_per_unit })),
    detail.packaging.map((p) => ({ cost_per_unit: p.cost_per_unit }))
  );

  const businessId = await getCurrentBusinessId();

  const { error } = await supabase.from("sales").insert({
    user_id: user.id,
    business_id: businessId,
    recipe_id: recipeId,
    qty_bottles: qtyBottles,
    price_charged_total: priceChargedTotal,
    platform,
    platform_fee_pct: platformFeePct,
    payment_status: paymentStatus,
    payment_method: paymentMethod || null,
    sale_date: saleDateRaw || undefined,
    cost_per_bottle_snapshot: cost.costPerBottle,
    customer_ref: customerRef || null,
    notes: notes || null,
  });
  if (error) return { error: error.message };

  revalidatePath("/sales");
  revalidatePath("/stock");
  revalidatePath("/dashboard");
}

export async function updateSale(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireUser();

  const id = String(formData.get("id"));
  const paymentStatus = String(formData.get("payment_status") ?? "paid").trim() || "paid";
  const paymentMethod = String(formData.get("payment_method") ?? "").trim();
  const saleDateRaw = String(formData.get("sale_date") ?? "").trim();
  const customerRef = String(formData.get("customer_ref") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!saleDateRaw) return { error: "Date is required" };

  // Deliberately never touches qty_bottles or recipe_id — changing quantity
  // after the fact would need the same delta-reconciliation batches' yield
  // edits require; void + re-log is the supported path for that instead.
  const { error } = await supabase
    .from("sales")
    .update({
      payment_status: paymentStatus,
      payment_method: paymentMethod || null,
      sale_date: saleDateRaw,
      customer_ref: customerRef || null,
      notes: notes || null,
    })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/sales");
  revalidatePath("/dashboard");
}

export async function deleteSale(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const id = String(formData.get("id"));

  const { data: sale, error: fetchError } = await supabase
    .from("sales")
    .select("recipe_id, qty_bottles")
    .eq("id", id)
    .maybeSingle();
  if (fetchError) return { error: fetchError.message };
  if (!sale) return { error: "Sale not found" };

  const { error: deleteError } = await supabase.from("sales").delete().eq("id", id);
  if (deleteError) return { error: deleteError.message };

  const { error: creditError } = await supabase.rpc("adjust_finished_goods_stock", {
    p_recipe_id: sale.recipe_id,
    p_delta: sale.qty_bottles,
  });
  if (creditError) return { error: creditError.message };

  revalidatePath("/sales");
  revalidatePath("/stock");
  revalidatePath("/dashboard");
}

export async function updateFinishedGoodsThreshold(formData: FormData): Promise<ActionResult> {
  const { supabase, user } = await requireUser();

  const recipeId = String(formData.get("recipe_id"));
  const thresholdRaw = String(formData.get("low_stock_threshold") ?? "").trim();
  if (!recipeId) return { error: "Recipe is required" };

  const threshold = thresholdRaw ? Number(thresholdRaw) : null;

  const { data: existing, error: fetchError } = await supabase
    .from("finished_goods_stock")
    .select("id")
    .eq("recipe_id", recipeId)
    .maybeSingle();
  if (fetchError) return { error: fetchError.message };

  if (existing) {
    const { error } = await supabase
      .from("finished_goods_stock")
      .update({ low_stock_threshold: threshold })
      .eq("recipe_id", recipeId);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("finished_goods_stock")
      .insert({ user_id: user.id, recipe_id: recipeId, low_stock_threshold: threshold });
    if (error) return { error: error.message };
  }

  revalidatePath("/stock");
  revalidatePath("/stock/low");
}

// Records a physical count of bottles on hand. Takes the counted quantity
// rather than a delta (the operator counts the shelf, not the difference), and
// goes through adjust_finished_goods_counted so the reason is persisted to the
// stock_adjustments ledger — it used to be collected and then thrown away.
export async function adjustFinishedGoods(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireUser();

  const recipeId = String(formData.get("recipe_id"));
  const countedQty = Number(formData.get("counted_qty"));
  const reason = String(formData.get("reason") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const adjustmentDateRaw = String(formData.get("adjustment_date") ?? "").trim();

  if (!recipeId) return { error: "Pick a recipe" };
  if (!Number.isFinite(countedQty) || countedQty < 0) {
    return { error: "Enter the number of bottles you counted (0 or more)" };
  }
  if (!reason) return { error: "Pick a reason" };

  const { error } = await supabase.rpc("adjust_finished_goods_counted", {
    p_recipe_id: recipeId,
    p_counted_qty: countedQty,
    p_reason: reason,
    p_notes: notes || null,
    p_adjustment_date: adjustmentDateRaw || undefined,
  });
  if (error) return { error: error.message };

  revalidatePath("/stock");
  revalidatePath("/stock/low");
  revalidatePath("/sales");
  revalidatePath("/dashboard");
}
