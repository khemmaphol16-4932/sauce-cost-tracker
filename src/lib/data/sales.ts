import { createClient } from "@/lib/supabase/server";
import { getCurrentBusinessId } from "@/lib/data/businesses";

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
  notes: string | null;
};

export async function getSales(): Promise<SaleRow[]> {
  const supabase = await createClient();
  const businessId = await getCurrentBusinessId();

  const { data, error } = await supabase
    .from("sales")
    .select(
      "id, qty_bottles, price_charged_total, platform, payment_status, payment_method, sale_date, cost_per_bottle_snapshot, notes, recipes(name)"
    )
    .eq("business_id", businessId)
    .order("sale_date", { ascending: false })
    .order("created_at", { ascending: false });
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
    notes: s.notes,
  }));
}
