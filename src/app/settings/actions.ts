"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentBusinessId } from "@/lib/data/businesses";
import { revalidatePath } from "next/cache";

type ActionResult = { error: string } | undefined;

const MAX_LOGO_CHARS = 300_000; // mirrors the businesses_logo_size check in 0020

export async function updateShopProfile(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const text = (key: string) => String(formData.get(key) ?? "").trim() || null;

  const name = text("name");
  if (!name) return { error: "Shop name is required" };

  const logo = String(formData.get("logo_data_url") ?? "");
  if (logo && !logo.startsWith("data:image/")) return { error: "Logo must be an image" };
  if (logo.length > MAX_LOGO_CHARS) return { error: "Logo is too large — try a simpler image" };

  const businessId = await getCurrentBusinessId();
  const { error } = await supabase
    .from("businesses")
    .update({
      name,
      logo_data_url: logo || null,
      address: text("address"),
      phone: text("phone"),
      contact_line: text("contact_line"),
      receipt_footer: text("receipt_footer"),
      print_after_sale: formData.get("print_after_sale") === "on",
    })
    .eq("id", businessId);
  if (error) {
    if (error.message.includes("column")) {
      return { error: "Database update 0020 hasn't been applied yet — run it in Supabase first" };
    }
    return { error: error.message };
  }

  // Separate update so shops that ran 0020 but not 0021 can still save the rest.
  const printTarget = formData.get("print_target") === "station" ? "station" : "phone";
  const { error: targetError } = await supabase
    .from("businesses")
    .update({ print_target: printTarget })
    .eq("id", businessId);
  if (targetError && printTarget === "station") {
    return { error: "Saved, but printing on the shop computer needs database update 0021 — run it in Supabase first" };
  }

  revalidatePath("/", "layout");
}
