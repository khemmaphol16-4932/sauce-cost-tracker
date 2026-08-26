import { createClient } from "@/lib/supabase/server";
import { getCurrentBusinessId } from "@/lib/data/businesses";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// Authoritative expected-cash figure — shared by the page (display) and the
// save action (what actually gets written), so a stale value echoed back
// from the client is never what lands in cash_reconciliations.
export async function computeExpectedCash(
  supabase: SupabaseServerClient,
  businessId: string,
  date: string
): Promise<number> {
  const { data, error } = await supabase
    .from("sales")
    .select("price_charged_total")
    .eq("business_id", businessId)
    .eq("sale_date", date)
    .eq("payment_status", "paid")
    .ilike("payment_method", "cash");
  if (error) throw new Error(error.message);
  return (data ?? []).reduce((sum, s) => sum + s.price_charged_total, 0);
}

export type ClosingData = {
  date: string;
  expectedCash: number;
  existing: { countedCash: number; reason: string | null; notes: string | null } | null;
};

export async function getClosingData(date: string): Promise<ClosingData> {
  const supabase = await createClient();
  const businessId = await getCurrentBusinessId();

  const [expectedCash, { data: existing, error: existingError }] = await Promise.all([
    computeExpectedCash(supabase, businessId, date),
    supabase
      .from("cash_reconciliations")
      .select("counted_cash, reason, notes")
      .eq("business_id", businessId)
      .eq("reconciliation_date", date)
      .maybeSingle(),
  ]);
  if (existingError) throw new Error(existingError.message);

  return {
    date,
    expectedCash,
    existing: existing
      ? { countedCash: existing.counted_cash, reason: existing.reason, notes: existing.notes }
      : null,
  };
}
