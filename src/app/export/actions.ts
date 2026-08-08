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

  const [{ data: ingredients }, { data: purchases }, { data: recipes }, { data: sopSteps }] =
    await Promise.all([
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
    ]);

  const stripJoinKey = (rows: Record<string, unknown>[] | null) =>
    (rows ?? []).map(({ ingredients: _ingredients, recipes: _recipes, ...rest }) => rest);

  return {
    ingredientsCsv: toCsv(ingredients ?? []),
    purchasesCsv: toCsv(stripJoinKey(purchases as Record<string, unknown>[] | null)),
    recipesCsv: toCsv(recipes ?? []),
    sopStepsCsv: toCsv(stripJoinKey(sopSteps as Record<string, unknown>[] | null)),
  };
}
