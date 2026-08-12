"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/modal";
import { logSale } from "./actions";
import type { QuickSellDefaults } from "@/lib/data/sales";

const todayISO = () => new Date().toISOString().slice(0, 10);

export function QuickSell({ defaults }: { defaults: QuickSellDefaults[] }) {
  const [selected, setSelected] = useState<QuickSellDefaults | null>(null);
  const [qty, setQty] = useState(1);
  const [showDetails, setShowDetails] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (defaults.length === 0) return null;

  const openTile = (d: QuickSellDefaults) => {
    setSelected(d);
    setQty(1);
    setShowDetails(false);
    setError(null);
  };

  const close = () => setSelected(null);

  const total = selected ? qty * selected.unitPrice : 0;

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selected) return;
    const formData = new FormData(e.currentTarget);
    formData.set("recipe_id", selected.recipeId);
    formData.set("qty_bottles", String(qty));
    if (!formData.get("price_charged_total")) {
      formData.set("price_charged_total", String(total));
    }
    if (!formData.get("platform")) formData.set("platform", selected.platform);
    if (!formData.get("platform_fee_pct")) {
      formData.set("platform_fee_pct", String(selected.platformFeePct));
    }
    formData.set("payment_status", "paid");
    formData.set("sale_date", todayISO());

    setError(null);
    startTransition(async () => {
      const result = await logSale(formData);
      if (result?.error) setError(result.error);
      else close();
    });
  };

  return (
    <>
      <div className="card">
        <h2 className="mb-2 text-sm font-semibold text-text">Quick sell</h2>
        <div className="grid grid-cols-2 gap-2">
          {defaults.map((d) => (
            <button
              key={d.recipeId}
              onClick={() => openTile(d)}
              className="rounded-xl border border-border bg-bg px-3 py-3 text-left active:bg-surface-hover"
            >
              <p className="truncate text-sm font-medium text-text">{d.recipeName}</p>
              <p className="mt-0.5 font-mono text-xs text-text-secondary">
                ฿{d.unitPrice.toFixed(0)}
              </p>
            </button>
          ))}
        </div>
      </div>

      <Modal open={selected != null} onClose={close} title={selected?.recipeName ?? ""}>
        {selected && (
          <form onSubmit={submit} className="space-y-4">
            <div className="flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="flex h-12 w-12 items-center justify-center rounded-xl bg-bg text-xl text-text active:bg-surface-hover"
              >
                −
              </button>
              <span className="w-16 text-center font-mono text-3xl font-bold text-text">
                {qty}
              </span>
              <button
                type="button"
                onClick={() => setQty((q) => q + 1)}
                className="flex h-12 w-12 items-center justify-center rounded-xl bg-bg text-xl text-text active:bg-surface-hover"
              >
                +
              </button>
            </div>
            <p className="text-center font-mono text-lg text-text-secondary">
              ฿{total.toFixed(0)} total
            </p>

            <button
              type="button"
              onClick={() => setShowDetails((v) => !v)}
              className="text-xs text-accent underline underline-offset-2"
            >
              {showDetails ? "Hide details" : "Edit details (price, platform, customer…)"}
            </button>

            {showDetails && (
              <div className="space-y-3 rounded-lg border border-border bg-bg p-3">
                <div>
                  <label className="block text-xs font-medium text-text-secondary">
                    Total price (฿)
                  </label>
                  <input
                    name="price_charged_total"
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min="0"
                    defaultValue={total.toFixed(0)}
                    className="mt-1 field-input"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary">Platform</label>
                  <input name="platform" defaultValue={selected.platform} className="mt-1 field-input" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary">
                    Platform fee %
                  </label>
                  <input
                    name="platform_fee_pct"
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min="0"
                    max="100"
                    defaultValue={selected.platformFeePct}
                    className="mt-1 field-input"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary">
                    Payment method
                  </label>
                  <input
                    name="payment_method"
                    placeholder="cash, transfer, cod…"
                    className="mt-1 field-input"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary">
                    Customer / room
                  </label>
                  <input name="customer_ref" className="mt-1 field-input" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary">Notes</label>
                  <textarea name="notes" rows={2} className="mt-1 field-input" />
                </div>
              </div>
            )}

            {error && <p className="text-sm text-alert">{error}</p>}
            <button type="submit" disabled={isPending} className="w-full btn-primary">
              {isPending ? "Logging…" : "Log sale"}
            </button>
          </form>
        )}
      </Modal>
    </>
  );
}
