"use client";

import { useState, useTransition } from "react";
import { shareOrDownloadReceipt, type ReceiptData } from "@/lib/receipt";
import { queuePrintJob } from "@/app/print-station/actions";

// station = send to the shop computer's print queue instead of this phone's
// Share Sheet (Shop & label → "Print on").
export function PrintReceiptButton({ data, station = false }: { data: ReceiptData; station?: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const onClick = () => {
    setError(null);
    setSent(false);
    startTransition(async () => {
      if (station) {
        const result = await queuePrintJob({
          dateLabel: data.dateLabel,
          lines: data.lines,
          total: data.total,
          customerRef: data.customerRef ?? null,
        });
        if (result?.error) setError(result.error);
        else setSent(true);
        return;
      }
      try {
        await shareOrDownloadReceipt(data);
      } catch {
        setError("Couldn't create the receipt");
      }
    });
  };

  return (
    <div className="flex flex-col items-end">
      <button
        type="button"
        onClick={onClick}
        disabled={isPending}
        className="min-h-11 shrink-0 px-2 text-xs text-text-secondary underline underline-offset-2"
      >
        {isPending ? "…" : sent ? "Sent ✓" : "Print"}
      </button>
      {error && <p className="max-w-[12rem] text-right text-xs text-alert">{error}</p>}
    </div>
  );
}
