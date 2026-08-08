import { createClient } from "@/lib/supabase/server";
import { getCurrentBusinessId } from "@/lib/data/businesses";
import { getRecipes, getRecipeDetail } from "@/lib/data/recipes";
import { calcRecipeCost } from "@/lib/costing";

export type MonthlySpend = { month: string; total: number };
export type RecipeMargin = {
  id: string;
  name: string;
  marginPct: number;
  indicator: "red" | "yellow" | "green";
};
export type RecentPurchase = {
  id: string;
  ingredient_name: string;
  qty_bought: number;
  price_paid_total: number;
  purchase_date: string;
};
export type RecentBatch = {
  id: string;
  recipe_name: string;
  batch_date: string;
  actual_yield_bottles: number | null;
  cost_per_bottle_snapshot: number | null;
};

export type DashboardData = {
  ingredientCount: number;
  recipeCount: number;
  batchCount: number;
  totalStockValue: number;
  lowStockCount: number;
  priceJumpCount: number;
  monthlySpend: MonthlySpend[];
  recipeMargins: RecipeMargin[];
  recentPurchases: RecentPurchase[];
  recentBatches: RecentBatch[];
};

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

export async function getDashboardData(): Promise<DashboardData> {
  const supabase = await createClient();
  const businessId = await getCurrentBusinessId();

  const { data: ingredients, error: ingredientsError } = await supabase
    .from("ingredients")
    .select("id, name, qty_on_hand, avg_price_per_unit, low_stock_threshold")
    .eq("business_id", businessId);
  if (ingredientsError) throw new Error(ingredientsError.message);

  const ingredientIds = (ingredients ?? []).map((i) => i.id);
  const ingredientNameById = new Map((ingredients ?? []).map((i) => [i.id, i.name]));

  const totalStockValue = (ingredients ?? []).reduce(
    (sum, i) => sum + i.qty_on_hand * i.avg_price_per_unit,
    0
  );
  const lowStockCount = (ingredients ?? []).filter(
    (i) => i.low_stock_threshold != null && i.qty_on_hand < i.low_stock_threshold
  ).length;

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  const sixMonthsAgoStr = sixMonthsAgo.toISOString().slice(0, 10);

  const [{ data: purchases, error: purchasesError }, { data: recentPurchasesRaw, error: recentPurchasesError }] =
    ingredientIds.length === 0
      ? [{ data: [], error: null }, { data: [], error: null }]
      : await Promise.all([
          supabase
            .from("purchases")
            .select("ingredient_id, price_paid_total, purchase_date")
            .in("ingredient_id", ingredientIds)
            .gte("purchase_date", sixMonthsAgoStr),
          supabase
            .from("purchases")
            .select("id, ingredient_id, qty_bought, price_paid_total, purchase_date")
            .in("ingredient_id", ingredientIds)
            .order("purchase_date", { ascending: false })
            .order("created_at", { ascending: false })
            .limit(8),
        ]);
  if (purchasesError) throw new Error(purchasesError.message);
  if (recentPurchasesError) throw new Error(recentPurchasesError.message);

  // Price-jump count reuses the same 15% rule as the Stock page badge.
  const priceJumpCount = await getPriceJumpCount(supabase, ingredientIds);

  const monthlySpend: MonthlySpend[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const label = `${MONTH_LABELS[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`;
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const total = (purchases ?? [])
      .filter((p) => p.purchase_date.slice(0, 7) === monthKey)
      .reduce((sum, p) => sum + p.price_paid_total, 0);
    monthlySpend.push({ month: label, total });
  }

  const recentPurchases: RecentPurchase[] = (recentPurchasesRaw ?? []).map((p) => ({
    id: p.id,
    ingredient_name: ingredientNameById.get(p.ingredient_id) ?? "(deleted ingredient)",
    qty_bought: p.qty_bought,
    price_paid_total: p.price_paid_total,
    purchase_date: p.purchase_date,
  }));

  const recipeSummaries = await getRecipes();
  const recipeMargins: RecipeMargin[] = [];
  for (const r of recipeSummaries) {
    if (r.target_sell_price == null) continue;
    const detail = await getRecipeDetail(r.id);
    if (!detail) continue;
    const cost = calcRecipeCost(
      detail.recipe,
      detail.ingredients.map((i) => ({ qty_used: i.qty_used, avg_price_per_unit: i.avg_price_per_unit })),
      detail.packaging.map((p) => ({ cost_per_unit: p.cost_per_unit }))
    );
    recipeMargins.push({
      id: r.id,
      name: r.name,
      marginPct: cost.marginPct,
      indicator: cost.indicator,
    });
  }

  const { data: recentBatchesRaw, error: batchesError } = await supabase
    .from("batches")
    .select(
      "id, batch_date, actual_yield_bottles, cost_per_bottle_snapshot, recipes!inner(name, business_id)"
    )
    .eq("recipes.business_id", businessId)
    .order("batch_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(8);
  if (batchesError) throw new Error(batchesError.message);

  type RawBatch = {
    id: string;
    batch_date: string;
    actual_yield_bottles: number | null;
    cost_per_bottle_snapshot: number | null;
    recipes: { name: string } | null;
  };

  const recentBatches: RecentBatch[] = ((recentBatchesRaw ?? []) as unknown as RawBatch[]).map((b) => ({
    id: b.id,
    recipe_name: b.recipes?.name ?? "(deleted recipe)",
    batch_date: b.batch_date,
    actual_yield_bottles: b.actual_yield_bottles,
    cost_per_bottle_snapshot: b.cost_per_bottle_snapshot,
  }));

  const recipeIds = recipeSummaries.map((r) => r.id);
  let batchCount = 0;
  if (recipeIds.length > 0) {
    const { count, error: batchCountError } = await supabase
      .from("batches")
      .select("id", { count: "exact", head: true })
      .in("recipe_id", recipeIds);
    if (batchCountError) throw new Error(batchCountError.message);
    batchCount = count ?? 0;
  }

  return {
    ingredientCount: ingredients?.length ?? 0,
    recipeCount: recipeSummaries.length,
    batchCount,
    totalStockValue,
    lowStockCount,
    priceJumpCount,
    monthlySpend,
    recipeMargins,
    recentPurchases,
    recentBatches,
  };
}

async function getPriceJumpCount(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ingredientIds: string[]
): Promise<number> {
  if (ingredientIds.length === 0) return 0;
  const { data: purchases, error } = await supabase
    .from("purchases")
    .select("ingredient_id, qty_bought, price_paid_total, purchase_date, created_at")
    .in("ingredient_id", ingredientIds)
    .order("purchase_date", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  const byIngredient = new Map<string, { qty_bought: number; price_paid_total: number }[]>();
  for (const p of purchases ?? []) {
    const list = byIngredient.get(p.ingredient_id) ?? [];
    list.push({ qty_bought: p.qty_bought, price_paid_total: p.price_paid_total });
    byIngredient.set(p.ingredient_id, list);
  }

  let count = 0;
  for (const history of byIngredient.values()) {
    if (history.length < 2) continue;
    const latest = history[history.length - 1];
    const previous = history[history.length - 2];
    const latestUnitPrice = latest.qty_bought > 0 ? latest.price_paid_total / latest.qty_bought : 0;
    const previousUnitPrice =
      previous.qty_bought > 0 ? previous.price_paid_total / previous.qty_bought : 0;
    if (previousUnitPrice > 0) {
      const jump = ((latestUnitPrice - previousUnitPrice) / previousUnitPrice) * 100;
      if (jump >= 15) count++;
    }
  }
  return count;
}
