"use client";

import { useRef, useState, useTransition } from "react";
import { Modal } from "@/components/modal";
import { createRecipe } from "./actions";

export function NewRecipeButton() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      // On success createRecipe() calls redirect(), which throws internally and
      // is handled by Next's client runtime — it never reaches this line.
      const result = await createRecipe(formData);
      if (result?.error) setError(result.error);
    });
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-xl border-2 border-dashed border-border py-3 text-sm font-medium text-text-secondary active:bg-surface-hover"
      >
        + New recipe
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="New recipe">
        <form ref={formRef} onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary">Name</label>
            <input
              name="name"
              required
              autoFocus
              placeholder="e.g. สูตรเผ็ด"
              className="mt-1 w-full field-input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary">Batch volume (ml)</label>
            <input
              name="batch_volume_ml"
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              required
              className="mt-1 w-full field-input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary">Bottle size (ml)</label>
            <input
              name="bottle_size_ml"
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              required
              className="mt-1 w-full field-input"
            />
          </div>
          {error && <p className="text-sm text-alert">{error}</p>}
          <button
            type="submit"
            disabled={isPending}
            className="w-full btn-primary"
          >
            {isPending ? "Creating…" : "Create & edit recipe"}
          </button>
        </form>
      </Modal>
    </>
  );
}
