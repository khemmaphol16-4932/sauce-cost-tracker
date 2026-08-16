import { createClient } from "@/lib/supabase/server";
import { getCurrentBusinessId } from "@/lib/data/businesses";

export type PurchaseRow = {
  id: string;
  ingredient_name: string;
  qty_bought: number;
  price_paid_total: number;
  purchase_date: string;
  brand: string | null;
};

export async function getPurchases(): Promise<PurchaseRow[]> {
  const supabase = await createClient();
  const businessId = await getCurrentBusinessId();

  const { data, error } = await supabase
    .from("purchases")
    .select(
      "id, qty_bought, price_paid_total, purchase_date, brand, ingredients!inner(name, business_id)"
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
    brand: string | null;
    ingredients: { name: string } | null;
  };

  return ((data ?? []) as unknown as Raw[]).map((p) => ({
    id: p.id,
    ingredient_name: p.ingredients?.name ?? "(deleted ingredient)",
    qty_bought: p.qty_bought,
    price_paid_total: p.price_paid_total,
    purchase_date: p.purchase_date,
    brand: p.brand,
  }));
}

export type BrandSpend = {
  ingredient_name: string;
  brand: string;
  total: number;
  qty: number;
};

// Only ingredients with 2+ distinct brands logged are worth showing a
// breakdown for — a single-brand ingredient has nothing to compare.
export async function getBrandSpend(): Promise<BrandSpend[]> {
  const supabase = await createClient();
  const businessId = await getCurrentBusinessId();

  const { data, error } = await supabase
    .from("purchases")
    .select("qty_bought, price_paid_total, brand, ingredients!inner(name, business_id)")
    .eq("ingredients.business_id", businessId)
    .not("brand", "is", null);
  if (error) throw new Error(error.message);

  type Raw = {
    qty_bought: number;
    price_paid_total: number;
    brand: string;
    ingredients: { name: string } | null;
  };

  const byIngredientBrand = new Map<string, BrandSpend>();
  const brandsByIngredient = new Map<string, Set<string>>();
  for (const p of (data ?? []) as unknown as Raw[]) {
    const ingredientName = p.ingredients?.name ?? "(deleted ingredient)";
    const key = `${ingredientName}::${p.brand}`;
    const existing = byIngredientBrand.get(key) ?? {
      ingredient_name: ingredientName,
      brand: p.brand,
      total: 0,
      qty: 0,
    };
    existing.total += p.price_paid_total;
    existing.qty += p.qty_bought;
    byIngredientBrand.set(key, existing);

    const brandSet = brandsByIngredient.get(ingredientName) ?? new Set<string>();
    brandSet.add(p.brand);
    brandsByIngredient.set(ingredientName, brandSet);
  }

  return Array.from(byIngredientBrand.values())
    .filter((row) => (brandsByIngredient.get(row.ingredient_name)?.size ?? 0) >= 2)
    .sort((a, b) => a.ingredient_name.localeCompare(b.ingredient_name) || b.total - a.total);
}
