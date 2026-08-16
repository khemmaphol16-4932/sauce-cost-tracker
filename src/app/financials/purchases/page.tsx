import Link from "next/link";
import { getPurchases, getBrandSpend } from "@/lib/data/purchases";

export default async function PurchasesPage() {
  const [purchases, brandSpend] = await Promise.all([getPurchases(), getBrandSpend()]);
  const total = purchases.reduce((sum, p) => sum + p.price_paid_total, 0);

  return (
    <div className="space-y-4">
      <Link href="/financials" className="text-xs text-accent underline underline-offset-2">
        ← Financials overview
      </Link>

      <p className="text-sm text-text-secondary">
        Every ingredient purchase logged from the{" "}
        <Link href="/stock" className="underline">
          Stock
        </Link>{" "}
        tab. This is the full buying list.
      </p>

      <div className="card">
        <p className="text-xs text-text-secondary">Total spent, all time</p>
        <p className="mt-1 font-mono text-2xl font-bold text-accent">฿{total.toFixed(2)}</p>
      </div>

      {brandSpend.length > 0 && (
        <div className="card">
          <h2 className="mb-1 text-sm font-semibold text-text">Spend by brand</h2>
          <p className="mb-2 text-xs text-text-secondary">
            Ingredients bought under more than one brand
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[380px] text-sm">
              <thead>
                <tr className="text-left text-xs text-text-secondary">
                  <th className="pb-2 font-medium">Ingredient</th>
                  <th className="pb-2 font-medium">Brand</th>
                  <th className="pb-2 font-medium">Qty</th>
                  <th className="pb-2 font-medium">Total spent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {brandSpend.map((row) => (
                  <tr key={`${row.ingredient_name}::${row.brand}`}>
                    <td className="py-1.5 text-text">{row.ingredient_name}</td>
                    <td className="py-1.5 text-text-secondary">{row.brand}</td>
                    <td className="py-1.5 font-mono text-text-secondary">{row.qty}</td>
                    <td className="py-1.5 font-mono text-text">฿{row.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {purchases.length === 0 ? (
        <p className="py-8 text-center text-sm text-text-secondary">
          No purchases logged yet. Log one from the Stock tab.
        </p>
      ) : (
        <ul className="rounded-2xl border border-border bg-surface px-4 shadow-sm">
          {purchases.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2 border-b border-border py-3 last:border-0">
              <div className="min-w-0">
                <p className="truncate font-medium text-text">
                  {p.ingredient_name}
                  {p.brand && <span className="text-text-secondary"> · {p.brand}</span>}
                </p>
                <p className="text-xs text-text-secondary">
                  <span className="font-mono">{p.qty_bought}</span> · {p.purchase_date}
                </p>
              </div>
              <span className="shrink-0 font-mono text-text">฿{p.price_paid_total.toFixed(2)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
