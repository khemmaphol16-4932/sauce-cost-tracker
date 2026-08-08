import { getBusinesses, getCurrentBusiness } from "@/lib/data/businesses";
import { BusinessSwitcherClient } from "./business-switcher-client";

export async function BusinessSwitcher() {
  const [businesses, current] = await Promise.all([getBusinesses(), getCurrentBusiness()]);

  if (businesses.length === 0 || !current) return null;

  return <BusinessSwitcherClient businesses={businesses} currentId={current.id} />;
}
