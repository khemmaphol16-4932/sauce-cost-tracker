// Labels waiting to be printed, kept on this phone only. At a market stall
// the PeriPage route is Save Image → PeriPage app → print from Photos, so
// printing each sale's label on its own costs several taps every time.
// Instead every checkout drops its slip here, and "Print all" stacks them
// into one tall image: one Save Image and one PeriPage print for the batch.
//
// Only the per-sale content is stored. The shop profile (logo, message, QR
// link) is merged in when printing, so a queue survives a logo change.
// localStorage is per-device by design — the phone that sold is the one
// holding the printer — and every access is guarded, since it can be
// blocked (private mode) or cleared; losing the queue only loses reminders,
// never sales.

import type { ReceiptLine, SlipKind } from "@/lib/receipt";

const KEY = "ordexa_print_queue_v1";
const CHANGE_EVENT = "ordexa-print-queue";
const MAX_ITEMS = 60;

export type QueuedSlip = {
  id: string;
  createdAt: string; // ISO
  kind: SlipKind;
  businessName: string; // the shop it was sold under, to avoid mixing shops in one batch
  dateLabel: string;
  customerRef: string | null;
  lines: ReceiptLine[];
  total: number;
};

export function readQueue(): QueuedSlip[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as QueuedSlip[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(items: QueuedSlip[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items.slice(-MAX_ITEMS)));
  } catch {
    // storage blocked or full — the sale itself is already saved
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function enqueueSlip(slip: Omit<QueuedSlip, "id" | "createdAt">): QueuedSlip {
  const item: QueuedSlip = {
    ...slip,
    id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now()),
    createdAt: new Date().toISOString(),
  };
  writeQueue([...readQueue(), item]);
  return item;
}

export function removeSlips(ids: string[]) {
  const drop = new Set(ids);
  writeQueue(readQueue().filter((s) => !drop.has(s.id)));
}

/** Calls back whenever the queue changes in this tab or another one. */
export function subscribeQueue(onChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) onChange();
  };
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}
