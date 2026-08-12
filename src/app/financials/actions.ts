"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentBusinessId } from "@/lib/data/businesses";
import { revalidatePath } from "next/cache";

type ActionResult = { error: string } | undefined;

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

export async function logExpense(formData: FormData): Promise<ActionResult> {
  const { supabase, user } = await requireUser();

  const category = String(formData.get("category") ?? "other").trim() || "other";
  const description = String(formData.get("description") ?? "").trim();
  const amount = Number(formData.get("amount"));
  const expenseDateRaw = String(formData.get("expense_date") ?? "").trim();

  if (!(amount >= 0)) return { error: "A valid amount is required" };

  const businessId = await getCurrentBusinessId();

  const { error } = await supabase.from("expenses").insert({
    user_id: user.id,
    business_id: businessId,
    category,
    description: description || null,
    amount,
    expense_date: expenseDateRaw || undefined,
  });
  if (error) return { error: error.message };

  revalidatePath("/financials");
  revalidatePath("/financials/expenses");
}

export async function deleteExpense(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const id = String(formData.get("id"));

  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/financials");
  revalidatePath("/financials/expenses");
}
