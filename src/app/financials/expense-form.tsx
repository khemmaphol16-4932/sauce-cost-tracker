"use client";

import { useState, useTransition } from "react";
import { logExpense } from "./actions";
import { EXPENSE_CATEGORIES } from "@/lib/expense-categories";

const todayISO = () => new Date().toISOString().slice(0, 10);

export function ExpenseForm() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const form = e.currentTarget;
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const result = await logExpense(formData);
      if (result?.error) {
        setError(result.error);
      } else {
        setSuccess(true);
        form.reset();
      }
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4 card">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-text-secondary">Category</label>
          <select name="category" defaultValue="other" className="mt-1 w-full field-input">
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c} className="capitalize">
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary">Amount (฿)</label>
          <input
            name="amount"
            type="number"
            inputMode="decimal"
            step="any"
            min="0"
            required
            className="mt-1 w-full field-input"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-text-secondary">Date</label>
        <input
          name="expense_date"
          type="date"
          defaultValue={todayISO()}
          className="mt-1 w-full field-input"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-text-secondary">
          Description (optional)
        </label>
        <input
          name="description"
          placeholder="e.g. August rent, electric bill…"
          className="mt-1 w-full field-input"
        />
      </div>
      {error && <p className="text-sm text-alert">{error}</p>}
      {success && <p className="text-sm text-success">Expense logged.</p>}
      <button type="submit" disabled={isPending} className="w-full btn-primary">
        {isPending ? "Logging…" : "Log expense"}
      </button>
    </form>
  );
}
