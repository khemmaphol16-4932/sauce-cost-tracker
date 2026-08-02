"use client";

import { useState, useTransition } from "react";
import { updateLowStockThreshold } from "../actions";
import type { IngredientWithLastPurchase } from "@/lib/data/ingredients";

export function LowStockRow({ ingredient }: { ingredient: IngredientWithLastPurchase }) {
  const [threshold, setThreshold] = useState(
    ingredient.low_stock_threshold?.toString() ?? ""
  );
  const [isPending, startTransition] = useTransition();

  const save = () => {
    const formData = new FormData();
    formData.set("id", ingredient.id);
    formData.set("low_stock_threshold", threshold);
    startTransition(async () => {
      await updateLowStockThreshold(formData);
    });
  };

  return (
    <li className="flex items-center gap-3 border-b border-border py-3 last:border-0">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-text">{ingredient.name}</p>
        <p className="mt-0.5 text-xs text-alert">
          {ingredient.qty_on_hand} {ingredient.unit} left
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <label className="text-xs text-text-secondary">threshold</label>
        <input
          type="number"
          inputMode="decimal"
          step="any"
          min="0"
          value={threshold}
          onChange={(e) => setThreshold(e.target.value)}
          onBlur={save}
          disabled={isPending}
          className="w-20 rounded-lg border border-border bg-bg px-2 py-2 text-right text-sm text-text"
        />
        <span className="text-xs text-text-secondary">{ingredient.unit}</span>
      </div>
    </li>
  );
}
