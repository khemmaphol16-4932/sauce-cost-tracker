import { getClosingData } from "@/lib/data/closing";
import { ClosingForm } from "./closing-form";

const todayISO = () => new Date().toISOString().slice(0, 10);

export default async function ClosingPage() {
  const data = await getClosingData(todayISO());

  return (
    <div className="space-y-4">
      <ClosingForm data={data} />
    </div>
  );
}
