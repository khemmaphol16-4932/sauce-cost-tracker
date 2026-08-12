"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentBusinessId } from "@/lib/data/businesses";
import { revalidatePath } from "next/cache";

type ActionResult = { error: string } | undefined;

export async function logWaste(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const kind = String(formData.get("kind") ?? "");
  if (kind !== "ingredient" && kind !== "finished_goods") {
    return { error: "Pick what was wasted" };
  }

  const itemId = String(formData.get("item_id") ?? "");
  const qty = Number(formData.get("qty"));
  const reason = String(formData.get("reason") ?? "other").trim() || "other";
  const wasteDateRaw = String(formData.get("waste_date") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!itemId || !(qty > 0)) {
    return { error: "Pick an item and a quantity greater than 0" };
  }

  const businessId = await getCurrentBusinessId();

  const { error } = await supabase.from("waste_log").insert({
    user_id: user.id,
    business_id: businessId,
    kind,
    ingredient_id: kind === "ingredient" ? itemId : null,
    recipe_id: kind === "finished_goods" ? itemId : null,
    qty,
    reason,
    waste_date: wasteDateRaw || undefined,
    notes: notes || null,
  });
  if (error) return { error: error.message };

  revalidatePath("/analytics");
  revalidatePath("/stock");
  revalidatePath("/stock/low");

  return undefined;
}
