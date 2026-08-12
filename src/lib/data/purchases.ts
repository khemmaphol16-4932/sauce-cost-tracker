import { createClient } from "@/lib/supabase/server";
import { getCurrentBusinessId } from "@/lib/data/businesses";

export type PurchaseRow = {
  id: string;
  ingredient_name: string;
  qty_bought: number;
  price_paid_total: number;
  purchase_date: string;
};

export async function getPurchases(): Promise<PurchaseRow[]> {
  const supabase = await createClient();
  const businessId = await getCurrentBusinessId();

  const { data, error } = await supabase
    .from("purchases")
    .select(
      "id, qty_bought, price_paid_total, purchase_date, ingredients!inner(name, business_id)"
    )
    .eq("ingredients.business_id", businessId)
    .order("purchase_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  type Raw = {
    id: string;
    qty_bought: number;
    price_paid_total: number;
    purchase_date: string;
    ingredients: { name: string } | null;
  };

  return ((data ?? []) as unknown as Raw[]).map((p) => ({
    id: p.id,
    ingredient_name: p.ingredients?.name ?? "(deleted ingredient)",
    qty_bought: p.qty_bought,
    price_paid_total: p.price_paid_total,
    purchase_date: p.purchase_date,
  }));
}
