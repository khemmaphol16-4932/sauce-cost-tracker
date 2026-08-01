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
      try {
        await addIngredient(formData);
        formRef.current?.reset();
        setOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add ingredient");
      }
    });
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-xl border-2 border-dashed border-neutral-300 py-3 text-sm font-medium text-neutral-600 active:bg-neutral-50"
      >
        + Add ingredient
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Add ingredient">
        <form ref={formRef} onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700">Name</label>
            <input
              name="name"
              required
              autoFocus
              placeholder="e.g. พริกแดง, Vinegar"
              className="mt-1 w-full rounded-lg border border-neutral-300 px-4 py-3 text-base"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700">Unit</label>
            <input
              name="unit"
              required
              placeholder="e.g. กรัม, มล., ชิ้น"
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
              className="mt-1 w-full rounded-lg border border-neutral-300 px-4 py-3 text-base"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-xl bg-neutral-900 py-3 text-base font-medium text-white disabled:opacity-50"
          >
            {isPending ? "Adding…" : "Add ingredient"}
          </button>
        </form>
      </Modal>
    </>
  );
}
