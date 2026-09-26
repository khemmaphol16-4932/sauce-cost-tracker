import { createClient } from "@/lib/supabase/server";
import { getCurrentBusinessId } from "@/lib/data/businesses";

export type ReceiptProfile = {
  businessName: string;
  logoDataUrl: string | null;
  address: string | null;
  phone: string | null;
  contactLine: string | null;
  footer: string | null;
  feedbackUrl: string | null;
  printAfterSale: boolean;
};

const PROFILE_0020 = "name, logo_data_url, address, phone, contact_line, receipt_footer, print_after_sale";

// Read separately from getBusinesses() (which only needs id + name and runs
// on every page) so the logo's few KB aren't fetched on every request.
// Tolerates missing migrations: without 0021 there's no QR link, without 0020
// it falls back to the name-only label.
export async function getReceiptProfile(): Promise<ReceiptProfile> {
  const supabase = await createClient();
  const businessId = await getCurrentBusinessId();

  type Row = {
    name: string;
    logo_data_url: string | null;
    address: string | null;
    phone: string | null;
    contact_line: string | null;
    receipt_footer: string | null;
    print_after_sale: boolean | null;
    feedback_url?: string | null;
  };

  let { data, error } = await supabase
    .from("businesses")
    .select(`${PROFILE_0020}, feedback_url`)
    .eq("id", businessId)
    .maybeSingle<Row>();
  if (error) {
    ({ data, error } = await supabase
      .from("businesses")
      .select(PROFILE_0020)
      .eq("id", businessId)
      .maybeSingle<Row>());
  }

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
      feedbackUrl: null,
      printAfterSale: true,
    };
  }

  return {
    businessName: data.name,
    logoDataUrl: data.logo_data_url,
    address: data.address,
    phone: data.phone,
    contactLine: data.contact_line,
    footer: data.receipt_footer,
    feedbackUrl: data.feedback_url ?? null,
    printAfterSale: data.print_after_sale ?? true,
  };
}
