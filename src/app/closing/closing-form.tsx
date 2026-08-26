"use client";

import { useState, useTransition } from "react";
import { ReasonPills } from "@/components/reason-pills";
import { saveClosing } from "./actions";
import type { ClosingData } from "@/lib/data/closing";

const VARIANCE_REASONS = ["Counting error", "Petty cash / expense paid from drawer"] as const;

export function ClosingForm({ data }: { data: ClosingData }) {
  const [countedCash, setCountedCash] = useState(
    data.existing ? String(data.existing.countedCash) : ""
  );
  const [reason, setReason] = useState(data.existing?.reason ?? "");
  const [notes, setNotes] = useState(data.existing?.notes ?? "");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const countedValid = countedCash !== "" && Number.isFinite(Number(countedCash));
  const variance = countedValid ? Number(countedCash) - data.expectedCash : 0;

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await saveClosing(formData);
      if (result?.error) setError(result.error);
      else setSaved(true);
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <input type="hidden" name="reconciliation_date" value={data.date} />

      <div className="card space-y-1">
        <p className="text-xs text-text-secondary">Expected cash ({data.date})</p>
        <p className="font-mono text-2xl font-semibold text-text">
          ฿{data.expectedCash.toFixed(2)}
        </p>
        <p className="text-xs text-text-secondary">Sum of paid cash sales today</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-text-secondary">Counted cash (฿)</label>
        <input
          name="counted_cash"
          type="number"
          inputMode="decimal"
          step="any"
          min="0"
          required
          autoFocus
          value={countedCash}
          onChange={(e) => setCountedCash(e.target.value)}
          className="mt-1 w-full field-input"
        />
        {countedValid && variance !== 0 && (
          <p className={`mt-1 text-xs ${variance < 0 ? "text-alert" : "text-text-secondary"}`}>
            {variance > 0 ? "Over" : "Short"} by ฿{Math.abs(variance).toFixed(2)}
          </p>
        )}
      </div>

      {countedValid && variance !== 0 && (
        <div>
          <label className="block text-sm font-medium text-text-secondary">Reason</label>
          <div className="mt-1">
            <ReasonPills options={VARIANCE_REASONS} value={reason} onChange={setReason} />
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-text-secondary">Note (optional)</label>
        <input
          name="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="mt-1 w-full field-input"
        />
      </div>

      {error && <p className="text-sm text-alert">{error}</p>}
      {saved && !error && (
        <p className="text-sm text-success">
          Saved — you can re-close this later if the count changes.
        </p>
      )}

      <button type="submit" disabled={isPending} className="w-full btn-primary">
        {isPending ? "Saving…" : data.existing ? "Update closing" : "Save closing"}
      </button>
    </form>
  );
}
