import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

export const BUSINESS_COOKIE = "business_id";

export type Business = {
  id: string;
  name: string;
};

export async function getBusinesses(): Promise<Business[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("businesses")
    .select("id, name")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * Resolves the active business for the current request: the cookie value if
 * it's still valid for this user, otherwise the user's first business (RLS
 * already scopes the list to their own rows).
 */
export async function getCurrentBusiness(): Promise<Business | null> {
  const businesses = await getBusinesses();
  if (businesses.length === 0) return null;

  const cookieStore = await cookies();
  const cookieId = cookieStore.get(BUSINESS_COOKIE)?.value;
  return businesses.find((b) => b.id === cookieId) ?? businesses[0];
}

export async function getCurrentBusinessId(): Promise<string> {
  const business = await getCurrentBusiness();
  if (!business) throw new Error("No business set up for this account yet");
  return business.id;
}
