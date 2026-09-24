"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentBusinessId } from "@/lib/data/businesses";
import type { PrintJob, PrintJobPayload } from "@/lib/print-jobs";

type ActionResult = { error: string } | undefined;

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

const MISSING_TABLE = "Database update 0021 (print queue) hasn't been applied yet — run it in Supabase first";

// Used for reprints (Sales history, "Print again"); checkout queues its own
// job inside logCartSale so no extra round trip is needed there.
export async function queuePrintJob(payload: PrintJobPayload): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  const businessId = await getCurrentBusinessId();
  const { error } = await supabase
    .from("print_jobs")
    .insert({ user_id: user.id, business_id: businessId, payload });
  if (error) return { error: error.message.includes("print_jobs") ? MISSING_TABLE : error.message };
}

// Station side: take every queued job for this business and mark it
// "printing" in one UPDATE … RETURNING, so a job is handed out once even if
// realtime and the fallback poll fire together.
export async function claimPrintJobs(): Promise<{ jobs: PrintJob[] } | { error: string }> {
  const { supabase } = await requireUser();
  const businessId = await getCurrentBusinessId();
  const { data, error } = await supabase
    .from("print_jobs")
    .update({ status: "printing" })
    .eq("business_id", businessId)
    .eq("status", "queued")
    .select("id, payload, status, error, created_at")
    .order("created_at", { ascending: true });
  if (error) return { error: error.message.includes("print_jobs") ? MISSING_TABLE : error.message };
  return { jobs: (data ?? []) as PrintJob[] };
}

export async function finishPrintJob(id: string, errorMessage: string | null): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("print_jobs")
    .update(
      errorMessage
        ? { status: "failed", error: errorMessage.slice(0, 500) }
        : { status: "printed", error: null, printed_at: new Date().toISOString() }
    )
    .eq("id", id);
  if (error) return { error: error.message };
}

// A failed or stuck job goes back in the queue (e.g. printer was off).
export async function retryPrintJob(id: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("print_jobs")
    .update({ status: "queued", error: null })
    .eq("id", id);
  if (error) return { error: error.message };
}

export async function getRecentPrintJobs(): Promise<{ jobs: PrintJob[] } | { error: string }> {
  const { supabase } = await requireUser();
  const businessId = await getCurrentBusinessId();
  const { data, error } = await supabase
    .from("print_jobs")
    .select("id, payload, status, error, created_at")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) return { error: error.message.includes("print_jobs") ? MISSING_TABLE : error.message };
  return { jobs: (data ?? []) as PrintJob[] };
}
