"use client";

import { useState, useTransition } from "react";
import { ConfirmModal } from "@/components/confirm-modal";
import { deleteExpense } from "./actions";
import type { ExpenseRow } from "@/lib/data/expenses";

export function ExpenseListRow({ expense }: { expense: ExpenseRow }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const onDelete = () => {
    const formData = new FormData();
    formData.set("id", expense.id);
    startTransition(async () => {
      await deleteExpense(formData);
    });
  };

  return (
    <li className="flex items-start justify-between gap-2 border-b border-border py-3 last:border-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="shrink-0 rounded-full bg-surface px-2 py-0.5 text-xs font-medium capitalize text-text-secondary">
            {expense.category}
          </span>
          <span className="font-mono text-text">฿{expense.amount.toFixed(2)}</span>
        </div>
        <p className="mt-0.5 text-xs text-text-secondary">
          {expense.expense_date}
          {expense.description && <> · {expense.description}</>}
        </p>
      </div>
      <button
        onClick={() => setConfirmOpen(true)}
        disabled={isPending}
        className="shrink-0 px-2 text-xs text-alert"
      >
        Delete
      </button>

      <ConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          onDelete();
        }}
        title="Delete expense"
        message={`Delete this ฿${expense.amount.toFixed(2)} expense? This cannot be undone.`}
        confirmLabel="Delete"
        isPending={isPending}
      />
    </li>
  );
}
