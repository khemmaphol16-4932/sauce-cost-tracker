import { createClient } from "@/lib/supabase/server";
import { getCurrentBusinessId } from "@/lib/data/businesses";
import type { RecipeDetail } from "@/lib/data/recipes";
import { calcRecipeCost, calcSaleMargin } from "@/lib/costing";

export type MonthlySpend = { month: string; total: number };
export type IngredientSpend = { name: string; total: number };
export type CostTrendPoint = { date: string; cost: number };
export type RecipeMargin = {
  id: string;
  name: string;
  marginPct: number;
  indicator: "red" | "yellow" | "green";
};
export type ActivityItem =
  | { kind: "purchase"; id: string; date: string; title: string; detail: string; amount: string }
  | { kind: "batch"; id: string; date: string; title: string; detail: string; amount: string };
export type BestSeller = {
  recipe_id: string;
  recipe_name: string;
  qtySold: number;
  revenue: number;
};
export type RealMarginMonth = { month: string; marginPct: number | null };

export type DashboardData = {
  ingredientCount: number;
  recipeCount: number;
  batchCount: number;
  totalStockValue: number;
  lowStockCount: number;
  priceJumpCount: number;
  revenueTotal: number;
  thisMonthSpend: number;
  monthlySpend: MonthlySpend[];
  topIngredientsBySpend: IngredientSpend[];
  costTrend: CostTrendPoint[];
  recipeMargins: RecipeMargin[];
  recentActivity: ActivityItem[];
  bestSellers: BestSeller[];
  realMarginTrend: RealMarginMonth[];
};

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

export async function getDashboardData(): Promise<DashboardData> {
  const supabase = await createClient();
  const businessId = await getCurrentBusinessId();

  // Every query below depends only on the business, so they all go out at
  // once: one round trip instead of the ~10 + one-per-priced-recipe that ran
  // in series before. Child tables are scoped through an inner join on their
  // parent's business_id rather than a list of ids fetched first.
  const [
    { data: ingredients, error: ingredientsError },
    { data: finishedGoods, error: finishedGoodsError },
    { data: purchasesRaw, error: purchasesError },
    { data: recipes, error: recipesError },
    { data: recipeIngredientsRaw, error: recipeIngredientsError },
    { data: packagingRaw, error: packagingError },
    { data: recentBatchesRaw, error: batchesError },
    { data: costTrendRaw, error: costTrendError },
    { data: salesRaw, error: salesError },
    { count: batchCountRaw, error: batchCountError },
  ] = await Promise.all([
    supabase
      .from("ingredients")
      .select("id, name, qty_on_hand, avg_price_per_unit, low_stock_threshold")
      .eq("business_id", businessId),
    supabase
      .from("finished_goods_stock")
      .select("qty_on_hand, low_stock_threshold, recipes!inner(business_id)")
      .eq("recipes.business_id", businessId),
    // One purchases read serves spend-by-month, top ingredients, recent
    // activity and the price-jump count (previously four separate queries).
    supabase
      .from("purchases")
      .select("id, ingredient_id, qty_bought, price_paid_total, purchase_date, created_at, ingredients!inner(business_id)")
      .eq("ingredients.business_id", businessId)
      .order("purchase_date", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("recipes")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false }),
    supabase
      .from("recipe_ingredients")
      .select("recipe_id, qty_used, ingredients(avg_price_per_unit), recipes!inner(business_id)")
      .eq("recipes.business_id", businessId),
    supabase
      .from("packaging_costs")
      .select("recipe_id, cost_per_unit, recipes!inner(business_id)")
      .eq("recipes.business_id", businessId),
    supabase
      .from("batches")
      .select(
        "id, batch_date, actual_yield_bottles, cost_per_bottle_snapshot, recipes!inner(name, business_id)"
      )
      .eq("recipes.business_id", businessId)
      .order("batch_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("batches")
      .select("batch_date, cost_per_bottle_snapshot, recipes!inner(business_id)")
      .eq("recipes.business_id", businessId)
      .not("cost_per_bottle_snapshot", "is", null)
      .order("batch_date", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(20),
    supabase
      .from("sales")
      .select(
        "recipe_id, qty_bottles, price_charged_total, platform_fee_pct, cost_per_bottle_snapshot, sale_date, recipes(name)"
      )
      .eq("business_id", businessId),
    supabase
      .from("batches")
      .select("id, recipes!inner(business_id)", { count: "exact", head: true })
      .eq("recipes.business_id", businessId),
  ]);
  if (ingredientsError) throw new Error(ingredientsError.message);
  if (finishedGoodsError) throw new Error(finishedGoodsError.message);
  if (purchasesError) throw new Error(purchasesError.message);
  if (recipesError) throw new Error(recipesError.message);
  if (recipeIngredientsError) throw new Error(recipeIngredientsError.message);
  if (packagingError) throw new Error(packagingError.message);
  if (batchesError) throw new Error(batchesError.message);
  if (costTrendError) throw new Error(costTrendError.message);
  if (salesError) throw new Error(salesError.message);
  if (batchCountError) throw new Error(batchCountError.message);

  const ingredientNameById = new Map((ingredients ?? []).map((i) => [i.id, i.name]));

  const totalStockValue = (ingredients ?? []).reduce(
    (sum, i) => sum + i.qty_on_hand * i.avg_price_per_unit,
    0
  );
  const lowIngredientCount = (ingredients ?? []).filter(
    (i) => i.low_stock_threshold != null && i.qty_on_hand < i.low_stock_threshold
  ).length;
  const lowFinishedGoodsCount = (finishedGoods ?? []).filter(
    (fg) => fg.low_stock_threshold != null && fg.qty_on_hand < fg.low_stock_threshold
  ).length;
  const lowStockCount = lowIngredientCount + lowFinishedGoodsCount;

  type RawPurchase = {
    id: string;
    ingredient_id: string;
    qty_bought: number;
    price_paid_total: number;
    purchase_date: string;
    created_at: string;
  };
  // Oldest first (query order) — the price-jump rule compares the last two.
  const allPurchases = (purchasesRaw ?? []) as unknown as RawPurchase[];

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  const sixMonthsAgoStr = sixMonthsAgo.toISOString().slice(0, 10);
  const purchases = allPurchases.filter((p) => p.purchase_date >= sixMonthsAgoStr);

  const spendByIngredient = new Map<string, number>();
  for (const p of allPurchases) {
    spendByIngredient.set(
      p.ingredient_id,
      (spendByIngredient.get(p.ingredient_id) ?? 0) + p.price_paid_total
    );
  }
  const topIngredientsBySpend: IngredientSpend[] = Array.from(spendByIngredient.entries())
    .map(([id, total]) => ({ name: ingredientNameById.get(id) ?? "(deleted ingredient)", total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);

  // Price-jump count reuses the same 15% rule as the Stock page badge.
  const priceJumpCount = countPriceJumps(allPurchases);

  const monthlySpend: MonthlySpend[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const label = `${MONTH_LABELS[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`;
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const total = purchases
      .filter((p) => p.purchase_date.slice(0, 7) === monthKey)
      .reduce((sum, p) => sum + p.price_paid_total, 0);
    monthlySpend.push({ month: label, total });
  }

  // Newest 8, same order the old `.order(desc).limit(8)` query returned.
  const purchaseActivity: ActivityItem[] = allPurchases
    .slice(-8)
    .reverse()
    .map((p) => ({
      kind: "purchase",
      id: p.id,
      date: p.purchase_date,
      title: ingredientNameById.get(p.ingredient_id) ?? "(deleted ingredient)",
      detail: `Bought ${p.qty_bought}`,
      amount: `฿${p.price_paid_total.toFixed(2)}`,
    }));

  type RawRecipeIngredient = {
    recipe_id: string;
    qty_used: number;
    ingredients: { avg_price_per_unit: number } | null;
  };
  const ingredientsByRecipe = new Map<string, { qty_used: number; avg_price_per_unit: number }[]>();
  for (const ri of (recipeIngredientsRaw ?? []) as unknown as RawRecipeIngredient[]) {
    const list = ingredientsByRecipe.get(ri.recipe_id) ?? [];
    list.push({ qty_used: ri.qty_used, avg_price_per_unit: ri.ingredients?.avg_price_per_unit ?? 0 });
    ingredientsByRecipe.set(ri.recipe_id, list);
  }
  const packagingByRecipe = new Map<string, { cost_per_unit: number }[]>();
  for (const p of packagingRaw ?? []) {
    const list = packagingByRecipe.get(p.recipe_id) ?? [];
    list.push({ cost_per_unit: p.cost_per_unit });
    packagingByRecipe.set(p.recipe_id, list);
  }

  const recipeMargins: RecipeMargin[] = [];
  for (const r of (recipes ?? []) as RecipeDetail[]) {
    if (r.target_sell_price == null) continue;
    const cost = calcRecipeCost(r, ingredientsByRecipe.get(r.id) ?? [], packagingByRecipe.get(r.id) ?? []);
    recipeMargins.push({
      id: r.id,
      name: r.name,
      marginPct: cost.marginPct,
      indicator: cost.indicator,
    });
  }

  type RawBatch = {
    id: string;
    batch_date: string;
    actual_yield_bottles: number | null;
    cost_per_bottle_snapshot: number | null;
    recipes: { name: string } | null;
  };

  const batchActivity: ActivityItem[] = ((recentBatchesRaw ?? []) as unknown as RawBatch[]).map((b) => ({
    kind: "batch",
    id: b.id,
    date: b.batch_date,
    title: b.recipes?.name ?? "(deleted recipe)",
    detail: `${b.actual_yield_bottles ?? "?"} bottles`,
    amount:
      b.cost_per_bottle_snapshot != null ? `฿${b.cost_per_bottle_snapshot.toFixed(2)}/bottle` : "—",
  }));

  const recentActivity: ActivityItem[] = [...purchaseActivity, ...batchActivity]
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .slice(0, 10);

  const costTrend: CostTrendPoint[] = (costTrendRaw ?? []).map((b) => ({
    date: b.batch_date,
    cost: b.cost_per_bottle_snapshot as number,
  }));

  type RawSale = {
    recipe_id: string;
    qty_bottles: number;
    price_charged_total: number;
    platform_fee_pct: number | null;
    cost_per_bottle_snapshot: number | null;
    sale_date: string;
    recipes: { name: string } | null;
  };
  const sales = (salesRaw ?? []) as unknown as RawSale[];

  const revenueTotal = sales.reduce((sum, s) => sum + s.price_charged_total, 0);

  const bestSellerMap = new Map<string, BestSeller>();
  for (const s of sales) {
    const entry = bestSellerMap.get(s.recipe_id) ?? {
      recipe_id: s.recipe_id,
      recipe_name: s.recipes?.name ?? "(deleted recipe)",
      qtySold: 0,
      revenue: 0,
    };
    entry.qtySold += s.qty_bottles;
    entry.revenue += s.price_charged_total;
    bestSellerMap.set(s.recipe_id, entry);
  }
  const bestSellers = Array.from(bestSellerMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const realMarginTrend: RealMarginMonth[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const label = `${MONTH_LABELS[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`;
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const monthSales = sales.filter(
      (s) => s.sale_date.slice(0, 7) === monthKey && s.cost_per_bottle_snapshot != null
    );
    if (monthSales.length === 0) {
      realMarginTrend.push({ month: label, marginPct: null });
      continue;
    }
    let totalRevenue = 0;
    let totalProfit = 0;
    for (const s of monthSales) {
      const margin = calcSaleMargin(
        {
          price_charged_total: s.price_charged_total,
          qty_bottles: s.qty_bottles,
          platform_fee_pct: s.platform_fee_pct,
        },
        s.cost_per_bottle_snapshot as number
      );
      totalRevenue += s.price_charged_total;
      totalProfit += margin.profitPerBottle * s.qty_bottles;
    }
    realMarginTrend.push({
      month: label,
      marginPct: totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : null,
    });
  }

  return {
    ingredientCount: ingredients?.length ?? 0,
    recipeCount: recipes?.length ?? 0,
    batchCount: batchCountRaw ?? 0,
    totalStockValue,
    lowStockCount,
    priceJumpCount,
    revenueTotal,
    thisMonthSpend: monthlySpend[monthlySpend.length - 1]?.total ?? 0,
    monthlySpend,
    topIngredientsBySpend,
    costTrend,
    recipeMargins,
    recentActivity,
    bestSellers,
    realMarginTrend,
  };
}

// Purchases must be oldest-first.
function countPriceJumps(
  purchases: { ingredient_id: string; qty_bought: number; price_paid_total: number }[]
): number {
  const byIngredient = new Map<string, { qty_bought: number; price_paid_total: number }[]>();
  for (const p of purchases) {
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
