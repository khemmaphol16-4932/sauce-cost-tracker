import { getReceiptProfile } from "@/lib/data/receipt-profile";
import { getCurrentBusinessId } from "@/lib/data/businesses";
import { getRecentPrintJobs } from "./actions";
import { PrintStation } from "./print-station";

export default async function PrintStationPage() {
  const [profile, businessId, recent] = await Promise.all([
    getReceiptProfile(),
    getCurrentBusinessId(),
    getRecentPrintJobs(),
  ]);

  return (
    <PrintStation
      profile={profile}
      businessId={businessId}
      initialJobs={"jobs" in recent ? recent.jobs : []}
      setupError={"error" in recent ? recent.error : null}
    />
  );
}
