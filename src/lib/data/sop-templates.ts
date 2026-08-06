import { createClient } from "@/lib/supabase/server";

export type SopTemplateRow = {
  id: string;
  instruction: string;
};

export async function getSopTemplates(): Promise<SopTemplateRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sop_step_templates")
    .select("id, instruction")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}
