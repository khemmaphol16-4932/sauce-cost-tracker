import { getClosingData } from "@/lib/data/closing";
import { ClosingForm } from "./closing-form";
import { todayISO } from "@/lib/dates";

export default async function ClosingPage() {
  const data = await getClosingData(todayISO());

  return (
    <div className="space-y-4">
      <ClosingForm data={data} />
    </div>
  );
}
