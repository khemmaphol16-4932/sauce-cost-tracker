"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/modal";
import { ConfirmModal } from "@/components/confirm-modal";
import { deleteIngredient, logPurchase, updateIngredient } from "./actions";
import type { IngredientWithLastPurchase } from "@/lib/data/ingredients";

const todayISO = () => new Date().toISOString().slice(0, 10);
const NEW_BRAND_VALUE = "__new__";

export function IngredientRow({
  ingredient,
  brands = [],
}: {
  ingredient: IngredientWithLastPurchase;
  brands?: string[];
}) {
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [brandChoice, setBrandChoice] = useState("");
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
      const result = await logPurchase(formData);
      if (result?.error) setError(result.error);
      else {
        setPurchaseOpen(false);
        setBrandChoice("");
      }
    });
  };

  const submitEdit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await updateIngredient(formData);
      if (result?.error) setError(result.error);
      else setEditOpen(false);
    });
  };

  const onDelete = () => {
    const formData = new FormData();
    formData.set("id", ingredient.id);
    startTransition(async () => {
      await deleteIngredient(formData);
    });
  };

  return (
    <li className="flex items-center gap-3 border-b border-border py-3 last:border-0">
      <button
        onClick={() => setEditOpen(true)}
        className="min-w-0 flex-1 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-text">{ingredient.name}</span>
          {isLow && (
            <span className="shrink-0 rounded-full bg-alert-bg px-2 py-0.5 text-[11px] font-medium text-alert">
              low
            </span>
          )}
          {ingredient.price_jump_pct != null && (
            <span className="shrink-0 rounded-full bg-amber-500/20 px-2 py-0.5 text-[11px] font-medium text-amber-400">
              price +{ingredient.price_jump_pct.toFixed(0)}%
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-text-secondary">
          <span className="font-mono">{ingredient.qty_on_hand}</span> {ingredient.unit} on hand ·
          avg <span className="font-mono">฿{ingredient.avg_price_per_unit.toFixed(2)}</span>/
          {ingredient.unit}
          {ingredient.last_purchase_date && (
            <> · last bought {ingredient.last_purchase_date}</>
          )}
        </p>
      </button>

      <button
        onClick={() => setPurchaseOpen(true)}
        className="shrink-0 rounded-xl bg-accent px-4 py-3 text-sm font-medium text-[#121212] active:bg-accent/80"
      >
        + Purchase
      </button>

      <Modal
        open={purchaseOpen}
        onClose={() => {
          setPurchaseOpen(false);
          setBrandChoice("");
        }}
        title={`Log purchase — ${ingredient.name}`}
      >
        <form onSubmit={submitPurchase} className="space-y-4">
          <input type="hidden" name="ingredient_id" value={ingredient.id} />
          <div>
            <label className="block text-sm font-medium text-text-secondary">
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
              className="mt-1 w-full field-input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary">
              Brand (optional)
            </label>
            <select
              name="brand"
              value={brandChoice}
              onChange={(e) => setBrandChoice(e.target.value)}
              className="mt-1 w-full field-input"
            >
              <option value="">No brand</option>
              {brands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
              <option value={NEW_BRAND_VALUE}>+ Add new brand…</option>
            </select>
            {brandChoice === NEW_BRAND_VALUE && (
              <input
                name="new_brand"
                placeholder="e.g. CP, Aro…"
                required
                autoFocus
                className="mt-2 w-full field-input"
              />
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary">Total price paid (฿)</label>
            <input
              name="price_paid_total"
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              required
              className="mt-1 w-full field-input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary">Date</label>
            <input
              name="purchase_date"
              type="date"
              defaultValue={todayISO()}
              className="mt-1 w-full field-input"
            />
          </div>
          {error && <p className="text-sm text-alert">{error}</p>}
          <button
            type="submit"
            disabled={isPending}
            className="w-full btn-primary"
          >
            {isPending ? "Saving…" : "Save purchase"}
          </button>
        </form>
      </Modal>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit ingredient">
        <form onSubmit={submitEdit} className="space-y-4">
          <input type="hidden" name="id" value={ingredient.id} />
          <div>
            <label className="block text-sm font-medium text-text-secondary">Name</label>
            <input
              name="name"
              defaultValue={ingredient.name}
              required
              className="mt-1 w-full field-input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary">Unit</label>
            <input
              name="unit"
              defaultValue={ingredient.unit}
              required
              className="mt-1 w-full field-input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary">
              Low stock threshold (optional)
            </label>
            <input
              name="low_stock_threshold"
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              defaultValue={ingredient.low_stock_threshold ?? ""}
              className="mt-1 w-full field-input"
            />
          </div>
          {error && <p className="text-sm text-alert">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 btn-primary"
            >
              {isPending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setDeleteConfirmOpen(true)}
              disabled={isPending}
              className="rounded-xl border border-alert/40 px-4 py-3 text-base font-medium text-alert"
            >
              Delete
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={() => {
          setDeleteConfirmOpen(false);
          setEditOpen(false);
          onDelete();
        }}
        title="Delete ingredient"
        message={`Delete "${ingredient.name}"? This cannot be undone.`}
        isPending={isPending}
      />
    </li>
  );
}
