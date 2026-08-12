import Link from "next/link";
import { getExpenses } from "@/lib/data/expenses";
import { ExpenseForm } from "../expense-form";
import { ExpenseListRow } from "../expense-list";

export default async function ExpensesPage() {
  const expenses = await getExpenses();

  return (
    <div className="space-y-4">
      <Link href="/financials" className="text-xs text-accent underline underline-offset-2">
        ← Financials overview
      </Link>

      <ExpenseForm />

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-secondary">
          Expense history
        </p>
        {expenses.length === 0 ? (
          <p className="py-4 text-center text-sm text-text-secondary">No expenses logged yet.</p>
        ) : (
          <ul className="rounded-2xl border border-border bg-surface px-4 shadow-sm">
            {expenses.map((e) => (
              <ExpenseListRow key={e.id} expense={e} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
