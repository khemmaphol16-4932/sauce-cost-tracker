import { createClient } from "@/lib/supabase/server";
import { getCurrentBusinessId } from "@/lib/data/businesses";

export type FinancialsMonth = {
  month: string;
  revenue: number;
  ingredientSpend: number;
  expenses: number;
  netProfit: number;
};

export type FinancialsSummary = {
  months: FinancialsMonth[];
  totalRevenue: number;
  totalIngredientSpend: number;
  totalExpenses: number;
  totalNetProfit: number;
};

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

export async function getFinancialsSummary(): Promise<FinancialsSummary> {
  const supabase = await createClient();
  const businessId = await getCurrentBusinessId();

  const { data: ingredients, error: ingredientsError } = await supabase
    .from("ingredients")
    .select("id")
    .eq("business_id", businessId);
  if (ingredientsError) throw new Error(ingredientsError.message);
  const ingredientIds = (ingredients ?? []).map((i) => i.id);

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  const sixMonthsAgoStr = sixMonthsAgo.toISOString().slice(0, 10);

  const [
    { data: sales, error: salesError },
    { data: purchases, error: purchasesError },
    { data: expenses, error: expensesError },
  ] = await Promise.all([
    supabase
      .from("sales")
      .select("price_charged_total, sale_date")
      .eq("business_id", businessId)
      .gte("sale_date", sixMonthsAgoStr),
    ingredientIds.length === 0
      ? Promise.resolve({ data: [], error: null })
      : supabase
          .from("purchases")
          .select("price_paid_total, purchase_date")
          .in("ingredient_id", ingredientIds)
          .gte("purchase_date", sixMonthsAgoStr),
    supabase
      .from("expenses")
      .select("amount, expense_date")
      .eq("business_id", businessId)
      .gte("expense_date", sixMonthsAgoStr),
  ]);
  if (salesError) throw new Error(salesError.message);
  if (purchasesError) throw new Error(purchasesError.message);
  if (expensesError) throw new Error(expensesError.message);

  const months: FinancialsMonth[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const label = `${MONTH_LABELS[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`;
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

    const revenue = (sales ?? [])
      .filter((s) => s.sale_date.slice(0, 7) === monthKey)
      .reduce((sum, s) => sum + s.price_charged_total, 0);
    const ingredientSpend = (purchases ?? [])
      .filter((p) => p.purchase_date.slice(0, 7) === monthKey)
      .reduce((sum, p) => sum + p.price_paid_total, 0);
    const monthExpenses = (expenses ?? [])
      .filter((e) => e.expense_date.slice(0, 7) === monthKey)
      .reduce((sum, e) => sum + e.amount, 0);

    months.push({
      month: label,
      revenue,
      ingredientSpend,
      expenses: monthExpenses,
      netProfit: revenue - ingredientSpend - monthExpenses,
    });
  }

  return {
    months,
    totalRevenue: months.reduce((sum, m) => sum + m.revenue, 0),
    totalIngredientSpend: months.reduce((sum, m) => sum + m.ingredientSpend, 0),
    totalExpenses: months.reduce((sum, m) => sum + m.expenses, 0),
    totalNetProfit: months.reduce((sum, m) => sum + m.netProfit, 0),
  };
}
