"use client";

import { useRef, useState, useTransition } from "react";
import { Modal } from "@/components/modal";
import { addIngredient } from "./actions";

export function AddIngredientButton() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await addIngredient(formData);
      if (result?.error) {
        setError(result.error);
      } else {
        formRef.current?.reset();
        setOpen(false);
      }
    });
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-xl border-2 border-dashed border-border py-3 text-sm font-medium text-text-secondary active:bg-surface-hover"
      >
        + Add ingredient
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Add ingredient">
        <form ref={formRef} onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary">Name</label>
            <input
              name="name"
              required
              autoFocus
              placeholder="e.g. พริกแดง, Vinegar"
              className="mt-1 w-full field-input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary">Unit</label>
            <input
              name="unit"
              required
              placeholder="e.g. กรัม, มล., ชิ้น"
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
              className="mt-1 w-full field-input"
            />
          </div>
          {error && <p className="text-sm text-alert">{error}</p>}
          <button
            type="submit"
            disabled={isPending}
            className="w-full btn-primary"
          >
            {isPending ? "Adding…" : "Add ingredient"}
          </button>
        </form>
      </Modal>
    </>
  );
}
