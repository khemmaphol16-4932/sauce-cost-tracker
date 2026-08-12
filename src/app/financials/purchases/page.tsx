import Link from "next/link";
import { getPurchases } from "@/lib/data/purchases";

export default async function PurchasesPage() {
  const purchases = await getPurchases();
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

      {purchases.length === 0 ? (
        <p className="py-8 text-center text-sm text-text-secondary">
          No purchases logged yet. Log one from the Stock tab.
        </p>
      ) : (
        <ul className="rounded-2xl border border-border bg-surface px-4 shadow-sm">
          {purchases.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2 border-b border-border py-3 last:border-0">
              <div className="min-w-0">
                <p className="truncate font-medium text-text">{p.ingredient_name}</p>
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
