import { createClient } from "@/lib/supabase/server";
import { getCurrentBusinessId } from "@/lib/data/businesses";
import { getRecipes } from "@/lib/data/recipes";

export type SaleRow = {
  id: string;
  recipe_name: string;
  qty_bottles: number;
  price_charged_total: number;
  platform: string;
  payment_status: string;
  payment_method: string | null;
  sale_date: string;
  cost_per_bottle_snapshot: number | null;
  customer_ref: string | null;
  notes: string | null;
};

// The Sell page re-renders after every checkout, so this runs on each save —
// it used to pull the whole sales history. Older sales are still in Export.
export const SALES_HISTORY_LIMIT = 100;

export async function getSales(): Promise<SaleRow[]> {
  const supabase = await createClient();
  const businessId = await getCurrentBusinessId();

  const { data, error } = await supabase
    .from("sales")
    .select(
      "id, qty_bottles, price_charged_total, platform, payment_status, payment_method, sale_date, cost_per_bottle_snapshot, customer_ref, notes, recipes(name)"
    )
    .eq("business_id", businessId)
    .order("sale_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(SALES_HISTORY_LIMIT);
  if (error) throw new Error(error.message);

  type Raw = {
    id: string;
    qty_bottles: number;
    price_charged_total: number;
    platform: string;
    payment_status: string;
    payment_method: string | null;
    sale_date: string;
    cost_per_bottle_snapshot: number | null;
    customer_ref: string | null;
    notes: string | null;
    recipes: { name: string } | null;
  };

  return ((data ?? []) as unknown as Raw[]).map((s) => ({
    id: s.id,
    recipe_name: s.recipes?.name ?? "(deleted recipe)",
    qty_bottles: s.qty_bottles,
    price_charged_total: s.price_charged_total,
    platform: s.platform,
    payment_status: s.payment_status,
    payment_method: s.payment_method,
    sale_date: s.sale_date,
    cost_per_bottle_snapshot: s.cost_per_bottle_snapshot,
    customer_ref: s.customer_ref,
    notes: s.notes,
  }));
}

export type QuickSellDefaults = {
  recipeId: string;
  recipeName: string;
  unitPrice: number;
  platform: string;
  platformFeePct: number;
};

const RECENT_SALES_FOR_DEFAULTS = 200;

type LastSale = { unitPrice: number; platform: string; platformFeePct: number };
type SaleDefaultsRow = {
  recipe_id: string;
  qty_bottles: number;
  price_charged_total: number;
  platform: string;
  platform_fee_pct: number | null;
};

function toLastSale(s: SaleDefaultsRow): LastSale {
  return {
    unitPrice: s.qty_bottles > 0 ? s.price_charged_total / s.qty_bottles : 0,
    platform: s.platform,
    platformFeePct: s.platform_fee_pct ?? 0,
  };
}

// One row per recipe: pricing from the most recent sale if there is one,
// otherwise the recipe's target_sell_price at 0% fee (self-sell) as a
// starting point for recipes that have never been sold yet.
//
// Reads only the latest few hundred sales (usually covers every recipe), then
// looks up the rare recipe not in that window with a 1-row query each —
// instead of downloading the full history on every page load and save.
export async function getQuickSellDefaults(): Promise<QuickSellDefaults[]> {
  const supabase = await createClient();
  const businessId = await getCurrentBusinessId();
  const columns = "recipe_id, qty_bottles, price_charged_total, platform, platform_fee_pct";

  const [recipes, { data: recentSales, error }] = await Promise.all([
    getRecipes(),
    supabase
      .from("sales")
      .select(columns)
      .eq("business_id", businessId)
      .order("sale_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(RECENT_SALES_FOR_DEFAULTS),
  ]);
  if (error) throw new Error(error.message);

  const lastByRecipe = new Map<string, LastSale>();
  for (const s of (recentSales ?? []) as SaleDefaultsRow[]) {
    if (!lastByRecipe.has(s.recipe_id)) lastByRecipe.set(s.recipe_id, toLastSale(s));
  }

  // Only when the window was full can an older sale exist for a missing recipe.
  if ((recentSales ?? []).length === RECENT_SALES_FOR_DEFAULTS) {
    const missing = recipes.filter((r) => !lastByRecipe.has(r.id));
    const older = await Promise.all(
      missing.map((r) =>
        supabase
          .from("sales")
          .select(columns)
          .eq("business_id", businessId)
          .eq("recipe_id", r.id)
          .order("sale_date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      )
    );
    for (const { data, error: olderError } of older) {
      if (olderError) throw new Error(olderError.message);
      if (data) lastByRecipe.set(data.recipe_id, toLastSale(data as SaleDefaultsRow));
    }
  }

  return recipes.map((r) => {
    const last = lastByRecipe.get(r.id);
    return {
      recipeId: r.id,
      recipeName: r.name,
      unitPrice: last?.unitPrice ?? r.target_sell_price ?? 0,
      platform: last?.platform ?? "self",
      platformFeePct: last?.platformFeePct ?? 0,
    };
  });
}
