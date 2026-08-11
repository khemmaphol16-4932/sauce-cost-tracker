"use client";

import { useState, useTransition } from "react";
import { ConfirmModal } from "@/components/confirm-modal";
import { deleteSale } from "./actions";
import type { SaleRow } from "@/lib/data/sales";

const STATUS_STYLES: Record<string, string> = {
  paid: "bg-success/20 text-success",
  pending: "bg-amber-500/20 text-amber-400",
  refunded: "bg-alert-bg text-alert",
};

export function SaleListRow({ sale }: { sale: SaleRow }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const onVoid = () => {
    const formData = new FormData();
    formData.set("id", sale.id);
    startTransition(async () => {
      await deleteSale(formData);
    });
  };

  return (
    <li className="border-b border-border py-3 last:border-0">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium text-text">{sale.recipe_name}</span>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
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
          </p>
          {sale.notes && <p className="mt-1 text-sm text-text-secondary">{sale.notes}</p>}
        </div>
        <button
          onClick={() => setConfirmOpen(true)}
          disabled={isPending}
          className="shrink-0 px-2 text-xs text-alert"
        >
          Void
        </button>
      </div>

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
