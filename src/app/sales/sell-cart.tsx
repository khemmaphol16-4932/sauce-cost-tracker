"use client";

import { useEffect, useState, useTransition } from "react";
import { Modal } from "@/components/modal";
import { logCartSale } from "./actions";
import { PAYMENT_METHODS, PLATFORM_OPTIONS } from "@/lib/platforms";
import type { QuickSellDefaults } from "@/lib/data/sales";
import type { ReceiptProfile } from "@/lib/data/receipt-profile";
import { renderReceiptFile, shareReceiptFile } from "@/lib/receipt";
import { todayISO } from "@/lib/dates";
import { queuePrintJob } from "@/app/print-station/actions";
import type { PrintJobPayload } from "@/lib/print-jobs";

export type SellTile = QuickSellDefaults & { inStock: number | null };

const LAST_PLATFORM_KEY = "ordexa_last_platform";

// Tap a tile = +1 bottle. A bar pinned above the tab bar shows the running
// total; Checkout opens one sheet for platform, payment, and an optional
// adjusted total. A common sale is two taps instead of tile → qty → submit.
// After a sale the sheet switches to a "Print label" step: the receipt image
// is rendered while the sale saves, so the tap that prints can open the Share
// Sheet (→ PeriPage app) immediately — iOS refuses it after an await.
// In station mode the label was already queued for the shop computer by
// logCartSale; the phone just confirms, with reprint / print-here fallbacks.
type Printable = {
  file: File | null;
  payload: PrintJobPayload;
  queued: boolean;
  customer: string;
  bottles: number;
  total: number;
};

export function SellCart({ tiles, profile }: { tiles: SellTile[]; profile: ReceiptProfile }) {
  const [cart, setCart] = useState<Record<string, number>>({});
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [platform, setPlatform] = useState<string>("self");
  const [feePct, setFeePct] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [totalOverride, setTotalOverride] = useState<string>("");
  const [showExtra, setShowExtra] = useState(profile.printAfterSale);
  const [printable, setPrintable] = useState<Printable | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Remember the channel this phone last sold on — per-device convenience only.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LAST_PLATFORM_KEY);
      if (saved) pickPlatform(saved);
    } catch {
      // storage blocked (private mode) — keep the default
    }
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  if (tiles.length === 0) {
    return (
      <p className="card text-sm text-text-secondary">
        Create a recipe first under Make → Recipes, then come back here to sell.
      </p>
    );
  }

  function pickPlatform(value: string) {
    const preset = PLATFORM_OPTIONS.find((p) => p.value === value);
    if (!preset) return;
    setPlatform(preset.value);
    setFeePct(preset.feePct);
    // Marketplace orders are paid out by the platform, not into the drawer.
    setPaymentMethod(preset.value === "self" ? "cash" : "");
  }

  const byId = new Map(tiles.map((t) => [t.recipeId, t]));
  const lines = Object.entries(cart)
    .filter(([, qty]) => qty > 0)
    .map(([id, qty]) => {
      const tile = byId.get(id)!;
      return { tile, qty, lineTotal: qty * tile.unitPrice };
    });
  const bottleCount = lines.reduce((s, l) => s + l.qty, 0);
  const listTotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  const chargedTotal = totalOverride.trim() === "" ? listTotal : Number(totalOverride);

  const setQty = (id: string, qty: number) => {
    const max = byId.get(id)?.inStock;
    const capped = Math.max(0, max != null ? Math.min(qty, max) : qty);
    setCart((c) => ({ ...c, [id]: capped }));
  };

  const addOne = (tile: SellTile) => {
    const current = cart[tile.recipeId] ?? 0;
    if (tile.inStock != null && current >= tile.inStock) {
      setToast(`Only ${tile.inStock} ${tile.recipeName} in stock`);
      return;
    }
    setQty(tile.recipeId, current + 1);
  };

  const clearCart = () => {
    setCart({});
    setTotalOverride("");
    setShowExtra(profile.printAfterSale);
    setError(null);
  };

  const closeCheckout = () => {
    setCheckoutOpen(false);
    setPrintable(null);
  };

  const printLabel = () => {
    if (!printable?.file) return;
    shareReceiptFile(printable.file, profile.businessName).catch(() =>
      setError("Couldn't open the print sheet — use Print in Sales history instead")
    );
  };

  const printAgainAtStation = () => {
    if (!printable) return;
    setError(null);
    startTransition(async () => {
      const result = await queuePrintJob(printable.payload);
      if (result?.error) setError(result.error);
      else setToast("Sent to the shop printer again");
    });
  };

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (lines.length === 0) return;
    if (!(chargedTotal >= 0)) {
      setError("Enter a valid total");
      return;
    }

    // Spread an adjusted total across lines by their share of the list price,
    // so per-recipe revenue stays sensible; rounding remainder goes on the last line.
    const ratio = listTotal > 0 ? chargedTotal / listTotal : 0;
    let allocated = 0;
    const payload = lines.map((l, i) => {
      const price =
        i === lines.length - 1
          ? Math.round((chargedTotal - allocated) * 100) / 100
          : Math.round(l.lineTotal * ratio * 100) / 100;
      allocated += price;
      return { recipe_id: l.tile.recipeId, qty_bottles: l.qty, price_charged_total: price };
    });

    const formData = new FormData(e.currentTarget);
    formData.set("lines", JSON.stringify(payload));
    formData.set("platform", platform);
    formData.set("platform_fee_pct", String(feePct));
    formData.set("payment_method", paymentMethod);

    const customer = String(formData.get("customer_ref") ?? "").trim();
    const labelPayload: PrintJobPayload = {
      dateLabel: todayISO(),
      lines: payload.map((p, i) => ({
        name: lines[i].tile.recipeName,
        qty: p.qty_bottles,
        price: p.price_charged_total,
      })),
      total: chargedTotal,
      customerRef: customer || null,
    };
    const receiptPromise = profile.printAfterSale
      ? renderReceiptFile({ ...profile, ...labelPayload }).catch(() => null)
      : Promise.resolve(null);

    setError(null);
    startTransition(async () => {
      const result = await logCartSale(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      try {
        localStorage.setItem(LAST_PLATFORM_KEY, platform);
      } catch {
        // ignore
      }
      const file = await receiptPromise;
      const queued = !!result?.queued;
      if (file || queued) {
        setPrintable({
          file,
          payload: labelPayload,
          queued,
          customer,
          bottles: bottleCount,
          total: chargedTotal,
        });
      } else {
        setToast(`Sold ${bottleCount} bottle${bottleCount === 1 ? "" : "s"} · ฿${chargedTotal.toFixed(0)}`);
        setCheckoutOpen(false);
      }
      clearCart();
    });
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {tiles.map((t) => {
          const qty = cart[t.recipeId] ?? 0;
          const out = t.inStock != null && t.inStock <= 0;
          return (
            <button
              key={t.recipeId}
              type="button"
              onClick={() => addOne(t)}
              disabled={out}
              className={`relative flex min-h-28 flex-col justify-between rounded-2xl border p-4 text-left transition-colors active:scale-[0.98] disabled:opacity-40 ${
                qty > 0 ? "border-accent bg-accent/10" : "border-border bg-surface active:bg-surface-hover"
              }`}
            >
              {qty > 0 && (
                <span className="absolute right-2 top-2 flex h-7 min-w-7 items-center justify-center rounded-full bg-accent px-2 font-mono text-sm font-bold text-[#121212]">
                  {qty}
                </span>
              )}
              <p className="line-clamp-2 pr-8 text-base font-semibold leading-snug text-text">
                {t.recipeName}
              </p>
              <div className="mt-2 flex items-end justify-between gap-2">
                <span className="font-mono text-lg font-bold text-text">
                  ฿{t.unitPrice.toFixed(0)}
                </span>
                {t.inStock != null && (
                  <span className={`text-xs ${out ? "text-alert" : "text-text-secondary"}`}>
                    {out ? "Out" : `${t.inStock} left`}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Spacer so the pinned bar never covers the last tiles / history. */}
      {bottleCount > 0 && <div className="h-20" aria-hidden />}

      {bottleCount > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-20 border-t border-border bg-bg/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-2xl items-center gap-2">
            <button
              type="button"
              onClick={clearCart}
              className="min-h-12 shrink-0 rounded-xl border border-border px-4 text-sm font-medium text-text-secondary"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setCheckoutOpen(true);
              }}
              className="flex min-h-12 flex-1 items-center justify-between rounded-xl bg-accent px-4 text-base font-semibold text-[#121212]"
            >
              <span>
                {bottleCount} bottle{bottleCount === 1 ? "" : "s"}
              </span>
              <span className="font-mono">฿{listTotal.toFixed(0)} →</span>
            </button>
          </div>
        </div>
      )}

      <Modal
        open={checkoutOpen}
        onClose={closeCheckout}
        title={printable ? "Sold ✓" : "Checkout"}
      >
        {printable ? (
          <div className="space-y-4">
            <p className="text-center text-base text-text">
              {printable.bottles} bottle{printable.bottles === 1 ? "" : "s"} ·{" "}
              <span className="font-mono">฿{printable.total.toFixed(0)}</span>
              {printable.customer && (
                <>
                  {" "}
                  for <span className="font-semibold">{printable.customer}</span>
                </>
              )}
            </p>
            {printable.queued ? (
              <>
                <p className="rounded-xl border border-success/40 bg-success/10 px-4 py-3 text-center text-sm font-medium text-success">
                  Label sent to the shop printer
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={printAgainAtStation}
                    disabled={isPending}
                    className="min-h-12 rounded-xl border border-border text-sm font-medium text-text"
                  >
                    Print again
                  </button>
                  <button
                    type="button"
                    onClick={printLabel}
                    disabled={!printable.file}
                    className="min-h-12 rounded-xl border border-border text-sm font-medium text-text disabled:opacity-40"
                  >
                    Print from phone
                  </button>
                </div>
              </>
            ) : (
              <>
                {profile.printTarget === "station" && (
                  <p className="text-center text-sm text-alert">
                    Couldn&apos;t reach the shop printer queue — print from this phone instead.
                  </p>
                )}
                <button type="button" onClick={printLabel} className="min-h-14 w-full btn-primary">
                  Print label
                </button>
                <p className="text-center text-xs text-text-secondary">
                  Opens the share sheet — choose PeriPage to print.
                </p>
              </>
            )}
            {error && <p className="text-sm text-alert">{error}</p>}
            <button
              type="button"
              onClick={closeCheckout}
              className="min-h-12 w-full rounded-xl border border-border text-base font-medium text-text"
            >
              Done
            </button>
          </div>
        ) : (
        <form onSubmit={submit} className="space-y-5">
          <ul className="divide-y divide-border rounded-xl border border-border bg-bg px-3">
            {lines.map((l) => (
              <li key={l.tile.recipeId} className="flex items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text">{l.tile.recipeName}</p>
                  <p className="font-mono text-xs text-text-secondary">
                    ฿{l.tile.unitPrice.toFixed(0)} × {l.qty} = ฿{l.lineTotal.toFixed(0)}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`One less ${l.tile.recipeName}`}
                  onClick={() => setQty(l.tile.recipeId, l.qty - 1)}
                  className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface text-xl text-text active:bg-surface-hover"
                >
                  −
                </button>
                <span className="w-6 text-center font-mono text-base font-bold text-text">{l.qty}</span>
                <button
                  type="button"
                  aria-label={`One more ${l.tile.recipeName}`}
                  onClick={() => setQty(l.tile.recipeId, l.qty + 1)}
                  className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface text-xl text-text active:bg-surface-hover"
                >
                  +
                </button>
              </li>
            ))}
          </ul>

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-text-secondary">Sold on</legend>
            <div className="flex flex-wrap gap-2">
              {PLATFORM_OPTIONS.map((p) => (
                <Chip key={p.value} active={platform === p.value} onClick={() => pickPlatform(p.value)}>
                  {p.label}
                </Chip>
              ))}
            </div>
            {feePct > 0 && (
              <p className="mt-1.5 text-xs text-text-secondary">Platform fee {feePct}%</p>
            )}
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-text-secondary">Paid by</legend>
            <div className="flex flex-wrap gap-2">
              {PAYMENT_METHODS.map((m) => (
                <Chip
                  key={m}
                  active={paymentMethod === m}
                  onClick={() => setPaymentMethod(paymentMethod === m ? "" : m)}
                >
                  {m === "cod" ? "COD" : m[0].toUpperCase() + m.slice(1)}
                </Chip>
              ))}
            </div>
          </fieldset>

          <div>
            <label className="block text-sm font-medium text-text-secondary">
              Total charged (฿) — change for a discount
            </label>
            <input
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              value={totalOverride}
              placeholder={listTotal.toFixed(0)}
              onChange={(e) => setTotalOverride(e.target.value)}
              className="mt-1 field-input font-mono"
            />
          </div>

          {showExtra ? (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-text-secondary">
                  Customer name {profile.printAfterSale ? "(printed on the label)" : "/ room (optional)"}
                </label>
                <input name="customer_ref" autoComplete="off" className="mt-1 field-input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary">Notes (optional)</label>
                <textarea name="notes" rows={2} className="mt-1 field-input" />
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowExtra(true)}
              className="min-h-11 text-sm text-accent underline underline-offset-2"
            >
              + Customer or note
            </button>
          )}

          {error && <p className="text-sm text-alert">{error}</p>}
          <button type="submit" disabled={isPending} className="min-h-12 w-full btn-primary">
            {isPending ? "Saving…" : `Charge ฿${(chargedTotal || 0).toFixed(0)}`}
          </button>
        </form>
        )}
      </Modal>

      {toast && (
        <div
          role="status"
          className="fixed inset-x-4 top-[calc(4rem+env(safe-area-inset-top))] z-50 mx-auto max-w-sm rounded-xl border border-success/40 bg-surface px-4 py-3 text-center text-sm font-medium text-success shadow-xl"
        >
          {toast}
        </div>
      )}
    </>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-11 rounded-full border px-4 text-sm font-medium ${
        active ? "border-accent bg-accent/15 text-accent" : "border-border bg-bg text-text-secondary"
      }`}
    >
      {children}
    </button>
  );
}
