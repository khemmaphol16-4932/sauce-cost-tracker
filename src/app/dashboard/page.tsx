import Link from "next/link";
import { getDashboardData } from "@/lib/data/dashboard";
import { ChartTabs } from "./chart-tabs";

export default async function DashboardPage() {
  const data = await getDashboardData();
  const needsAttention = data.lowStockCount > 0 || data.priceJumpCount > 0;

  return (
    <div className="space-y-4">
      {needsAttention && (
        <div className="rounded-2xl border border-alert/40 bg-alert-bg p-4">
          <h2 className="mb-2 text-sm font-semibold text-alert">Needs attention</h2>
          <ul className="space-y-1.5">
            {data.lowStockCount > 0 && (
              <li>
                <Link
                  href="/stock/low"
                  className="flex items-center justify-between text-sm text-text hover:underline"
                >
                  <span>
                    <span className="font-mono font-semibold">{data.lowStockCount}</span> item
                    {data.lowStockCount === 1 ? "" : "s"} low on stock
                  </span>
                  <span className="text-alert">→</span>
                </Link>
              </li>
            )}
            {data.priceJumpCount > 0 && (
              <li>
                <Link
                  href="/stock"
                  className="flex items-center justify-between text-sm text-text hover:underline"
                >
                  <span>
                    <span className="font-mono font-semibold">{data.priceJumpCount}</span> price
                    jump{data.priceJumpCount === 1 ? "" : "s"} detected
                  </span>
                  <span className="text-alert">→</span>
                </Link>
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Hero KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/sales" className="card">
          <p className="text-xs text-text-secondary">Revenue</p>
          <p className="mt-1 font-mono text-3xl font-bold text-success">
            ฿{data.revenueTotal.toFixed(0)}
          </p>
        </Link>
        <div className="card">
          <p className="text-xs text-text-secondary">This month&apos;s spend</p>
          <p className="mt-1 font-mono text-3xl font-bold text-accent">
            ฿{data.thisMonthSpend.toFixed(0)}
          </p>
        </div>
      </div>

      {/* Compact overview strip */}
      <div className="card flex items-center justify-around !py-3 text-center">
        <OverviewStat label="Ingredients" value={data.ingredientCount} />
        <div className="h-8 w-px bg-border" />
        <OverviewStat label="Recipes" value={data.recipeCount} />
        <div className="h-8 w-px bg-border" />
        <OverviewStat label="Batches" value={data.batchCount} />
        <div className="h-8 w-px bg-border" />
        <Link href="/stock">
          <OverviewStat label="Stock value" value={`฿${data.totalStockValue.toFixed(0)}`} />
        </Link>
      </div>

      <ChartTabs
        realMarginTrend={data.realMarginTrend}
        monthlySpend={data.monthlySpend}
        topIngredientsBySpend={data.topIngredientsBySpend}
        recipeMargins={data.recipeMargins}
        costTrend={data.costTrend}
      />

      <div className="card">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text">Best sellers</h2>
          <Link href="/sales" className="text-xs text-accent underline underline-offset-2">
            View all
          </Link>
        </div>
        {data.bestSellers.length === 0 ? (
          <p className="py-2 text-sm text-text-secondary">No sales logged yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {data.bestSellers.map((b) => (
              <li key={b.recipe_id} className="flex items-center justify-between py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate text-text">{b.recipe_name}</p>
                  <p className="text-xs text-text-secondary">
                    <span className="font-mono">{b.qtySold}</span> bottles sold
                  </p>
                </div>
                <span className="shrink-0 font-mono text-text">฿{b.revenue.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text">Recent activity</h2>
          <div className="flex gap-3 text-xs">
            <Link href="/stock" className="text-accent underline underline-offset-2">
              Stock
            </Link>
            <Link href="/batches" className="text-accent underline underline-offset-2">
              Batches
            </Link>
          </div>
        </div>
        {data.recentActivity.length === 0 ? (
          <p className="py-2 text-sm text-text-secondary">
            No purchases or batches logged yet.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {data.recentActivity.map((item) => (
              <li key={`${item.kind}-${item.id}`} className="flex items-center gap-3 py-2 text-sm">
                <span
                  className={`shrink-0 rounded-full px-1.5 py-0.5 text-xs font-medium ${
                    item.kind === "purchase"
                      ? "bg-accent/15 text-accent"
                      : "bg-success/15 text-success"
                  }`}
                >
                  {item.kind === "purchase" ? "Buy" : "Batch"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-text">{item.title}</p>
                  <p className="text-xs text-text-secondary">
                    {item.date} · {item.detail}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-text">{item.amount}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function OverviewStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <p className="font-mono text-xl font-bold text-text">{value}</p>
      <p className="text-xs text-text-secondary">{label}</p>
    </div>
  );
}
