import { createClient } from "@/lib/supabase/server";

export type BatchHistoryRow = {
  id: string;
  batch_date: string;
  recipe_name: string;
  actual_yield_bottles: number | null;
  cost_per_bottle_snapshot: number | null;
  notes: string | null;
};

export async function getBatchHistory(): Promise<BatchHistoryRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("batches")
    .select("id, batch_date, actual_yield_bottles, cost_per_bottle_snapshot, notes, recipes(name)")
    .order("batch_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  type Raw = {
    id: string;
    batch_date: string;
    actual_yield_bottles: number | null;
    cost_per_bottle_snapshot: number | null;
    notes: string | null;
    recipes: { name: string } | null;
  };

  return ((data ?? []) as unknown as Raw[]).map((b) => ({
    id: b.id,
    batch_date: b.batch_date,
    actual_yield_bottles: b.actual_yield_bottles,
    cost_per_bottle_snapshot: b.cost_per_bottle_snapshot,
    notes: b.notes,
    recipe_name: b.recipes?.name ?? "(deleted recipe)",
  }));
}
