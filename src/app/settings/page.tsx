import { getReceiptProfile } from "@/lib/data/receipt-profile";
import { ShopProfileForm } from "./shop-profile-form";

export default async function SettingsPage() {
  const profile = await getReceiptProfile();
  return <ShopProfileForm profile={profile} />;
}
