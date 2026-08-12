"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentBusinessId } from "@/lib/data/businesses";

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(","));
  }
  return lines.join("\n");
}

export async function getExportCsvs() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const businessId = await getCurrentBusinessId();

  const [
    { data: ingredients },
    { data: purchases },
    { data: recipes },
    { data: sopSteps },
    { data: batches },
    { data: recipeIngredients },
    { data: packagingCosts },
    { data: sopStepTemplates },
    { data: sales },
    { data: finishedGoodsStock },
    { data: expenses },
  ] = await Promise.all([
    supabase
      .from("ingredients")
      .select("id, name, unit, qty_on_hand, avg_price_per_unit, low_stock_threshold, created_at")
      .eq("business_id", businessId)
      .order("name"),
    supabase
      .from("purchases")
      .select(
        "id, ingredient_id, qty_bought, price_paid_total, purchase_date, created_at, ingredients!inner(business_id)"
      )
      .eq("ingredients.business_id", businessId)
      .order("purchase_date", { ascending: false }),
    supabase
      .from("recipes")
      .select(
        "id, name, bottle_size_ml, batch_volume_ml, target_sell_price, platform_fee_pct, vat_pct, labor_hours_per_batch, labor_rate_per_hour, overhead_per_batch, waste_pct, evaporation_loss_pct, created_at"
      )
      .eq("business_id", businessId)
      .order("name"),
    supabase
      .from("sop_steps")
      .select("id, recipe_id, step_order, instruction, created_at, recipes!inner(business_id)")
      .eq("recipes.business_id", businessId)
      .order("recipe_id")
      .order("step_order"),
    supabase
      .from("batches")
      .select(
        "id, recipe_id, batch_date, actual_yield_bottles, notes, cost_per_bottle_snapshot, created_at, recipes!inner(business_id)"
      )
      .eq("recipes.business_id", businessId)
      .order("batch_date", { ascending: false }),
    supabase
      .from("recipe_ingredients")
      .select("id, recipe_id, ingredient_id, qty_used, recipes!inner(business_id)")
      .eq("recipes.business_id", businessId),
    supabase
      .from("packaging_costs")
      .select("id, recipe_id, item_name, cost_per_unit, recipes!inner(business_id)")
      .eq("recipes.business_id", businessId),
    // sop_step_templates has no business_id column (shared across a user's
    // businesses today, a known gap) — scoped by RLS (user_id) only.
    supabase.from("sop_step_templates").select("id, instruction, created_at").order("created_at"),
    supabase
      .from("sales")
      .select(
        "id, recipe_id, qty_bottles, price_charged_total, platform, platform_fee_pct, payment_status, payment_method, sale_date, cost_per_bottle_snapshot, notes, created_at"
      )
      .eq("business_id", businessId)
      .order("sale_date", { ascending: false }),
    supabase
      .from("finished_goods_stock")
      .select("id, recipe_id, qty_on_hand, low_stock_threshold, created_at, recipes!inner(business_id)")
      .eq("recipes.business_id", businessId),
    supabase
      .from("expenses")
      .select("id, category, description, amount, expense_date, created_at")
      .eq("business_id", businessId)
      .order("expense_date", { ascending: false }),
  ]);

  const stripJoinKey = (rows: Record<string, unknown>[] | null) =>
    (rows ?? []).map(({ ingredients: _ingredients, recipes: _recipes, ...rest }) => rest);

  return {
    ingredientsCsv: toCsv(ingredients ?? []),
    purchasesCsv: toCsv(stripJoinKey(purchases as Record<string, unknown>[] | null)),
    recipesCsv: toCsv(recipes ?? []),
    sopStepsCsv: toCsv(stripJoinKey(sopSteps as Record<string, unknown>[] | null)),
    batchesCsv: toCsv(stripJoinKey(batches as Record<string, unknown>[] | null)),
    recipeIngredientsCsv: toCsv(stripJoinKey(recipeIngredients as Record<string, unknown>[] | null)),
    packagingCostsCsv: toCsv(stripJoinKey(packagingCosts as Record<string, unknown>[] | null)),
    sopStepTemplatesCsv: toCsv(sopStepTemplates ?? []),
    salesCsv: toCsv(sales ?? []),
    finishedGoodsStockCsv: toCsv(stripJoinKey(finishedGoodsStock as Record<string, unknown>[] | null)),
    expensesCsv: toCsv(expenses ?? []),
  };
}
