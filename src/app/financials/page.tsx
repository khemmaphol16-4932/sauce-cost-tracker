import Link from "next/link";
import { getFinancialsSummary } from "@/lib/data/financials";
import { FinancialsChart } from "./financials-chart";

export default async function FinancialsPage() {
  const data = await getFinancialsSummary();

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="card">
          <p className="text-xs text-text-secondary">Revenue (6mo)</p>
          <p className="mt-1 font-mono text-2xl font-bold text-success">
            ฿{data.totalRevenue.toFixed(0)}
          </p>
        </div>
        <div className="card">
          <p className="text-xs text-text-secondary">Net profit (6mo)</p>
          <p
            className={`mt-1 font-mono text-2xl font-bold ${
              data.totalNetProfit >= 0 ? "text-success" : "text-alert"
            }`}
          >
            ฿{data.totalNetProfit.toFixed(0)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Link href="/financials/purchases" className="card">
          <p className="text-xs text-text-secondary">Ingredient spend (6mo)</p>
          <p className="mt-1 font-mono text-2xl font-bold text-accent">
            ฿{data.totalIngredientSpend.toFixed(0)}
          </p>
          <p className="mt-1 text-xs text-accent underline underline-offset-2">Buying list →</p>
        </Link>
        <Link href="/financials/expenses" className="card">
          <p className="text-xs text-text-secondary">Other expenses (6mo)</p>
          <p className="mt-1 font-mono text-2xl font-bold text-alert">
            ฿{data.totalExpenses.toFixed(0)}
          </p>
          <p className="mt-1 text-xs text-accent underline underline-offset-2">Log / view →</p>
        </Link>
      </div>

      <div className="card">
        <h2 className="mb-1 text-sm font-semibold text-text">Money in vs. money out</h2>
        <p className="mb-2 text-xs text-text-secondary">Last 6 months, by month</p>
        <FinancialsChart data={data.months} />
      </div>

      <div className="card">
        <h2 className="mb-2 text-sm font-semibold text-text">Monthly breakdown</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="text-left text-xs text-text-secondary">
                <th className="pb-2 font-medium">Month</th>
                <th className="pb-2 font-medium">Revenue</th>
                <th className="pb-2 font-medium">Ingredients</th>
                <th className="pb-2 font-medium">Expenses</th>
                <th className="pb-2 font-medium">Net</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.months.map((m) => (
                <tr key={m.month}>
                  <td className="py-1.5 text-text">{m.month}</td>
                  <td className="py-1.5 font-mono text-text-secondary">฿{m.revenue.toFixed(0)}</td>
                  <td className="py-1.5 font-mono text-text-secondary">
                    ฿{m.ingredientSpend.toFixed(0)}
                  </td>
                  <td className="py-1.5 font-mono text-text-secondary">
                    ฿{m.expenses.toFixed(0)}
                  </td>
                  <td
                    className={`py-1.5 font-mono ${m.netProfit >= 0 ? "text-success" : "text-alert"}`}
                  >
                    ฿{m.netProfit.toFixed(0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
