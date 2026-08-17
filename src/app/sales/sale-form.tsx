"use client";

import { useState, useTransition } from "react";
import { logSale } from "./actions";

const todayISO = () => new Date().toISOString().slice(0, 10);

const PLATFORM_OPTIONS = [
  { value: "self", label: "Self-sell", feePct: 0 },
  { value: "tiktok", label: "TikTok Shop", feePct: 5 },
  { value: "shopee", label: "Shopee", feePct: 5.42 },
  { value: "lazada", label: "Lazada", feePct: 6.3 },
  { value: "other", label: "Other", feePct: 0 },
] as const;

export function SaleForm({ recipes }: { recipes: { id: string; name: string }[] }) {
  const [platform, setPlatform] = useState<string>(PLATFORM_OPTIONS[0].value);
  const [feePct, setFeePct] = useState<number>(PLATFORM_OPTIONS[0].feePct);
  const [showDetails, setShowDetails] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (recipes.length === 0) {
    return (
      <p className="card text-sm text-text-secondary">
        Create a recipe first on the Recipes tab, then come back here to log a sale.
      </p>
    );
  }

  const onPlatformChange = (value: string) => {
    setPlatform(value);
    const preset = PLATFORM_OPTIONS.find((p) => p.value === value);
    if (preset) setFeePct(preset.feePct);
  };

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const form = e.currentTarget;
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const result = await logSale(formData);
      if (result?.error) {
        setError(result.error);
      } else {
        setSuccess(true);
        form.reset();
        setPlatform(PLATFORM_OPTIONS[0].value);
        setFeePct(PLATFORM_OPTIONS[0].feePct);
        setShowDetails(false);
      }
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4 card">
      <div>
        <label className="block text-sm font-medium text-text-secondary">Recipe</label>
        <select name="recipe_id" required className="mt-1 w-full field-input">
          {recipes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-text-secondary">Bottles sold</label>
          <input
            name="qty_bottles"
            type="number"
            inputMode="decimal"
            step="any"
            min="0"
            required
            className="mt-1 w-full field-input"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary">Total price (฿)</label>
          <input
            name="price_charged_total"
            type="number"
            inputMode="decimal"
            step="any"
            min="0"
            required
            className="mt-1 w-full field-input"
          />
        </div>
      </div>
      <button
        type="button"
        onClick={() => setShowDetails((v) => !v)}
        className="text-xs text-accent underline underline-offset-2"
      >
        {showDetails
          ? "Hide details"
          : "Add details (platform, payment, date, customer, notes)"}
      </button>

      {!showDetails && (
        <>
          <input type="hidden" name="platform" value={platform} />
          <input type="hidden" name="platform_fee_pct" value={feePct} />
          <input type="hidden" name="payment_status" value="paid" />
          <input type="hidden" name="sale_date" value={todayISO()} />
        </>
      )}

      {showDetails && (
        <div className="space-y-3 rounded-lg border border-border bg-bg p-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-text-secondary">Platform</label>
              <select
                name="platform"
                value={platform}
                onChange={(e) => onPlatformChange(e.target.value)}
                className="mt-1 w-full field-input"
              >
                {PLATFORM_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary">
                Platform fee %
              </label>
              <input
                name="platform_fee_pct"
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                max="100"
                value={feePct}
                onChange={(e) => setFeePct(Number(e.target.value))}
                className="mt-1 w-full field-input"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-text-secondary">
                Payment status
              </label>
              <select name="payment_status" defaultValue="paid" className="mt-1 w-full field-input">
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="refunded">Refunded</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary">
                Payment method (optional)
              </label>
              <input
                name="payment_method"
                placeholder="cash, transfer, cod…"
                className="mt-1 w-full field-input"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary">Date</label>
            <input
              name="sale_date"
              type="date"
              defaultValue={todayISO()}
              className="mt-1 w-full field-input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary">
              Customer / room (optional)
            </label>
            <input
              name="customer_ref"
              placeholder="e.g. room number, name — powers repeat-customer stats"
              className="mt-1 w-full field-input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary">
              Notes (optional)
            </label>
            <textarea name="notes" rows={2} className="mt-1 w-full field-input" />
          </div>
        </div>
      )}

      {error && <p className="text-sm text-alert">{error}</p>}
      {success && <p className="text-sm text-success">Sale logged and stock deducted.</p>}
      <button type="submit" disabled={isPending} className="w-full btn-primary">
        {isPending ? "Logging…" : "Log sale"}
      </button>
    </form>
  );
}
