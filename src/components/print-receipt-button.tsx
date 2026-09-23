"use client";

import { useState, useTransition } from "react";
import { shareOrDownloadReceipt, type ReceiptData } from "@/lib/receipt";

export function PrintReceiptButton({ data }: { data: ReceiptData }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onClick = () => {
    setError(null);
    startTransition(async () => {
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
        className="shrink-0 px-2 text-xs text-text-secondary underline underline-offset-2"
      >
        {isPending ? "…" : "Print"}
      </button>
      {error && <p className="text-xs text-alert">{error}</p>}
    </div>
  );
}
