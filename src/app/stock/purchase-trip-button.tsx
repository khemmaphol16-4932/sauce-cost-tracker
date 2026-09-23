"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/modal";
import { logPurchaseTrip } from "./actions";
import { todayISO } from "@/lib/dates";

const NEW_BRAND_VALUE = "__new__";
type IngredientOption = { id: string; name: string; unit: string };

type Line = {
  key: string;
  ingredientId: string;
  ingredientName: string;
  unit: string;
  qtyBought: string;
  brandSelect: string;
  newBrand: string;
  priceTotal: string;
};

export function PurchaseTripButton({
  ingredients,
  brandsByIngredient,
}: {
  ingredients: IngredientOption[];
  brandsByIngredient: Record<string, string[]>;
}) {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [purchaseDate, setPurchaseDate] = useState(todayISO());
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [draftIngredientId, setDraftIngredientId] = useState("");
  const [draftQty, setDraftQty] = useState("");
  const [draftBrand, setDraftBrand] = useState("");
  const [draftNewBrand, setDraftNewBrand] = useState("");
  const [draftPrice, setDraftPrice] = useState("");

  const draftIngredient = ingredients.find((i) => i.id === draftIngredientId);
  const draftBrands = draftIngredientId ? brandsByIngredient[draftIngredientId] ?? [] : [];

  const resetDraft = () => {
    setDraftIngredientId("");
    setDraftQty("");
    setDraftBrand("");
    setDraftNewBrand("");
    setDraftPrice("");
  };

  const close = () => {
    setOpen(false);
    setLines([]);
    resetDraft();
    setError(null);
  };

  const addLine = () => {
    if (!draftIngredient) {
      setError("Pick an ingredient");
      return;
    }
    const qty = Number(draftQty);
    const price = Number(draftPrice);
    if (!(qty > 0)) {
      setError("Enter a quantity greater than 0");
      return;
    }
    if (!(price >= 0)) {
      setError("Enter a price");
      return;
    }
    if (draftBrand === NEW_BRAND_VALUE && !draftNewBrand.trim()) {
      setError("Enter a name for the new brand");
      return;
    }
    setError(null);
    setLines((prev) => [
      ...prev,
      {
        key: `${draftIngredient.id}-${Date.now()}`,
        ingredientId: draftIngredient.id,
        ingredientName: draftIngredient.name,
        unit: draftIngredient.unit,
        qtyBought: draftQty,
        brandSelect: draftBrand,
        newBrand: draftNewBrand.trim(),
        priceTotal: draftPrice,
      },
    ]);
    resetDraft();
  };

  const removeLine = (key: string) => setLines((prev) => prev.filter((l) => l.key !== key));

  const totalPrice = lines.reduce((sum, l) => sum + (Number(l.priceTotal) || 0), 0);

  const submitTrip = () => {
    if (lines.length === 0) {
      setError("Add at least one item");
      return;
    }
    setError(null);
    const linesPayload = lines.map((l) => ({
      ingredientId: l.ingredientId,
      qtyBought: Number(l.qtyBought),
      priceTotal: Number(l.priceTotal),
      brandSelect: l.brandSelect,
      newBrand: l.newBrand,
    }));
    const formData = new FormData();
    formData.set("purchase_date", purchaseDate);
    formData.set("lines_json", JSON.stringify(linesPayload));
    startTransition(async () => {
      const result = await logPurchaseTrip(formData);
      if (result?.error) setError(result.error);
      else close();
    });
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-xl border-2 border-dashed border-border py-3 text-sm font-medium text-text-secondary active:bg-surface-hover"
      >
        + Purchase trip
      </button>

      <Modal open={open} onClose={close} title="Log a shopping trip">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary">Date</label>
            <input
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              className="mt-1 w-full field-input"
            />
          </div>

          {lines.length > 0 && (
            <ul className="divide-y divide-border rounded-xl border border-border">
              {lines.map((l) => (
                <li key={l.key} className="flex items-center gap-2 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text">
                      {l.ingredientName}
                      {l.brandSelect === NEW_BRAND_VALUE
                        ? ` (${l.newBrand})`
                        : l.brandSelect
                          ? ` (${l.brandSelect})`
                          : ""}
                    </p>
                    <p className="text-xs text-text-secondary">
                      {l.qtyBought} {l.unit} · ฿{Number(l.priceTotal || 0).toFixed(2)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLine(l.key)}
                    aria-label={`Remove ${l.ingredientName}`}
                    className="shrink-0 rounded-full p-2 text-text-secondary active:bg-surface-hover"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="space-y-3 rounded-xl border border-dashed border-border p-3">
            <div>
              <label className="block text-sm font-medium text-text-secondary">Ingredient</label>
              <select
                value={draftIngredientId}
                onChange={(e) => {
                  setDraftIngredientId(e.target.value);
                  setDraftBrand("");
                  setDraftNewBrand("");
                }}
                className="mt-1 w-full field-input"
              >
                <option value="">Pick an ingredient</option>
                {ingredients.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-sm font-medium text-text-secondary">
                  Qty {draftIngredient ? `(${draftIngredient.unit})` : ""}
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min="0"
                  value={draftQty}
                  onChange={(e) => setDraftQty(e.target.value)}
                  className="mt-1 w-full field-input"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-text-secondary">Price (฿)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min="0"
                  value={draftPrice}
                  onChange={(e) => setDraftPrice(e.target.value)}
                  className="mt-1 w-full field-input"
                />
              </div>
            </div>
            {draftIngredientId && (
              <div>
                <label className="block text-sm font-medium text-text-secondary">
                  Brand (optional)
                </label>
                <select
                  value={draftBrand}
                  onChange={(e) => setDraftBrand(e.target.value)}
                  className="mt-1 w-full field-input"
                >
                  <option value="">No brand</option>
                  {draftBrands.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                  <option value={NEW_BRAND_VALUE}>+ Add new brand…</option>
                </select>
                {draftBrand === NEW_BRAND_VALUE && (
                  <input
                    placeholder="e.g. CP, Aro…"
                    value={draftNewBrand}
                    onChange={(e) => setDraftNewBrand(e.target.value)}
                    className="mt-2 w-full field-input"
                  />
                )}
              </div>
            )}
            <button
              type="button"
              onClick={addLine}
              className="w-full rounded-xl border border-border py-2.5 text-sm font-medium text-text active:bg-surface-hover"
            >
              + Add to trip
            </button>
          </div>

          {error && <p className="text-sm text-alert">{error}</p>}

          <button
            type="button"
            onClick={submitTrip}
            disabled={isPending || lines.length === 0}
            className="w-full btn-primary"
          >
            {isPending
              ? "Saving…"
              : lines.length > 0
                ? `Save trip (${lines.length} item${lines.length === 1 ? "" : "s"}, ฿${totalPrice.toFixed(2)})`
                : "Add items to save"}
          </button>
        </div>
      </Modal>
    </>
  );
}
