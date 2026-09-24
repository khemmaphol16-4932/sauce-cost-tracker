"use client";

import { useEffect, useState, useTransition } from "react";
import { updateShopProfile } from "./actions";
import { renderReceiptFile, shareReceiptFile, type ReceiptData } from "@/lib/receipt";
import type { ReceiptProfile } from "@/lib/data/receipt-profile";
import { todayISO } from "@/lib/dates";
import { ditherToBlackAndWhite } from "@/lib/peripage";

const LOGO_MAX_WIDTH = 384; // 58mm thermal print width in dots

// Shrinks an uploaded logo to print width and re-encodes it as PNG, so a
// phone photo (several MB) becomes a few KB before it's saved.
function resizeLogo(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Couldn't read that file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("That file isn't an image we can read"));
      img.onload = () => {
        const ratio = Math.min(LOGO_MAX_WIDTH / img.width, 1);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas is not supported on this device"));
        // Thermal paper is white; flatten transparency onto white so it doesn't print black.
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        // Thermal heads print only black or white: convert once here so the
        // preview shows the real result and printing needs no dithering.
        ditherToBlackAndWhite(canvas);
        resolve(canvas.toDataURL("image/png"));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function ShopProfileForm({ profile }: { profile: ReceiptProfile }) {
  const [draft, setDraft] = useState({
    name: profile.businessName,
    address: profile.address ?? "",
    phone: profile.phone ?? "",
    contactLine: profile.contactLine ?? "",
    footer: profile.footer ?? "",
  });
  const [logo, setLogo] = useState<string>(profile.logoDataUrl ?? "");
  const [printAfterSale, setPrintAfterSale] = useState(profile.printAfterSale);
  const [printTarget, setPrintTarget] = useState(profile.printTarget);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const sample: ReceiptData = {
    businessName: draft.name || "Your shop",
    logoDataUrl: logo || null,
    address: draft.address || null,
    phone: draft.phone || null,
    contactLine: draft.contactLine || null,
    footer: draft.footer || null,
    dateLabel: todayISO(),
    customerRef: "คุณนก",
    lines: [{ name: "Example sauce", qty: 2, price: 178 }],
    total: 178,
  };
  const sampleKey = JSON.stringify(sample);

  // Live preview of the printed label, re-rendered as the fields change.
  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    const t = setTimeout(() => {
      renderReceiptFile(JSON.parse(sampleKey) as ReceiptData)
        .then((file) => {
          if (cancelled) return;
          url = URL.createObjectURL(file);
          setPreviewUrl(url);
        })
        .catch(() => undefined);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
      if (url) URL.revokeObjectURL(url);
    };
  }, [sampleKey]);

  const onLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      setLogo(await resizeLogo(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't use that image");
    }
  };

  const set = (key: keyof typeof draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setSaved(false);
    setDraft((d) => ({ ...d, [key]: e.target.value }));
  };

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("logo_data_url", logo);
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateShopProfile(formData);
      if (result?.error) setError(result.error);
      else setSaved(true);
    });
  };

  const testPrint = () => {
    setError(null);
    renderReceiptFile(sample)
      .then((file) => shareReceiptFile(file, sample.businessName))
      .catch(() => setError("Couldn't create the test label"));
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="card space-y-4">
        <div>
          <p className="text-sm font-medium text-text-secondary">Logo</p>
          <div className="mt-2 flex items-center gap-3">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element -- data: URL, nothing to optimise
              <img src={logo} alt="Shop logo" className="h-16 w-16 rounded-lg bg-white object-contain p-1" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-border text-xs text-text-secondary">
                None
              </div>
            )}
            <label className="flex min-h-11 cursor-pointer items-center rounded-xl border border-border px-4 text-sm font-medium text-text">
              {logo ? "Change" : "Upload"}
              <input type="file" accept="image/*" onChange={onLogo} className="sr-only" />
            </label>
            {logo && (
              <button
                type="button"
                onClick={() => setLogo("")}
                className="min-h-11 px-2 text-sm text-text-secondary underline underline-offset-2"
              >
                Remove
              </button>
            )}
          </div>
          <p className="mt-1.5 text-xs text-text-secondary">
            Converted to black-and-white dots, the way the thermal printer prints it.
          </p>
        </div>

        <Field label="Shop name" name="name" value={draft.name} onChange={set("name")} required />
        <Field label="Address (optional)" name="address" value={draft.address} onChange={set("address")} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone" name="phone" value={draft.phone} onChange={set("phone")} inputMode="tel" />
          <Field
            label="LINE / Facebook"
            name="contact_line"
            value={draft.contactLine}
            onChange={set("contactLine")}
            placeholder="@yourshop"
          />
        </div>
        <div>
          <label htmlFor="receipt_footer" className="block text-sm font-medium text-text-secondary">
            Thank-you message
          </label>
          <textarea
            id="receipt_footer"
            name="receipt_footer"
            rows={2}
            value={draft.footer}
            onChange={set("footer")}
            placeholder="ขอบคุณที่อุดหนุนนะคะ ♥"
            className="mt-1 field-input"
          />
        </div>

        <label className="flex min-h-11 items-center justify-between gap-3">
          <span>
            <span className="block text-sm font-medium text-text">Print label after each sale</span>
            <span className="block text-xs text-text-secondary">
              Shows a Print label button right after Charge, and asks for the customer&apos;s name.
            </span>
          </span>
          <input
            type="checkbox"
            name="print_after_sale"
            checked={printAfterSale}
            onChange={(e) => {
              setSaved(false);
              setPrintAfterSale(e.target.checked);
            }}
            className="h-6 w-6 shrink-0 accent-[var(--color-accent)]"
          />
        </label>

        <fieldset>
          <legend className="text-sm font-medium text-text">Print on</legend>
          <div className="mt-2 space-y-2">
            {(
              [
                ["phone", "This phone", "Tap Print label → choose the PeriPage app."],
                [
                  "station",
                  "Shop computer (automatic)",
                  "Labels print by themselves on the computer running More → Print station.",
                ],
              ] as const
            ).map(([value, label, hint]) => (
              <label
                key={value}
                className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border p-3 ${
                  printTarget === value ? "border-accent bg-accent/10" : "border-border"
                }`}
              >
                <input
                  type="radio"
                  name="print_target"
                  value={value}
                  checked={printTarget === value}
                  onChange={() => {
                    setSaved(false);
                    setPrintTarget(value);
                  }}
                  className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-accent)]"
                />
                <span>
                  <span className="block text-sm font-medium text-text">{label}</span>
                  <span className="block text-xs text-text-secondary">{hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text">Label preview</h2>
          <button
            type="button"
            onClick={testPrint}
            className="min-h-11 rounded-xl border border-border px-4 text-sm font-medium text-text"
          >
            Test print
          </button>
        </div>
        <div className="flex justify-center rounded-xl bg-bg p-3">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- blob: URL preview
            <img src={previewUrl} alt="Label preview" className="w-full max-w-[240px] shadow-lg" />
          ) : (
            <p className="py-8 text-sm text-text-secondary">Rendering preview…</p>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-alert">{error}</p>}
      {saved && <p className="text-sm text-success">Saved.</p>}
      <button type="submit" disabled={isPending} className="min-h-12 w-full btn-primary">
        {isPending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  ...input
}: { label: string; name: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-text-secondary">
        {label}
      </label>
      <input id={name} name={name} {...input} className="mt-1 field-input" />
    </div>
  );
}
