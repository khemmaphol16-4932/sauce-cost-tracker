"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/modal";
import { ReasonPills } from "@/components/reason-pills";
import { adjustFinishedGoods, updateFinishedGoodsThreshold } from "@/app/sales/actions";
import type { FinishedGoodsRow as FinishedGoodsRowType } from "@/lib/data/finished-goods";

const todayISO = () => new Date().toISOString().slice(0, 10);
const COUNT_REASONS = ["recount", "breakage", "sample", "other"] as const;

export function FinishedGoodsRow({ item }: { item: FinishedGoodsRowType }) {
  const [open, setOpen] = useState(false);
  const [threshold, setThreshold] = useState(item.low_stock_threshold?.toString() ?? "");
  const [countedQty, setCountedQty] = useState(String(item.qty_on_hand));
  const [countReason, setCountReason] = useState<string>(COUNT_REASONS[0]);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isLow = item.low_stock_threshold != null && item.qty_on_hand < item.low_stock_threshold;
  const countedDelta = Number(countedQty) - item.qty_on_hand;
  const countedDeltaValid = countedQty !== "" && Number.isFinite(Number(countedQty));

  const saveThreshold = () => {
    const formData = new FormData();
    formData.set("recipe_id", item.recipe_id);
    formData.set("low_stock_threshold", threshold);
    startTransition(async () => {
      await updateFinishedGoodsThreshold(formData);
    });
  };

  const openModal = () => {
    setCountedQty(String(item.qty_on_hand));
    setCountReason(COUNT_REASONS[0]);
    setError(null);
    setOpen(true);
  };

  const submitAdjust = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("recipe_id", item.recipe_id);
    setError(null);
    startTransition(async () => {
      const result = await adjustFinishedGoods(formData);
      if (result?.error) setError(result.error);
      else setOpen(false);
    });
  };

  return (
    <li className="flex items-center gap-2 py-2 text-sm">
      <button onClick={openModal} className="min-w-0 flex-1 text-left">
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
            <p className="text-sm font-medium text-text-secondary">Stock count</p>
            <div>
              <label className="block text-sm font-medium text-text-secondary">
                Actual counted bottles
              </label>
              <input
                name="counted_qty"
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                required
                value={countedQty}
                onChange={(e) => setCountedQty(e.target.value)}
                className="mt-1 w-full field-input"
              />
              {countedDeltaValid && countedDelta !== 0 && (
                <p className="mt-1 text-xs text-text-secondary">
                  Will change by {countedDelta > 0 ? "+" : "−"}
                  {Math.abs(countedDelta)} bottles
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary">Reason</label>
              <div className="mt-1">
                <ReasonPills
                  options={COUNT_REASONS}
                  value={countReason}
                  onChange={setCountReason}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary">
                Note (optional)
              </label>
              <input name="notes" className="mt-1 w-full field-input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary">Date</label>
              <input
                name="adjustment_date"
                type="date"
                defaultValue={todayISO()}
                className="mt-1 w-full field-input"
              />
            </div>
            {error && <p className="text-sm text-alert">{error}</p>}
            <button type="submit" disabled={isPending} className="w-full btn-primary">
              {isPending ? "Saving…" : "Save count"}
            </button>
          </form>
        </div>
      </Modal>
    </li>
  );
}
