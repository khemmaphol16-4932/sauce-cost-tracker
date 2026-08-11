import Link from "next/link";
import { getDashboardData } from "@/lib/data/dashboard";
import { MonthlySpendChart, RecipeMarginChart, RealMarginChart } from "./charts";

export default async function DashboardPage() {
  const data = await getDashboardData();

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <StatCard label="Revenue" value={`฿${data.revenueTotal.toFixed(0)}`} href="/sales" />
        <StatCard label="Ingredients" value={data.ingredientCount} />
        <StatCard label="Recipes" value={data.recipeCount} />
        <StatCard label="Batches" value={data.batchCount} />
        <StatCard label="Stock value" value={`฿${data.totalStockValue.toFixed(0)}`} />
        <StatCard
          label="Low stock"
          value={data.lowStockCount}
          href="/stock/low"
          tone={data.lowStockCount > 0 ? "alert" : undefined}
        />
        <StatCard
          label="Price jumps"
          value={data.priceJumpCount}
          href="/stock"
          tone={data.priceJumpCount > 0 ? "alert" : undefined}
        />
      </div>

      <div className="card">
        <h2 className="mb-1 text-sm font-semibold text-text">Real margin / month</h2>
        <p className="mb-2 text-xs text-text-secondary">
          From actual sales, last 6 months, this business
        </p>
        <RealMarginChart data={data.realMarginTrend} />
      </div>

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
        <h2 className="mb-1 text-sm font-semibold text-text">Ingredient spend / month</h2>
        <p className="mb-2 text-xs text-text-secondary">Last 6 months, this business</p>
        <MonthlySpendChart data={data.monthlySpend} />
      </div>

      <div className="card">
        <h2 className="mb-1 text-sm font-semibold text-text">Margin by recipe</h2>
        <p className="mb-2 text-xs text-text-secondary">
          Recipes with a target sell price set
        </p>
        <RecipeMarginChart data={data.recipeMargins} />
      </div>

      <div className="card">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text">Recent purchases</h2>
          <Link href="/stock" className="text-xs text-accent underline underline-offset-2">
            View all
          </Link>
        </div>
        {data.recentPurchases.length === 0 ? (
          <p className="py-2 text-sm text-text-secondary">No purchases logged yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {data.recentPurchases.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate text-text">{p.ingredient_name}</p>
                  <p className="text-xs text-text-secondary">
                    {p.purchase_date} · <span className="font-mono">{p.qty_bought}</span>
                  </p>
                </div>
                <span className="shrink-0 font-mono text-text">
                  ฿{p.price_paid_total.toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text">Recent batches</h2>
          <Link href="/batches" className="text-xs text-accent underline underline-offset-2">
            View all
          </Link>
        </div>
        {data.recentBatches.length === 0 ? (
          <p className="py-2 text-sm text-text-secondary">No batches logged yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {data.recentBatches.map((b) => (
              <li key={b.id} className="flex items-center justify-between py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate text-text">{b.recipe_name}</p>
                  <p className="text-xs text-text-secondary">{b.batch_date}</p>
                </div>
                <span className="shrink-0 font-mono text-text-secondary">
                  {b.actual_yield_bottles ?? "?"} bottles
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  href,
  tone,
}: {
  label: string;
  value: string | number;
  href?: string;
  tone?: "alert";
}) {
  const content = (
    <div className="card !p-3">
      <p className="truncate text-[11px] text-text-secondary">{label}</p>
      <p
        className={`font-mono text-lg font-bold ${tone === "alert" ? "text-alert" : "text-text"}`}
      >
        {value}
      </p>
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}
