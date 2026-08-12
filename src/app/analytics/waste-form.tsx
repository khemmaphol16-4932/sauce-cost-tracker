"use client";

import { useState, useTransition } from "react";
import { logWaste } from "./actions";

const todayISO = () => new Date().toISOString().slice(0, 10);
const REASON_OPTIONS = ["spoiled", "burnt", "dropped", "expired", "other"] as const;

export function WasteForm({
  ingredients,
  finishedGoods,
}: {
  ingredients: { id: string; name: string; unit: string }[];
  finishedGoods: { recipe_id: string; recipe_name: string }[];
}) {
  const [kind, setKind] = useState<"ingredient" | "finished_goods">("ingredient");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const items = kind === "ingredient" ? ingredients : finishedGoods;
  const noItems = items.length === 0;

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("kind", kind);
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const result = await logWaste(formData);
      if (result?.error) {
        setError(result.error);
      } else {
        (e.target as HTMLFormElement).reset();
        setSuccess(true);
      }
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4 card">
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => setKind("ingredient")}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${
            kind === "ingredient" ? "bg-accent text-[#121212]" : "bg-bg text-text-secondary"
          }`}
        >
          Ingredient
        </button>
        <button
          type="button"
          onClick={() => setKind("finished_goods")}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${
            kind === "finished_goods" ? "bg-accent text-[#121212]" : "bg-bg text-text-secondary"
          }`}
        >
          Finished bottles
        </button>
      </div>

      {noItems ? (
        <p className="text-sm text-text-secondary">
          {kind === "ingredient"
            ? "Add ingredients on the Stock tab first."
            : "No bottles in stock for any recipe yet — log a batch first."}
        </p>
      ) : (
        <>
          <div>
            <label className="block text-sm font-medium text-text-secondary">
              {kind === "ingredient" ? "Ingredient" : "Recipe"}
            </label>
            <select name="item_id" required className="mt-1 field-input">
              {kind === "ingredient"
                ? ingredients.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.unit})
                    </option>
                  ))
                : finishedGoods.map((f) => (
                    <option key={f.recipe_id} value={f.recipe_id}>
                      {f.recipe_name}
                    </option>
                  ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary">Quantity</label>
            <input
              name="qty"
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              required
              className="mt-1 field-input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary">Reason</label>
            <select name="reason" defaultValue="spoiled" className="mt-1 field-input">
              {REASON_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary">Date</label>
            <input
              name="waste_date"
              type="date"
              defaultValue={todayISO()}
              className="mt-1 field-input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary">Notes (optional)</label>
            <textarea name="notes" rows={2} className="mt-1 field-input" />
          </div>
          {error && <p className="text-sm text-alert">{error}</p>}
          {success && <p className="text-sm text-success">Waste logged.</p>}
          <button type="submit" disabled={isPending} className="w-full btn-primary">
            {isPending ? "Logging…" : "Log waste"}
          </button>
        </>
      )}
    </form>
  );
}
