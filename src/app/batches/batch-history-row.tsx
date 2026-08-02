"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/modal";
import { updateBatch } from "./actions";
import type { BatchHistoryRow as BatchHistoryRowType } from "@/lib/data/batches";

export function BatchHistoryRow({ batch }: { batch: BatchHistoryRowType }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      try {
        await updateBatch(formData);
        setOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save");
      }
    });
  };

  return (
    <li className="border-b border-border py-3 last:border-0">
      <button onClick={() => setOpen(true)} className="block w-full text-left">
        <div className="flex items-center justify-between">
          <span className="font-medium text-text">{batch.recipe_name}</span>
          <span className="text-xs text-text-secondary">{batch.batch_date}</span>
        </div>
        <p className="mt-0.5 text-xs text-text-secondary">
          <span className="font-mono">{batch.actual_yield_bottles ?? "?"}</span> bottles
          {batch.cost_per_bottle_snapshot != null && (
            <>
              {" "}
              · <span className="font-mono">฿{batch.cost_per_bottle_snapshot.toFixed(2)}</span>
              /bottle at the time
            </>
          )}
        </p>
        {batch.notes && <p className="mt-1 text-sm text-text-secondary">{batch.notes}</p>}
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title={`Edit batch — ${batch.recipe_name}`}>
        <form onSubmit={submit} className="space-y-4">
          <input type="hidden" name="id" value={batch.id} />
          <div>
            <label className="block text-sm font-medium text-text-secondary">Date</label>
            <input
              name="batch_date"
              type="date"
              defaultValue={batch.batch_date}
              required
              className="mt-1 field-input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary">Bottle yield</label>
            <input
              name="actual_yield_bottles"
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              defaultValue={batch.actual_yield_bottles ?? ""}
              required
              className="mt-1 field-input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary">Notes</label>
            <textarea
              name="notes"
              rows={2}
              defaultValue={batch.notes ?? ""}
              className="mt-1 field-input"
            />
          </div>
          {error && <p className="text-sm text-alert">{error}</p>}
          <button type="submit" disabled={isPending} className="w-full btn-primary">
            {isPending ? "Saving…" : "Save"}
          </button>
        </form>
      </Modal>
    </li>
  );
}
