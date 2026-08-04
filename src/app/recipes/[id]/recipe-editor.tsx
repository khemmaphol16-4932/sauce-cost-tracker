"use client";

import { useMemo, useState, useTransition } from "react";
import {
  addPackagingCost,
  addRecipeIngredient,
  addSopStep,
  deleteRecipe,
  removePackagingCost,
  removeRecipeIngredient,
  removeSopStep,
  updateRecipe,
  updateRecipeIngredient,
  updateSopStep,
} from "../actions";
import { calcRecipeCost, PLATFORM_FEE_PRESETS } from "@/lib/costing";
import type { RecipeDetail, RecipeIngredientRow, PackagingCostRow, SopStepRow } from "@/lib/data/recipes";
import type { IngredientOption } from "@/lib/data/ingredients";

const INDICATOR_STYLES = {
  red: "bg-alert-bg text-alert",
  yellow: "bg-amber-500/20 text-amber-400",
  green: "bg-success/20 text-success",
} as const;

export function RecipeEditor({
  recipe,
  ingredients,
  packaging,
  sopSteps,
  ingredientOptions,
}: {
  recipe: RecipeDetail;
  ingredients: RecipeIngredientRow[];
  packaging: PackagingCostRow[];
  sopSteps: SopStepRow[];
  ingredientOptions: IngredientOption[];
}) {
  const [draft, setDraft] = useState(recipe);
  const [isPending, startTransition] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);

  const isCustomFee = !PLATFORM_FEE_PRESETS.some((p) => p.value === draft.platform_fee_pct);

  const summary = useMemo(
    () =>
      calcRecipeCost(
        draft,
        ingredients.map((i) => ({ qty_used: i.qty_used, avg_price_per_unit: i.avg_price_per_unit })),
        packaging.map((p) => ({ cost_per_unit: p.cost_per_unit }))
      ),
    [draft, ingredients, packaging]
  );

  const set = <K extends keyof RecipeDetail>(key: K, value: RecipeDetail[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const saveRecipe = () => {
    const formData = new FormData();
    formData.set("id", draft.id);
    formData.set("name", draft.name);
    formData.set("bottle_size_ml", String(draft.bottle_size_ml));
    formData.set("batch_volume_ml", String(draft.batch_volume_ml));
    formData.set("evaporation_loss_pct", String(draft.evaporation_loss_pct));
    formData.set("waste_pct", String(draft.waste_pct));
    formData.set("labor_hours_per_batch", String(draft.labor_hours_per_batch));
    formData.set("labor_rate_per_hour", String(draft.labor_rate_per_hour));
    formData.set("overhead_per_batch", String(draft.overhead_per_batch));
    formData.set("platform_fee_pct", String(draft.platform_fee_pct));
    formData.set("vat_pct", String(draft.vat_pct));
    if (draft.target_sell_price != null) {
      formData.set("target_sell_price", String(draft.target_sell_price));
    }
    setSaveError(null);
    startTransition(async () => {
      const result = await updateRecipe(formData);
      if (result?.error) setSaveError(result.error);
    });
  };

  const onDeleteRecipe = () => {
    if (!confirm(`Delete recipe "${draft.name}"? This cannot be undone.`)) return;
    const formData = new FormData();
    formData.set("id", draft.id);
    startTransition(async () => {
      await deleteRecipe(formData);
    });
  };

  return (
    <div className="space-y-4">
      {/* Live summary */}
      <div className="card">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text">Cost & margin summary</h2>
          <span
            className={`rounded-full px-3 py-1 font-mono text-xs font-semibold ${INDICATOR_STYLES[summary.indicator]}`}
          >
            {summary.bottlesPerBatch <= 0
              ? "no yield"
              : draft.target_sell_price == null
                ? "set price"
                : `${summary.marginPct.toFixed(0)}% margin`}
          </span>
        </div>
        <p className="mt-1 text-xs text-text-secondary">
          ~{summary.bottlesPerBatch} bottles/batch ({summary.bottlesPerBatchRaw.toFixed(1)} raw)
        </p>
        <dl className="mt-3 space-y-1 text-sm">
          <Row label="Raw materials / bottle" value={summary.rawMaterialCostPerBottle} />
          <Row label="Packaging / bottle" value={summary.packagingCostPerBottle} />
          <Row label="Labor / bottle" value={summary.laborCostPerBottle} />
          <Row label="Overhead / bottle" value={summary.overheadCostPerBottle} />
          <Row label="Cost / bottle" value={summary.costPerBottle} bold />
          <Row label="Platform fee / bottle" value={summary.platformFeeAmount} />
          <Row label="VAT / bottle" value={summary.vatAmount} />
          <Row label="Profit / bottle" value={summary.profitPerBottle} bold />
        </dl>
        <p className="mt-3 text-[11px] leading-snug text-text-secondary">
          Tax note: net profit is taxable personal income if you&apos;re unregistered/no VAT.
          This is informational only, not a tax calculation — consult an accountant for real
          filing guidance.
        </p>
      </div>

      {/* Recipe fields */}
      <div className="space-y-4 card">
        <Field label="Recipe name">
          <input
            value={draft.name}
            onChange={(e) => set("name", e.target.value)}
            className="w-full field-input"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Batch volume (ml)">
            <NumberInput value={draft.batch_volume_ml} onChange={(v) => set("batch_volume_ml", v)} />
          </Field>
          <Field label="Bottle size (ml)">
            <NumberInput value={draft.bottle_size_ml} onChange={(v) => set("bottle_size_ml", v)} />
          </Field>
          <Field label="Evaporation loss %">
            <NumberInput
              value={draft.evaporation_loss_pct}
              onChange={(v) => set("evaporation_loss_pct", v)}
            />
          </Field>
          <Field label="Waste %">
            <NumberInput value={draft.waste_pct} onChange={(v) => set("waste_pct", v)} />
          </Field>
          <Field label="Labor hours/batch">
            <NumberInput
              value={draft.labor_hours_per_batch}
              onChange={(v) => set("labor_hours_per_batch", v)}
            />
          </Field>
          <Field label="Labor rate (฿/hr)">
            <NumberInput
              value={draft.labor_rate_per_hour}
              onChange={(v) => set("labor_rate_per_hour", v)}
            />
          </Field>
          <Field label="Overhead / batch (฿)">
            <NumberInput
              value={draft.overhead_per_batch}
              onChange={(v) => set("overhead_per_batch", v)}
            />
          </Field>
          <Field label="Target sell price (฿)">
            <NumberInput
              value={draft.target_sell_price ?? 0}
              onChange={(v) => set("target_sell_price", v)}
            />
          </Field>
        </div>
        <Field label="Platform fee">
          <select
            value={isCustomFee ? "custom" : String(draft.platform_fee_pct)}
            onChange={(e) => {
              if (e.target.value !== "custom") set("platform_fee_pct", Number(e.target.value));
            }}
            className="w-full field-input"
          >
            {PLATFORM_FEE_PRESETS.map((p) => (
              <option key={p.label} value={p.value}>
                {p.label}
              </option>
            ))}
            <option value="custom">Custom…</option>
          </select>
          {isCustomFee && (
            <div className="mt-2">
              <NumberInput
                value={draft.platform_fee_pct}
                onChange={(v) => set("platform_fee_pct", v)}
              />
            </div>
          )}
        </Field>
        <Field label="VAT %">
          <NumberInput value={draft.vat_pct} onChange={(v) => set("vat_pct", v)} />
        </Field>

        {saveError && <p className="text-sm text-alert">{saveError}</p>}
        <div className="flex gap-2">
          <button
            onClick={saveRecipe}
            disabled={isPending}
            className="flex-1 btn-primary"
          >
            {isPending ? "Saving…" : "Save recipe"}
          </button>
          <button
            onClick={onDeleteRecipe}
            disabled={isPending}
            className="rounded-xl border border-alert/40 px-4 py-3 text-base font-medium text-alert"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Ingredients */}
      <div className="card">
        <h2 className="mb-2 text-sm font-semibold text-text">Ingredients</h2>
        <ul className="mb-3 divide-y divide-border">
          {ingredients.map((ri) => (
            <IngredientLine key={ri.id} recipeId={recipe.id} ri={ri} />
          ))}
          {ingredients.length === 0 && (
            <p className="py-2 text-sm text-text-secondary">No ingredients added yet.</p>
          )}
        </ul>
        <AddIngredientForm recipeId={recipe.id} options={ingredientOptions} />
      </div>

      {/* Packaging */}
      <div className="card">
        <h2 className="mb-2 text-sm font-semibold text-text">Packaging costs</h2>
        <ul className="mb-3 divide-y divide-border">
          {packaging.map((p) => (
            <PackagingLine key={p.id} recipeId={recipe.id} item={p} />
          ))}
          {packaging.length === 0 && (
            <p className="py-2 text-sm text-text-secondary">No packaging items added yet.</p>
          )}
        </ul>
        <AddPackagingForm recipeId={recipe.id} />
      </div>

      {/* SOP */}
      <div className="card">
        <h2 className="mb-2 text-sm font-semibold text-text">Production SOP</h2>
        <ol className="mb-3 divide-y divide-border">
          {sopSteps.map((step, i) => (
            <SopStepLine key={step.id} recipeId={recipe.id} step={step} index={i + 1} />
          ))}
          {sopSteps.length === 0 && (
            <p className="py-2 text-sm text-text-secondary">No steps added yet.</p>
          )}
        </ol>
        <AddSopStepForm recipeId={recipe.id} />
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-semibold text-text" : "text-text-secondary"}`}>
      <dt>{label}</dt>
      <dd className="font-mono">฿{value.toFixed(2)}</dd>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-text-secondary">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function NumberInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <input
      type="number"
      inputMode="decimal"
      step="any"
      value={Number.isFinite(value) ? value : 0}
      onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
      className="w-full field-input"
    />
  );
}

function IngredientLine({ recipeId, ri }: { recipeId: string; ri: RecipeIngredientRow }) {
  const [qty, setQty] = useState(ri.qty_used);
  const [isPending, startTransition] = useTransition();

  const saveQty = () => {
    const formData = new FormData();
    formData.set("id", ri.id);
    formData.set("recipe_id", recipeId);
    formData.set("qty_used", String(qty));
    startTransition(async () => {
      await updateRecipeIngredient(formData);
    });
  };

  const onRemove = () => {
    const formData = new FormData();
    formData.set("id", ri.id);
    formData.set("recipe_id", recipeId);
    startTransition(async () => {
      await removeRecipeIngredient(formData);
    });
  };

  return (
    <li className="flex items-center gap-2 py-2">
      <span className="min-w-0 flex-1 truncate text-sm text-text">{ri.ingredient_name}</span>
      <input
        type="number"
        inputMode="decimal"
        step="any"
        min="0"
        value={qty}
        onChange={(e) => setQty(Number(e.target.value))}
        onBlur={saveQty}
        disabled={isPending}
        className="w-20 rounded-lg border border-border bg-bg px-2 py-2 text-right text-sm text-text"
      />
      <span className="w-10 shrink-0 text-xs text-text-secondary">{ri.ingredient_unit}</span>
      <button
        onClick={onRemove}
        disabled={isPending}
        className="shrink-0 px-2 text-xs text-alert"
        aria-label="Remove"
      >
        ✕
      </button>
    </li>
  );
}

function AddIngredientForm({
  recipeId,
  options,
}: {
  recipeId: string;
  options: IngredientOption[];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await addRecipeIngredient(formData);
      if (result?.error) setError(result.error);
      else (e.target as HTMLFormElement).reset();
    });
  };

  if (options.length === 0) {
    return (
      <p className="text-sm text-text-secondary">
        Add ingredients on the Stock tab first, then come back here.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="flex items-end gap-2">
      <input type="hidden" name="recipe_id" value={recipeId} />
      <div className="flex-1">
        <select
          name="ingredient_id"
          required
          className="w-full rounded-lg border border-border bg-bg px-3 py-3 text-sm text-text"
        >
          <option value="">Pick ingredient…</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name} ({o.unit})
            </option>
          ))}
        </select>
      </div>
      <input
        name="qty_used"
        type="number"
        inputMode="decimal"
        step="any"
        min="0"
        required
        placeholder="qty"
        className="w-20 rounded-lg border border-border bg-bg px-3 py-3 text-sm text-text"
      />
      <button
        type="submit"
        disabled={isPending}
        className="shrink-0 rounded-lg bg-accent px-4 py-3 text-sm font-medium text-[#121212] disabled:opacity-50"
      >
        Add
      </button>
      {error && <p className="w-full text-sm text-alert">{error}</p>}
    </form>
  );
}

function PackagingLine({ recipeId, item }: { recipeId: string; item: PackagingCostRow }) {
  const [isPending, startTransition] = useTransition();

  const onRemove = () => {
    const formData = new FormData();
    formData.set("id", item.id);
    formData.set("recipe_id", recipeId);
    startTransition(async () => {
      await removePackagingCost(formData);
    });
  };

  return (
    <li className="flex items-center gap-2 py-2">
      <span className="min-w-0 flex-1 truncate text-sm text-text">{item.item_name}</span>
      <span className="text-sm text-text-secondary">฿{item.cost_per_unit.toFixed(2)}</span>
      <button
        onClick={onRemove}
        disabled={isPending}
        className="shrink-0 px-2 text-xs text-alert"
        aria-label="Remove"
      >
        ✕
      </button>
    </li>
  );
}

function AddPackagingForm({ recipeId }: { recipeId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await addPackagingCost(formData);
      if (result?.error) setError(result.error);
      else (e.target as HTMLFormElement).reset();
    });
  };

  return (
    <form onSubmit={submit} className="flex items-end gap-2">
      <input type="hidden" name="recipe_id" value={recipeId} />
      <input
        name="item_name"
        required
        placeholder="e.g. Bottle, Cap, Label"
        className="flex-1 rounded-lg border border-border bg-bg px-3 py-3 text-sm text-text"
      />
      <input
        name="cost_per_unit"
        type="number"
        inputMode="decimal"
        step="any"
        min="0"
        required
        placeholder="฿/bottle"
        className="w-24 rounded-lg border border-border bg-bg px-3 py-3 text-sm text-text"
      />
      <button
        type="submit"
        disabled={isPending}
        className="shrink-0 rounded-lg bg-accent px-4 py-3 text-sm font-medium text-[#121212] disabled:opacity-50"
      >
        Add
      </button>
      {error && <p className="w-full text-sm text-alert">{error}</p>}
    </form>
  );
}

function SopStepLine({
  recipeId,
  step,
  index,
}: {
  recipeId: string;
  step: SopStepRow;
  index: number;
}) {
  const [text, setText] = useState(step.instruction);
  const [isPending, startTransition] = useTransition();

  const saveText = () => {
    if (text.trim() === step.instruction) return;
    const formData = new FormData();
    formData.set("id", step.id);
    formData.set("recipe_id", recipeId);
    formData.set("instruction", text);
    startTransition(async () => {
      await updateSopStep(formData);
    });
  };

  const onRemove = () => {
    const formData = new FormData();
    formData.set("id", step.id);
    formData.set("recipe_id", recipeId);
    startTransition(async () => {
      await removeSopStep(formData);
    });
  };

  return (
    <li className="flex items-center gap-2 py-2">
      <span className="w-5 shrink-0 text-right text-xs text-text-secondary">{index}.</span>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={saveText}
        disabled={isPending}
        className="min-w-0 flex-1 rounded-lg border border-border bg-bg px-2 py-2 text-sm text-text"
      />
      <button
        onClick={onRemove}
        disabled={isPending}
        className="shrink-0 px-2 text-xs text-alert"
        aria-label="Remove"
      >
        ✕
      </button>
    </li>
  );
}

function AddSopStepForm({ recipeId }: { recipeId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await addSopStep(formData);
      if (result?.error) setError(result.error);
      else (e.target as HTMLFormElement).reset();
    });
  };

  return (
    <form onSubmit={submit} className="flex items-end gap-2">
      <input type="hidden" name="recipe_id" value={recipeId} />
      <input
        name="instruction"
        required
        placeholder="e.g. Sanitize bottles before filling"
        className="min-w-0 flex-1 rounded-lg border border-border bg-bg px-3 py-3 text-sm text-text"
      />
      <button
        type="submit"
        disabled={isPending}
        className="shrink-0 rounded-lg bg-accent px-4 py-3 text-sm font-medium text-[#121212] disabled:opacity-50"
      >
        Add
      </button>
      {error && <p className="w-full text-sm text-alert">{error}</p>}
    </form>
  );
}
