import { createClient } from "@/lib/supabase/server";
import { getCurrentBusinessId } from "@/lib/data/businesses";
import { getRecipes, getRecipeDetail } from "@/lib/data/recipes";
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
  const lowIngredientCount = (ingredients ?? []).filter(
    (i) => i.low_stock_threshold != null && i.qty_on_hand < i.low_stock_threshold
  ).length;

  const { data: finishedGoods, error: finishedGoodsError } = await supabase
    .from("finished_goods_stock")
    .select("qty_on_hand, low_stock_threshold, recipes!inner(business_id)")
    .eq("recipes.business_id", businessId);
  if (finishedGoodsError) throw new Error(finishedGoodsError.message);

  const lowFinishedGoodsCount = (finishedGoods ?? []).filter(
    (fg) => fg.low_stock_threshold != null && fg.qty_on_hand < fg.low_stock_threshold
  ).length;

  const lowStockCount = lowIngredientCount + lowFinishedGoodsCount;

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  const sixMonthsAgoStr = sixMonthsAgo.toISOString().slice(0, 10);

  const [
    { data: purchases, error: purchasesError },
    { data: recentPurchasesRaw, error: recentPurchasesError },
    { data: allPurchases, error: allPurchasesError },
  ] =
    ingredientIds.length === 0
      ? [{ data: [], error: null }, { data: [], error: null }, { data: [], error: null }]
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
          supabase
            .from("purchases")
            .select("ingredient_id, price_paid_total")
            .in("ingredient_id", ingredientIds),
        ]);
  if (purchasesError) throw new Error(purchasesError.message);
  if (recentPurchasesError) throw new Error(recentPurchasesError.message);
  if (allPurchasesError) throw new Error(allPurchasesError.message);

  const spendByIngredient = new Map<string, number>();
  for (const p of allPurchases ?? []) {
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

  const purchaseActivity: ActivityItem[] = (recentPurchasesRaw ?? []).map((p) => ({
    kind: "purchase",
    id: p.id,
    date: p.purchase_date,
    title: ingredientNameById.get(p.ingredient_id) ?? "(deleted ingredient)",
    detail: `Bought ${p.qty_bought}`,
    amount: `฿${p.price_paid_total.toFixed(2)}`,
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

  const { data: costTrendRaw, error: costTrendError } = await supabase
    .from("batches")
    .select("batch_date, cost_per_bottle_snapshot, recipes!inner(business_id)")
    .eq("recipes.business_id", businessId)
    .not("cost_per_bottle_snapshot", "is", null)
    .order("batch_date", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(20);
  if (costTrendError) throw new Error(costTrendError.message);

  const costTrend: CostTrendPoint[] = (costTrendRaw ?? []).map((b) => ({
    date: b.batch_date,
    cost: b.cost_per_bottle_snapshot as number,
  }));

  const { data: salesRaw, error: salesError } = await supabase
    .from("sales")
    .select(
      "recipe_id, qty_bottles, price_charged_total, platform_fee_pct, cost_per_bottle_snapshot, sale_date, recipes(name)"
    )
    .eq("business_id", businessId);
  if (salesError) throw new Error(salesError.message);

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
