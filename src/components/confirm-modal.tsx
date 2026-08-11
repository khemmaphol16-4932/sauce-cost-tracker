"use client";

import { Modal } from "./modal";

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Delete",
  isPending,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  isPending?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-sm text-text-secondary">{message}</p>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={isPending}
          className="flex-1 rounded-xl border border-border px-4 py-3 text-base font-medium text-text disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isPending}
          className="flex-1 rounded-xl border border-alert/40 bg-alert-bg px-4 py-3 text-base font-medium text-alert disabled:opacity-50"
        >
          {isPending ? "…" : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
