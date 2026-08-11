"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/modal";
import { adjustFinishedGoods, updateFinishedGoodsThreshold } from "@/app/sales/actions";
import type { FinishedGoodsRow as FinishedGoodsRowType } from "@/lib/data/finished-goods";

export function FinishedGoodsRow({ item }: { item: FinishedGoodsRowType }) {
  const [open, setOpen] = useState(false);
  const [threshold, setThreshold] = useState(item.low_stock_threshold?.toString() ?? "");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isLow = item.low_stock_threshold != null && item.qty_on_hand < item.low_stock_threshold;

  const saveThreshold = () => {
    const formData = new FormData();
    formData.set("recipe_id", item.recipe_id);
    formData.set("low_stock_threshold", threshold);
    startTransition(async () => {
      await updateFinishedGoodsThreshold(formData);
    });
  };

  const submitAdjust = (e: React.FormEvent<HTMLFormElement>) => {
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
    <li className="flex items-center gap-2 py-2 text-sm">
      <button onClick={() => setOpen(true)} className="min-w-0 flex-1 text-left">
        <span className="truncate text-text">{item.recipe_name}</span>
        {isLow && (
          <span className="ml-2 rounded-full bg-alert-bg px-2 py-0.5 text-[11px] font-medium text-alert">
            low
          </span>
        )}
      </button>
      <span className="font-mono text-text-secondary">{item.qty_on_hand}</span>

      <Modal open={open} onClose={() => setOpen(false)} title={`Bottles — ${item.recipe_name}`}>
        <div className="space-y-5">
          <div>
            <p className="text-sm text-text-secondary">
              Currently <span className="font-mono">{item.qty_on_hand}</span> bottles.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary">
              Low stock threshold
            </label>
            <input
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              onBlur={saveThreshold}
              disabled={isPending}
              className="mt-1 w-full field-input"
            />
          </div>

          <form onSubmit={submitAdjust} className="space-y-4 border-t border-border pt-4">
            <p className="text-sm font-medium text-text-secondary">Adjust quantity</p>
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
        </div>
      </Modal>
    </li>
  );
}
