"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/modal";
import type { ReceiptProfile } from "@/lib/data/receipt-profile";
import { readQueue, removeSlips, subscribeQueue, type QueuedSlip } from "@/lib/print-queue";
import { renderBatchFiles, shareReceiptFiles, SLIPS_PER_IMAGE } from "@/lib/receipt";

// "N labels waiting" card on the Sell page. Opening it renders the batch
// straight away, so the Save tap can open the Share Sheet directly — iOS
// refuses to open it after an await inside the tap.
export function PrintQueue({ profile }: { profile: ReceiptProfile }) {
  const [items, setItems] = useState<QueuedSlip[]>([]);
  const [open, setOpen] = useState(false);
  // Rendered images are tagged with the queue they were made from, so a
  // label removed after rendering can never be saved with a stale batch.
  const [rendered, setRendered] = useState<{ key: string; files: File[]; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () =>
      setItems(readQueue().filter((s) => s.businessName === profile.businessName));
    refresh();
    return subscribeQueue(refresh);
  }, [profile.businessName]);

  const itemsKey = items.map((i) => i.id).join(",");
  const current = rendered?.key === itemsKey ? rendered : null;
  const files = current?.files ?? null;
  const previewUrl = current?.url ?? null;

  useEffect(() => {
    if (!open || items.length === 0) return;
    let cancelled = false;
    let url: string | null = null;
    renderBatchFiles(
      items.map((s) => ({ ...profile, ...s })),
      new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    )
      .then((out) => {
        if (cancelled) return;
        url = URL.createObjectURL(out[0]);
        setRendered({ key: itemsKey, files: out, url });
      })
      .catch(() => !cancelled && setError("Couldn't create the labels"));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
    // itemsKey stands in for items; profile only changes on navigation
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, itemsKey]);

  if (items.length === 0) return null;

  const saveAll = () => {
    if (!files) return;
    const ids = items.map((i) => i.id);
    shareReceiptFiles(files, profile.businessName)
      .then((result) => {
        if (result === "shared") {
          removeSlips(ids);
          setOpen(false);
        }
      })
      .catch(() => setError("Couldn't open the share sheet"));
  };

  const imageCount = Math.ceil(items.length / SLIPS_PER_IMAGE);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className="flex min-h-14 w-full items-center justify-between rounded-2xl border border-accent/50 bg-accent/10 px-4 text-left"
      >
        <span className="text-sm font-medium text-text">
          🖨 {items.length} label{items.length === 1 ? "" : "s"} waiting to print
        </span>
        <span className="text-sm font-semibold text-accent">Print all →</span>
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title={`Print ${items.length} label${items.length === 1 ? "" : "s"}`}>
        <div className="space-y-4">
          <ul className="divide-y divide-border rounded-xl border border-border bg-bg px-3">
            {items.map((s) => (
              <li key={s.id} className="flex items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text">
                    {s.customerRef || "(no name)"}
                    <span className="ml-2 text-xs font-normal text-text-secondary">
                      {s.kind === "receipt" ? "Receipt" : "Label"}
                    </span>
                  </p>
                  <p className="font-mono text-xs text-text-secondary">
                    ฿{s.total.toFixed(0)} ·{" "}
                    {new Date(s.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`Remove ${s.customerRef || "label"} from the queue`}
                  onClick={() => removeSlips([s.id])}
                  className="flex h-11 w-11 items-center justify-center rounded-xl text-lg text-text-secondary active:bg-surface-hover"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>

          <div className="flex justify-center rounded-xl bg-bg p-3">
            {previewUrl && files ? (
              // eslint-disable-next-line @next/next/no-img-element -- blob: URL preview
              <img src={previewUrl} alt="Labels preview" className="max-h-72 w-auto max-w-[200px] object-contain object-top shadow-lg" />
            ) : (
              <p className="py-8 text-sm text-text-secondary">{error ?? "Preparing labels…"}</p>
            )}
          </div>

          <button type="button" onClick={saveAll} disabled={!files} className="min-h-14 w-full btn-primary">
            {files ? `Save ${imageCount === 1 ? "image" : `${imageCount} images`} to print` : "Preparing…"}
          </button>
          <p className="text-center text-xs text-text-secondary">
            Tap <b>Save Image</b>, then in PeriPage print it from Photos. The list clears once saved.
          </p>
          {error && files && <p className="text-sm text-alert">{error}</p>}
        </div>
      </Modal>
    </>
  );
}
