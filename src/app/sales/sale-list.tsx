"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/modal";
import { ConfirmModal } from "@/components/confirm-modal";
import { PrintReceiptButton } from "@/components/print-receipt-button";
import { deleteSale, updateSale } from "./actions";
import type { SaleRow } from "@/lib/data/sales";
import type { ReceiptProfile } from "@/lib/data/receipt-profile";

const STATUS_STYLES: Record<string, string> = {
  paid: "bg-success/20 text-success",
  pending: "bg-amber-500/20 text-amber-400",
  refunded: "bg-alert-bg text-alert",
};

export function SaleListRow({ sale, profile }: { sale: SaleRow; profile: ReceiptProfile }) {
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const submitEdit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await updateSale(formData);
      if (result?.error) setError(result.error);
      else setEditOpen(false);
    });
  };

  const onVoid = () => {
    const formData = new FormData();
    formData.set("id", sale.id);
    startTransition(async () => {
      await deleteSale(formData);
    });
  };

  const receiptData = {
    ...profile,
    dateLabel: sale.sale_date,
    lines: [{ name: sale.recipe_name, qty: sale.qty_bottles, price: sale.price_charged_total }],
    total: sale.price_charged_total,
    customerRef: sale.customer_ref,
  };

  return (
    <li className="border-b border-border py-3 last:border-0">
      <div className="flex items-start justify-between gap-2">
        <button onClick={() => setEditOpen(true)} className="min-w-0 flex-1 text-left">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium text-text">{sale.recipe_name}</span>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                STATUS_STYLES[sale.payment_status] ?? "bg-surface text-text-secondary"
              }`}
            >
              {sale.payment_status}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-text-secondary">
            <span className="font-mono">{sale.qty_bottles}</span> bottles ·{" "}
            <span className="font-mono">฿{sale.price_charged_total.toFixed(2)}</span> ·{" "}
            {sale.platform} · {sale.sale_date}
            {sale.customer_ref && <> · {sale.customer_ref}</>}
          </p>
          {sale.notes && <p className="mt-1 text-sm text-text-secondary">{sale.notes}</p>}
        </button>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <PrintReceiptButton data={receiptData} />
          <button
            onClick={() => setConfirmOpen(true)}
            disabled={isPending}
            className="px-2 text-xs text-alert"
          >
            Void
          </button>
        </div>
      </div>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title={`Edit sale — ${sale.recipe_name}`}>
        <form onSubmit={submitEdit} className="space-y-4">
          <input type="hidden" name="id" value={sale.id} />
          <p className="text-xs text-text-secondary">
            Quantity and price can&apos;t be edited here — void this sale and log a new one if
            those need to change.
          </p>
          <div>
            <label className="block text-sm font-medium text-text-secondary">Payment status</label>
            <select
              name="payment_status"
              defaultValue={sale.payment_status}
              className="mt-1 w-full field-input"
            >
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
              defaultValue={sale.payment_method ?? ""}
              placeholder="cash, transfer, cod…"
              className="mt-1 w-full field-input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary">Date</label>
            <input
              name="sale_date"
              type="date"
              defaultValue={sale.sale_date}
              required
              className="mt-1 w-full field-input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary">
              Customer / room
            </label>
            <input
              name="customer_ref"
              defaultValue={sale.customer_ref ?? ""}
              className="mt-1 w-full field-input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary">Notes</label>
            <textarea
              name="notes"
              rows={2}
              defaultValue={sale.notes ?? ""}
              className="mt-1 w-full field-input"
            />
          </div>
          {error && <p className="text-sm text-alert">{error}</p>}
          <button type="submit" disabled={isPending} className="w-full btn-primary">
            {isPending ? "Saving…" : "Save"}
          </button>
        </form>
      </Modal>

      <ConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          onVoid();
        }}
        title="Void sale"
        message={`Void this sale of ${sale.qty_bottles} bottles (${sale.recipe_name})? This credits the bottles back to stock. This cannot be undone.`}
        confirmLabel="Void"
        isPending={isPending}
      />
    </li>
  );
}
