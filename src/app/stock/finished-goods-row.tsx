"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/modal";
import { adjustFinishedGoods } from "@/app/sales/actions";
import type { FinishedGoodsRow as FinishedGoodsRowType } from "@/lib/data/finished-goods";

export function FinishedGoodsRow({ item }: { item: FinishedGoodsRowType }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("recipe_id", item.recipe_id);
    setError(null);
    startTransition(async () => {
      const result = await adjustFinishedGoods(formData);
      if (result?.error) setError(result.error);
      else {
        setOpen(false);
        (e.target as HTMLFormElement).reset();
      }
    });
  };

  return (
    <li className="flex items-center justify-between py-2 text-sm">
      <button onClick={() => setOpen(true)} className="min-w-0 flex-1 truncate text-left text-text">
        {item.recipe_name}
      </button>
      <span className="font-mono text-text-secondary">{item.qty_on_hand}</span>

      <Modal open={open} onClose={() => setOpen(false)} title={`Adjust stock — ${item.recipe_name}`}>
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-text-secondary">
            Currently <span className="font-mono">{item.qty_on_hand}</span> bottles. Use a positive
            number to add, negative to remove (breakage, samples, miscounts).
          </p>
          <div>
            <label className="block text-sm font-medium text-text-secondary">Adjustment</label>
            <input
              name="delta"
              type="number"
              inputMode="decimal"
              step="any"
              required
              placeholder="e.g. -2"
              className="mt-1 w-full field-input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary">Reason</label>
            <input
              name="reason"
              required
              placeholder="e.g. broke 2 bottles during transfer"
              className="mt-1 w-full field-input"
            />
          </div>
          {error && <p className="text-sm text-alert">{error}</p>}
          <button type="submit" disabled={isPending} className="w-full btn-primary">
            {isPending ? "Saving…" : "Save adjustment"}
          </button>
        </form>
      </Modal>
    </li>
  );
}
