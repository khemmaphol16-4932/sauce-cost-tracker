"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/modal";
import { deleteIngredient, logPurchase, updateIngredient } from "./actions";
import type { IngredientWithLastPurchase } from "@/lib/data/ingredients";

const todayISO = () => new Date().toISOString().slice(0, 10);

export function IngredientRow({ ingredient }: { ingredient: IngredientWithLastPurchase }) {
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isLow =
    ingredient.low_stock_threshold != null &&
    ingredient.qty_on_hand < ingredient.low_stock_threshold;

  const submitPurchase = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      try {
        await logPurchase(formData);
        setPurchaseOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to log purchase");
      }
    });
  };

  const submitEdit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      try {
        await updateIngredient(formData);
        setEditOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save");
      }
    });
  };

  const onDelete = () => {
    if (!confirm(`Delete "${ingredient.name}"? This cannot be undone.`)) return;
    const formData = new FormData();
    formData.set("id", ingredient.id);
    startTransition(async () => {
      await deleteIngredient(formData);
    });
  };

  return (
    <li className="flex items-center gap-3 border-b border-neutral-100 py-3 last:border-0">
      <button
        onClick={() => setEditOpen(true)}
        className="min-w-0 flex-1 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-neutral-900">{ingredient.name}</span>
          {isLow && (
            <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700">
              low
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-neutral-500">
          {ingredient.qty_on_hand} {ingredient.unit} on hand · avg ฿
          {ingredient.avg_price_per_unit.toFixed(2)}/{ingredient.unit}
          {ingredient.last_purchase_date && (
            <> · last bought {ingredient.last_purchase_date}</>
          )}
        </p>
      </button>

      <button
        onClick={() => setPurchaseOpen(true)}
        className="shrink-0 rounded-xl bg-neutral-900 px-4 py-3 text-sm font-medium text-white active:bg-neutral-700"
      >
        + Purchase
      </button>

      <Modal open={purchaseOpen} onClose={() => setPurchaseOpen(false)} title={`Log purchase — ${ingredient.name}`}>
        <form onSubmit={submitPurchase} className="space-y-4">
          <input type="hidden" name="ingredient_id" value={ingredient.id} />
          <div>
            <label className="block text-sm font-medium text-neutral-700">
              Qty bought ({ingredient.unit})
            </label>
            <input
              name="qty_bought"
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              required
              autoFocus
              className="mt-1 w-full rounded-lg border border-neutral-300 px-4 py-3 text-base"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700">Total price paid (฿)</label>
            <input
              name="price_paid_total"
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              required
              className="mt-1 w-full rounded-lg border border-neutral-300 px-4 py-3 text-base"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700">Date</label>
            <input
              name="purchase_date"
              type="date"
              defaultValue={todayISO()}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-4 py-3 text-base"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-xl bg-neutral-900 py-3 text-base font-medium text-white disabled:opacity-50"
          >
            {isPending ? "Saving…" : "Save purchase"}
          </button>
        </form>
      </Modal>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit ingredient">
        <form onSubmit={submitEdit} className="space-y-4">
          <input type="hidden" name="id" value={ingredient.id} />
          <div>
            <label className="block text-sm font-medium text-neutral-700">Name</label>
            <input
              name="name"
              defaultValue={ingredient.name}
              required
              className="mt-1 w-full rounded-lg border border-neutral-300 px-4 py-3 text-base"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700">Unit</label>
            <input
              name="unit"
              defaultValue={ingredient.unit}
              required
              className="mt-1 w-full rounded-lg border border-neutral-300 px-4 py-3 text-base"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700">
              Low stock threshold (optional)
            </label>
            <input
              name="low_stock_threshold"
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              defaultValue={ingredient.low_stock_threshold ?? ""}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-4 py-3 text-base"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 rounded-xl bg-neutral-900 py-3 text-base font-medium text-white disabled:opacity-50"
            >
              {isPending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={isPending}
              className="rounded-xl border border-red-200 px-4 py-3 text-base font-medium text-red-600"
            >
              Delete
            </button>
          </div>
        </form>
      </Modal>
    </li>
  );
}
