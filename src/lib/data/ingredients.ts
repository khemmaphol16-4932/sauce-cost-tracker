import { createClient } from "@/lib/supabase/server";

export type IngredientWithLastPurchase = {
  id: string;
  name: string;
  unit: string;
  qty_on_hand: number;
  avg_price_per_unit: number;
  low_stock_threshold: number | null;
  last_purchase_date: string | null;
};

export async function getIngredientsWithLastPurchase(): Promise<
  IngredientWithLastPurchase[]
> {
  const supabase = await createClient();

  const [{ data: ingredients, error: ingredientsError }, { data: purchases, error: purchasesError }] =
    await Promise.all([
      supabase.from("ingredients").select("*").order("name", { ascending: true }),
      supabase.from("purchases").select("ingredient_id, purchase_date"),
    ]);

  if (ingredientsError) throw new Error(ingredientsError.message);
  if (purchasesError) throw new Error(purchasesError.message);

  const lastPurchaseByIngredient = new Map<string, string>();
  for (const p of purchases ?? []) {
    const current = lastPurchaseByIngredient.get(p.ingredient_id);
    if (!current || p.purchase_date > current) {
      lastPurchaseByIngredient.set(p.ingredient_id, p.purchase_date);
    }
  }

  return (ingredients ?? []).map((i) => ({
    ...i,
    last_purchase_date: lastPurchaseByIngredient.get(i.id) ?? null,
  }));
}
