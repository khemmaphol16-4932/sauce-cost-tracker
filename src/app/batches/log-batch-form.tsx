"use client";

import { useMemo, useState, useTransition } from "react";
import { logBatch } from "./actions";

const todayISO = () => new Date().toISOString().slice(0, 10);

export function LogBatchForm({
  recipes,
}: {
  recipes: { id: string; name: string; estimatedBottles: number }[];
}) {
  const [recipeId, setRecipeId] = useState(recipes[0]?.id ?? "");
  const [override, setOverride] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const estimated = useMemo(
    () => recipes.find((r) => r.id === recipeId)?.estimatedBottles ?? 0,
    [recipeId, recipes]
  );

  if (recipes.length === 0) {
    return (
      <p className="card text-sm text-text-secondary">
        Create a recipe first on the Recipes tab, then come back here to log a batch.
      </p>
    );
  }

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      try {
        await logBatch(formData);
        setOverride("");
        setSuccess(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to log batch");
      }
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4 card">
      <div>
        <label className="block text-sm font-medium text-text-secondary">Recipe</label>
        <select
          name="recipe_id"
          value={recipeId}
          onChange={(e) => setRecipeId(e.target.value)}
          required
          className="mt-1 w-full field-input"
        >
          {recipes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-text-secondary">
          Bottle yield (estimated {estimated})
        </label>
        <input
          name="actual_yield_bottles"
          type="number"
          inputMode="decimal"
          step="any"
          min="0"
          value={override}
          onChange={(e) => setOverride(e.target.value)}
          placeholder={String(estimated)}
          className="mt-1 w-full field-input"
        />
        <p className="mt-1 text-xs text-text-secondary">Leave blank to use the estimate.</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-text-secondary">Date</label>
        <input
          name="batch_date"
          type="date"
          defaultValue={todayISO()}
          className="mt-1 w-full field-input"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-text-secondary">Notes (optional)</label>
        <textarea
          name="notes"
          rows={2}
          className="mt-1 w-full field-input"
        />
      </div>
      {error && <p className="text-sm text-alert">{error}</p>}
      {success && <p className="text-sm text-success">Batch logged and stock deducted.</p>}
      <button
        type="submit"
        disabled={isPending}
        className="w-full btn-primary"
      >
        {isPending ? "Logging…" : "Log batch"}
      </button>
    </form>
  );
}
