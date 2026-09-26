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

  const feedbackUrl = text("feedback_url");
  if (feedbackUrl && !/^https?:\/\//i.test(feedbackUrl)) {
    return { error: "Feedback link must start with https://" };
  }
  if (feedbackUrl && feedbackUrl.length > 500) return { error: "Feedback link is too long" };

  const businessId = await getCurrentBusinessId();
  const { error } = await supabase
    .from("businesses")
    .update({
      // Only sent when set, so shops without a QR link can still save
      // before migration 0021 has been applied.
      ...(feedbackUrl || formData.get("had_feedback_url") === "1" ? { feedback_url: feedbackUrl } : {}),
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
      return {
        error: error.message.includes("feedback_url")
          ? "Database update 0021 hasn't been applied yet — run it in Supabase to save the QR link"
          : "Database update 0020 hasn't been applied yet — run it in Supabase first",
      };
    }
    return { error: error.message };
  }

  revalidatePath("/", "layout");
}
