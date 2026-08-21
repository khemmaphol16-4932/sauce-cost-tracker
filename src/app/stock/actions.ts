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

const NEW_BRAND_VALUE = "__new__";

export async function logPurchase(formData: FormData): Promise<ActionResult> {
  const { supabase, user } = await requireUser();

  const ingredientId = String(formData.get("ingredient_id"));
  const qtyBought = Number(formData.get("qty_bought"));
  const pricePaidTotal = Number(formData.get("price_paid_total"));
  const purchaseDateRaw = String(formData.get("purchase_date") ?? "").trim();
  const brandSelect = String(formData.get("brand") ?? "").trim();
  const newBrand = String(formData.get("new_brand") ?? "").trim();

  if (!ingredientId || !(qtyBought > 0) || !(pricePaidTotal >= 0)) {
    return { error: "Valid ingredient, quantity, and price are required" };
  }

  let brand: string | null = null;
  if (brandSelect === NEW_BRAND_VALUE) {
    if (!newBrand) return { error: "Enter a name for the new brand" };
    brand = newBrand;

    const { data: existingBrand, error: existingBrandError } = await supabase
      .from("ingredient_brands")
      .select("name")
      .eq("ingredient_id", ingredientId)
      .ilike("name", newBrand)
      .maybeSingle();
    if (existingBrandError) return { error: existingBrandError.message };

    if (existingBrand) {
      brand = existingBrand.name;
    } else {
      const { error: brandError } = await supabase
        .from("ingredient_brands")
        .insert({ user_id: user.id, ingredient_id: ingredientId, name: newBrand });
      if (brandError) return { error: brandError.message };
    }
  } else if (brandSelect) {
    brand = brandSelect;
  }

  const { error } = await supabase.from("purchases").insert({
    user_id: user.id,
    ingredient_id: ingredientId,
    qty_bought: qtyBought,
    price_paid_total: pricePaidTotal,
    purchase_date: purchaseDateRaw || undefined,
    brand,
  });
  if (error) return { error: error.message };

  revalidatePath("/stock");
  revalidatePath("/stock/low");
  revalidatePath("/financials/purchases");
}

// Records a physical stock count. The operator enters what they actually
// counted; the RPC derives the delta from the live row and writes both the
// stock change and its ledger entry in one transaction. Deliberately never
// touches avg_price_per_unit — that is exactly the property the "log a ฿1
// purchase to fix the count" workaround violated.
export async function adjustIngredientStock(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireUser();

  const ingredientId = String(formData.get("ingredient_id"));
  const countedQty = Number(formData.get("counted_qty"));
  const reason = String(formData.get("reason") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const adjustmentDateRaw = String(formData.get("adjustment_date") ?? "").trim();

  if (!ingredientId) return { error: "Pick an ingredient" };
  if (!Number.isFinite(countedQty) || countedQty < 0) {
    return { error: "Enter the quantity you counted (0 or more)" };
  }
  if (!reason) return { error: "Pick a reason" };

  const { error } = await supabase.rpc("adjust_ingredient_stock", {
    p_ingredient_id: ingredientId,
    p_counted_qty: countedQty,
    p_reason: reason,
    p_notes: notes || null,
    p_adjustment_date: adjustmentDateRaw || undefined,
  });
  if (error) return { error: error.message };

  revalidatePath("/stock");
  revalidatePath("/stock/low");
  revalidatePath("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
