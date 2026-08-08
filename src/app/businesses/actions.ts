"use server";

import { createClient } from "@/lib/supabase/server";
import { BUSINESS_COOKIE } from "@/lib/data/businesses";
import { cookies } from "next/headers";
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

export async function switchBusiness(formData: FormData): Promise<ActionResult> {
  const id = String(formData.get("business_id") ?? "").trim();
  if (!id) return { error: "Pick a business" };

  const cookieStore = await cookies();
  cookieStore.set(BUSINESS_COOKIE, id, { path: "/", maxAge: 60 * 60 * 24 * 365 });

  revalidatePath("/", "layout");
}

export async function createBusiness(formData: FormData): Promise<ActionResult> {
  const { supabase, user } = await requireUser();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Business name is required" };

  const { data, error } = await supabase
    .from("businesses")
    .insert({ user_id: user.id, name })
    .select("id")
    .single();
  if (error) return { error: error.message };

  const cookieStore = await cookies();
  cookieStore.set(BUSINESS_COOKIE, data.id, { path: "/", maxAge: 60 * 60 * 24 * 365 });

  revalidatePath("/", "layout");
}
