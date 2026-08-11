import { createClient } from "@/lib/supabase/server";
import { getCurrentBusinessId } from "@/lib/data/businesses";

export type FinishedGoodsRow = {
  id: string;
  recipe_id: string;
  recipe_name: string;
  qty_on_hand: number;
  low_stock_threshold: number | null;
};

export async function getFinishedGoodsStock(): Promise<FinishedGoodsRow[]> {
  const supabase = await createClient();
  const businessId = await getCurrentBusinessId();

  const { data, error } = await supabase
    .from("finished_goods_stock")
    .select("id, recipe_id, qty_on_hand, low_stock_threshold, recipes!inner(name, business_id)")
    .eq("recipes.business_id", businessId)
    .order("qty_on_hand", { ascending: true });
  if (error) throw new Error(error.message);

  type Raw = {
    id: string;
    recipe_id: string;
    qty_on_hand: number;
    low_stock_threshold: number | null;
    recipes: { name: string; business_id: string } | null;
  };

  return ((data ?? []) as unknown as Raw[]).map((row) => ({
    id: row.id,
    recipe_id: row.recipe_id,
    recipe_name: row.recipes?.name ?? "(deleted recipe)",
    qty_on_hand: row.qty_on_hand,
    low_stock_threshold: row.low_stock_threshold,
  }));
}
