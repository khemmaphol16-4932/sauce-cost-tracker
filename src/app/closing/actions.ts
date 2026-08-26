"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentBusinessId } from "@/lib/data/businesses";
import { computeExpectedCash } from "@/lib/data/closing";
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

// Recomputes expected cash server-side rather than trusting whatever the
// client form echoes back — the displayed figure is just informational,
// this is the value that actually gets written.
export async function saveClosing(formData: FormData): Promise<ActionResult> {
  const { supabase, user } = await requireUser();

  const date = String(formData.get("reconciliation_date") ?? "").trim();
  const countedCash = Number(formData.get("counted_cash"));
  const reason = String(formData.get("reason") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!date) return { error: "Missing closing date" };
  if (!Number.isFinite(countedCash) || countedCash < 0) {
    return { error: "Enter the amount you counted (0 or more)" };
  }

  const businessId = await getCurrentBusinessId();
  const expectedCash = await computeExpectedCash(supabase, businessId, date);

  if (countedCash !== expectedCash && !reason) {
    return { error: "Pick a reason for the variance" };
  }

  const { error } = await supabase.from("cash_reconciliations").upsert(
    {
      user_id: user.id,
      business_id: businessId,
      reconciliation_date: date,
      expected_cash: expectedCash,
      counted_cash: countedCash,
      reason: reason || null,
      notes: notes || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "business_id,reconciliation_date" }
  );
  if (error) return { error: error.message };

  revalidatePath("/closing");
}
