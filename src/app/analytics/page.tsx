import { getSalesAnalytics } from "@/lib/data/analytics";
import { getWasteSummary } from "@/lib/data/waste";
import { getIngredientOptions } from "@/lib/data/ingredients";
import { getFinishedGoodsStock } from "@/lib/data/finished-goods";
import { PeakHoursChart } from "./peak-hours-chart";
import { WasteForm } from "./waste-form";

export default async function AnalyticsPage() {
  const [{ retention, peakHours }, waste, ingredients, finishedGoods] = await Promise.all([
    getSalesAnalytics(),
    getWasteSummary(),
    getIngredientOptions(),
    getFinishedGoodsStock(),
  ]);

  return (
    <div className="space-y-4">
      <div className="card">
        <h2 className="mb-1 text-sm font-semibold text-text">Repeat customers</h2>
        <p className="mb-3 text-xs text-text-secondary">
          Customers with 2+ sales in the trailing window (needs a customer/room entered on each
          sale)
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="text-left text-xs text-text-secondary">
                <th className="pb-2 font-medium">Window</th>
                <th className="pb-2 font-medium">Customers</th>
                <th className="pb-2 font-medium">Repeat</th>
                <th className="pb-2 font-medium">Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {retention.map((w) => (
                <tr key={w.days}>
                  <td className="py-1.5 font-mono text-text">{w.days}d</td>
                  <td className="py-1.5 font-mono text-text-secondary">{w.uniqueCustomers}</td>
                  <td className="py-1.5 font-mono text-text-secondary">{w.repeatCustomers}</td>
                  <td className="py-1.5 font-mono text-text">
                    {w.repeatRatePct != null ? `${w.repeatRatePct.toFixed(0)}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2 className="mb-1 text-sm font-semibold text-text">Peak order times</h2>
        <p className="mb-2 text-xs text-text-secondary">
          By hour logged (Bangkok time) — accurate if sales are logged close to when they happen
        </p>
        <PeakHoursChart data={peakHours} />
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-secondary">
          Waste
        </p>
        <WasteForm ingredients={ingredients} finishedGoods={finishedGoods} />
      </div>

      {waste.byReason.length > 0 && (
        <div className="card">
          <h2 className="mb-2 text-sm font-semibold text-text">Waste by reason</h2>
          <ul className="divide-y divide-border">
            {waste.byReason.map((r) => (
              <li key={r.reason} className="flex items-center justify-between py-2 text-sm">
                <span className="capitalize text-text">{r.reason}</span>
                <span className="font-mono text-text-secondary">{r.count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card">
        <h2 className="mb-2 text-sm font-semibold text-text">Recent waste</h2>
        {waste.recent.length === 0 ? (
          <p className="py-2 text-sm text-text-secondary">Nothing logged yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {waste.recent.map((w) => (
              <li key={w.id} className="py-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-text">{w.item_name}</span>
                  <span className="text-xs text-text-secondary">{w.waste_date}</span>
                </div>
                <p className="text-xs text-text-secondary">
                  <span className="font-mono">{w.qty}</span> · {w.reason}
                </p>
                {w.notes && <p className="mt-0.5 text-xs text-text-secondary">{w.notes}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
