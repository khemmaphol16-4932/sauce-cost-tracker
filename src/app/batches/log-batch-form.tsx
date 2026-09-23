"use client";

import { useMemo, useState, useTransition } from "react";
import { logBatch } from "./actions";
import { todayISO } from "@/lib/dates";

type RecipeOption = {
  id: string;
  name: string;
  estimatedBottles: number;
  sopSteps: { id: string; instruction: string }[];
};

export function LogBatchForm({ recipes }: { recipes: RecipeOption[] }) {
  const [recipeId, setRecipeId] = useState(recipes[0]?.id ?? "");
  const [override, setOverride] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [checkedSteps, setCheckedSteps] = useState<Set<string>>(new Set());

  const selectedRecipe = useMemo(
    () => recipes.find((r) => r.id === recipeId),
    [recipeId, recipes]
  );
  const estimated = selectedRecipe?.estimatedBottles ?? 0;
  const sopSteps = selectedRecipe?.sopSteps ?? [];
  const allStepsChecked = sopSteps.length === 0 || sopSteps.every((s) => checkedSteps.has(s.id));

  const onSelectRecipe = (id: string) => {
    setRecipeId(id);
    setCheckedSteps(new Set());
  };

  const toggleStep = (id: string) => {
    setCheckedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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
      const result = await logBatch(formData);
      if (result?.error) {
        setError(result.error);
      } else {
        setOverride("");
        setSuccess(true);
        setCheckedSteps(new Set());
      }
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4 card">
      <div>
        <label className="block text-sm font-medium text-text-secondary">Recipe</label>
        <input type="hidden" name="recipe_id" value={recipeId} required />
        <div className="mt-1 grid grid-cols-2 gap-2">
          {recipes.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => onSelectRecipe(r.id)}
              className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                r.id === recipeId
                  ? "border-accent bg-accent/10"
                  : "border-border bg-bg active:bg-surface-hover"
              }`}
            >
              <p className="truncate text-sm font-medium text-text">{r.name}</p>
              <p className="mt-0.5 font-mono text-xs text-text-secondary">
                ~{r.estimatedBottles} bottles
              </p>
            </button>
          ))}
        </div>
      </div>
      {sopSteps.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-text-secondary">
            SOP checklist ({checkedSteps.size}/{sopSteps.length})
          </label>
          <ul className="mt-1 space-y-1 rounded-lg border border-border bg-bg p-2">
            {sopSteps.map((s) => (
              <li key={s.id}>
                <label className="flex items-start gap-2 text-sm text-text">
                  <input
                    type="checkbox"
                    checked={checkedSteps.has(s.id)}
                    onChange={() => toggleStep(s.id)}
                    className="mt-0.5"
                  />
                  <span>{s.instruction}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
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
      {!allStepsChecked && (
        <p className="text-xs text-text-secondary">Check off every SOP step to log this batch.</p>
      )}
      <button
        type="submit"
        disabled={isPending || !allStepsChecked}
        className="w-full btn-primary disabled:opacity-50"
      >
        {isPending ? "Logging…" : "Log batch"}
      </button>
    </form>
  );
}
