import { createClient } from "@/lib/supabase/server";
import { getCurrentBusinessId } from "@/lib/data/businesses";

export type ReceiptProfile = {
  businessName: string;
  logoDataUrl: string | null;
  address: string | null;
  phone: string | null;
  contactLine: string | null;
  footer: string | null;
  printAfterSale: boolean;
  // 'phone' = Share Sheet → PeriPage app; 'station' = queued for the shop computer.
  printTarget: PrintTarget;
};

export type PrintTarget = "phone" | "station";

// Read separately from getBusinesses() (which only needs id + name and runs
// on every page) so the logo's few KB aren't fetched on every request.
// Falls back to name-only if migration 0020 hasn't been applied yet, and to
// the phone print path if 0021 hasn't.
export async function getReceiptProfile(): Promise<ReceiptProfile> {
  const supabase = await createClient();
  const businessId = await getCurrentBusinessId();

  const { data, error } = await supabase
    .from("businesses")
    .select("name, logo_data_url, address, phone, contact_line, receipt_footer, print_after_sale")
    .eq("id", businessId)
    .maybeSingle();

  if (error || !data) {
    const { data: basic } = await supabase
      .from("businesses")
      .select("name")
      .eq("id", businessId)
      .maybeSingle();
    return {
      businessName: basic?.name ?? "Ordexa",
      logoDataUrl: null,
      address: null,
      phone: null,
      contactLine: null,
      footer: null,
      printAfterSale: true,
      printTarget: "phone",
    };
  }

  const { data: target } = await supabase
    .from("businesses")
    .select("print_target")
    .eq("id", businessId)
    .maybeSingle();

  return {
    businessName: data.name,
    logoDataUrl: data.logo_data_url,
    address: data.address,
    phone: data.phone,
    contactLine: data.contact_line,
    footer: data.receipt_footer,
    printAfterSale: data.print_after_sale ?? true,
    printTarget: target?.print_target === "station" ? "station" : "phone",
  };
}
