import { createClient } from "@/lib/supabase/server";
import { getCurrentBusinessId } from "@/lib/data/businesses";

export type WasteEntry = {
  id: string;
  kind: "ingredient" | "finished_goods";
  item_name: string;
  qty: number;
  reason: string;
  waste_date: string;
  notes: string | null;
};

export type WasteReasonBreakdown = { reason: string; count: number };

export type WasteSummary = {
  recent: WasteEntry[];
  byReason: WasteReasonBreakdown[];
};

const REASON_OPTIONS = ["spoiled", "burnt", "dropped", "expired", "other"] as const;
export { REASON_OPTIONS };

export async function getWasteSummary(limit = 15): Promise<WasteSummary> {
  const supabase = await createClient();
  const businessId = await getCurrentBusinessId();

  const { data, error } = await supabase
    .from("waste_log")
    .select("id, kind, ingredient_id, recipe_id, qty, reason, waste_date, notes, ingredients(name), recipes(name)")
    .eq("business_id", businessId)
    .order("waste_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  type Raw = {
    id: string;
    kind: "ingredient" | "finished_goods";
    qty: number;
    reason: string;
    waste_date: string;
    notes: string | null;
    ingredients: { name: string } | null;
    recipes: { name: string } | null;
  };

  const rows = (data ?? []) as unknown as Raw[];

  const recent: WasteEntry[] = rows.slice(0, limit).map((r) => ({
    id: r.id,
    kind: r.kind,
    item_name: (r.kind === "ingredient" ? r.ingredients?.name : r.recipes?.name) ?? "(deleted)",
    qty: r.qty,
    reason: r.reason,
    waste_date: r.waste_date,
    notes: r.notes,
  }));

  const byReasonMap = new Map<string, number>();
  for (const r of rows) {
    byReasonMap.set(r.reason, (byReasonMap.get(r.reason) ?? 0) + 1);
  }
  const byReason = Array.from(byReasonMap.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);

  return { recent, byReason };
}
