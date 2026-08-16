import { createClient } from "@/lib/supabase/server";
import { getCurrentBusinessId } from "@/lib/data/businesses";

export type IngredientWithLastPurchase = {
  id: string;
  name: string;
  unit: string;
  qty_on_hand: number;
  avg_price_per_unit: number;
  low_stock_threshold: number | null;
  last_purchase_date: string | null;
  price_jump_pct: number | null;
};

const PRICE_JUMP_ALERT_PCT = 15;

export async function getIngredientsWithLastPurchase(): Promise<
  IngredientWithLastPurchase[]
> {
  const supabase = await createClient();
  const businessId = await getCurrentBusinessId();

  const { data: ingredients, error: ingredientsError } = await supabase
    .from("ingredients")
    .select("*")
    .eq("business_id", businessId)
    .order("name", { ascending: true });
  if (ingredientsError) throw new Error(ingredientsError.message);

  const ingredientIds = (ingredients ?? []).map((i) => i.id);

  const { data: purchases, error: purchasesError } =
    ingredientIds.length === 0
      ? { data: [], error: null }
      : await supabase
          .from("purchases")
          .select("ingredient_id, purchase_date, qty_bought, price_paid_total, created_at")
          .in("ingredient_id", ingredientIds)
          .order("purchase_date", { ascending: true })
          .order("created_at", { ascending: true });
  if (purchasesError) throw new Error(purchasesError.message);

  const lastPurchaseByIngredient = new Map<string, string>();
  const purchasesByIngredient = new Map<
    string,
    { qty_bought: number; price_paid_total: number }[]
  >();
  for (const p of purchases ?? []) {
    const current = lastPurchaseByIngredient.get(p.ingredient_id);
    if (!current || p.purchase_date > current) {
      lastPurchaseByIngredient.set(p.ingredient_id, p.purchase_date);
    }
    const list = purchasesByIngredient.get(p.ingredient_id) ?? [];
    list.push({ qty_bought: p.qty_bought, price_paid_total: p.price_paid_total });
    purchasesByIngredient.set(p.ingredient_id, list);
  }

  return (ingredients ?? []).map((i) => {
    const history = purchasesByIngredient.get(i.id) ?? [];
    let price_jump_pct: number | null = null;
    if (history.length >= 2) {
      const latest = history[history.length - 1];
      const previous = history[history.length - 2];
      const latestUnitPrice = latest.qty_bought > 0 ? latest.price_paid_total / latest.qty_bought : 0;
      const previousUnitPrice =
        previous.qty_bought > 0 ? previous.price_paid_total / previous.qty_bought : 0;
      if (previousUnitPrice > 0) {
        const jump = ((latestUnitPrice - previousUnitPrice) / previousUnitPrice) * 100;
        if (jump >= PRICE_JUMP_ALERT_PCT) price_jump_pct = jump;
      }
    }
    return {
      ...i,
      last_purchase_date: lastPurchaseByIngredient.get(i.id) ?? null,
      price_jump_pct,
    };
  });
}

export type IngredientOption = {
  id: string;
  name: string;
  unit: string;
  avg_price_per_unit: number;
};

export async function getIngredientOptions(): Promise<IngredientOption[]> {
  const supabase = await createClient();
  const businessId = await getCurrentBusinessId();
  const { data, error } = await supabase
    .from("ingredients")
    .select("id, name, unit, avg_price_per_unit")
    .eq("business_id", businessId)
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

// Picklist source for the "brand" field on a purchase — grouped by
// ingredient so the Stock page can hand each IngredientRow just its own list.
export async function getIngredientBrandsByIngredient(): Promise<Map<string, string[]>> {
  const supabase = await createClient();
  const businessId = await getCurrentBusinessId();

  const { data, error } = await supabase
    .from("ingredient_brands")
    .select("ingredient_id, name, ingredients!inner(business_id)")
    .eq("ingredients.business_id", businessId)
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);

  const byIngredient = new Map<string, string[]>();
  for (const row of data ?? []) {
    const list = byIngredient.get(row.ingredient_id) ?? [];
    list.push(row.name);
    byIngredient.set(row.ingredient_id, list);
  }
  return byIngredient;
}
