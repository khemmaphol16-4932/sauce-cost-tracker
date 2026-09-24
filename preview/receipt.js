// Mirrors src/lib/receipt.ts (its code with the types stripped) — keep in sync.
// Renders a thermal-receipt-shaped PNG client-side and hands it to the
// phone's Share Sheet, where the operator picks the PeriPage app to print it.
// PeriPage has no official API and its printers speak a proprietary
// Bluetooth-Classic protocol that browsers can't reach (Web Bluetooth is
// BLE-only), so "share an image to the PeriPage app" is the path that works on
// both iPhone and Android. (For hands-free printing, the shop computer runs
// /print-station, which prints this same layout straight to the A6 — see
// src/lib/peripage.ts.) Falls back to a plain download when the Share
// Sheet / file sharing isn't available (desktop browsers, older iOS).
//
// The layout doubles as a bag label: logo + shop details on top, the
// customer's name large in the middle so the bag reads as made for them.

const RECEIPT_WIDTH = 384; // logical px, matches a 58mm thermal printer
const SCALE = 2; // render at 2x for a crisper print
const PADDING = 20;
const LINE_HEIGHT = 26;
const MAX_LOGO_HEIGHT = 140;
const FONT = '"Sarabun", "Noto Sans Thai", "Leelawadee UI", Tahoma, sans-serif';

// navigator.canShare/share aren't universally in lib.dom's Navigator yet —
// declared narrowly here rather than widening to `any`.

function truncate(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let result = text;
  while (result.length > 1 && ctx.measureText(result + "…").width > maxWidth) {
    result = result.slice(0, -1);
  }
  return result + "…";
}

// Wraps on spaces where possible, otherwise per character (Thai has no spaces
// between words, so a long Thai line would never break on spaces alone).
function wrap(ctx, text, maxWidth) {
  const out = [];
  for (const paragraph of text.split(/\r?\n/)) {
    let line = "";
    for (const ch of Array.from(paragraph)) {
      const next = line + ch;
      if (ctx.measureText(next).width > maxWidth && line) {
        const lastSpace = line.lastIndexOf(" ");
        if (lastSpace > 0) {
          out.push(line.slice(0, lastSpace));
          line = line.slice(lastSpace + 1) + ch;
        } else {
          out.push(line);
          line = ch;
        }
      } else {
        line = next;
      }
    }
    out.push(line);
  }
  return out;
}

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null); // a broken logo shouldn't block printing
    img.src = src;
  });
}

/** scale 2 = crisp PNG for the Share Sheet; scale 1 = exactly 384 dots for
 * direct printing (see src/lib/peripage.ts). */
async function buildReceiptCanvas(
  data,
  scale = SCALE
){
  const logo = data.logoDataUrl ? await loadImage(data.logoDataUrl) : null;

  // Draw onto an oversized canvas, then crop to the height actually used —
  // simpler than pre-measuring every wrapped line.
  const draft = document.createElement("canvas");
  draft.width = RECEIPT_WIDTH * scale;
  draft.height = 3000 * scale;
  const ctx = draft.getContext("2d");
  if (!ctx) throw new Error("Canvas is not supported on this device");
  ctx.scale(scale, scale);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, RECEIPT_WIDTH, 3000);
  ctx.fillStyle = "#000000";
  ctx.strokeStyle = "#000000";
  ctx.textBaseline = "top";

  // At 1:1 (direct printing) thin strokes fall apart once cut to black/white
  // dots, so every weight goes bold there; the 2x Share Sheet image keeps them.
  const w = scale === 1 ? "bold " : "";

  const contentWidth = RECEIPT_WIDTH - PADDING * 2;
  const center = RECEIPT_WIDTH / 2;
  let y = PADDING;

  const centered = (text, font, lineHeight = LINE_HEIGHT) => {
    ctx.font = font;
    ctx.textAlign = "center";
    for (const line of wrap(ctx, text, contentWidth)) {
      ctx.fillText(line, center, y);
      y += lineHeight;
    }
  };

  const divider = (dashed = false) => {
    ctx.setLineDash(dashed ? [6, 4] : []);
    ctx.beginPath();
    ctx.moveTo(PADDING, y + 6);
    ctx.lineTo(RECEIPT_WIDTH - PADDING, y + 6);
    ctx.stroke();
    ctx.setLineDash([]);
    y += 16;
  };

  if (logo) {
    const ratio = Math.min(contentWidth / logo.width, MAX_LOGO_HEIGHT / logo.height, 1);
    const w = logo.width * ratio;
    const h = logo.height * ratio;
    ctx.drawImage(logo, center - w / 2, y, w, h);
    y += h + 10;
  }

  centered(data.businessName, `bold 22px ${FONT}`, 30);
  const contact = [data.phone, data.contactLine].filter(Boolean).join("  ·  ");
  if (data.address) centered(data.address, `${w}13px ${FONT}`, 20);
  if (contact) centered(contact, `${w}13px ${FONT}`, 20);

  if (data.customerRef) {
    y += 4;
    divider(true);
    centered("สำหรับ", `${w}14px ${FONT}`, 22);
    centered(data.customerRef, `bold 30px ${FONT}`, 38);
    y += 2;
  }

  divider();

  ctx.font = `${w}15px ${FONT}`;
  for (const line of data.lines.length > 0 ? data.lines : [{ name: "—", qty: 0, price: 0 }]) {
    const priceLabel = `฿${line.price.toFixed(2)}`;
    const priceWidth = ctx.measureText(priceLabel).width;
    const nameLabel = `${line.qty} × ${line.name}`;
    ctx.textAlign = "left";
    ctx.fillText(truncate(ctx, nameLabel, contentWidth - priceWidth - 8), PADDING, y);
    ctx.textAlign = "right";
    ctx.fillText(priceLabel, RECEIPT_WIDTH - PADDING, y);
    y += LINE_HEIGHT;
  }

  divider();

  ctx.font = `bold 17px ${FONT}`;
  ctx.textAlign = "left";
  ctx.fillText("รวม / Total", PADDING, y);
  ctx.textAlign = "right";
  ctx.fillText(`฿${data.total.toFixed(2)}`, RECEIPT_WIDTH - PADDING, y);
  y += LINE_HEIGHT + 4;

  centered(data.dateLabel, `${w}12px ${FONT}`, 20);
  if (data.footer) {
    y += 4;
    centered(data.footer, `bold 15px ${FONT}`, 22);
  }
  y += PADDING;

  const canvas = document.createElement("canvas");
  canvas.width = RECEIPT_WIDTH * scale;
  canvas.height = Math.ceil(y * scale);
  const out = canvas.getContext("2d");
  if (!out) throw new Error("Canvas is not supported on this device");
  out.drawImage(draft, 0, 0);
  return canvas;
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Could not create the receipt image"));
    }, "image/png");
  });
}

/** Render ahead of time so a later tap can share it without an await first
 * (iOS only opens the Share Sheet directly inside the tap). */
async function renderReceiptFile(data) {
  const canvas = await buildReceiptCanvas(data);
  const blob = await canvasToBlob(canvas);
  const safeName = (data.customerRef || data.dateLabel).replace(/[^0-9a-zA-Z฀-๿-]/g, "");
  return new File([blob], `receipt-${safeName || "sale"}.png`, { type: "image/png" });
}

async function shareReceiptFile(file, title) {
  const nav = navigator;
  if (nav.canShare?.({ files: [file] }) && nav.share) {
    try {
      await nav.share({ files: [file], title });
      return;
    } catch (err) {
      // The operator cancelling the Share Sheet rejects with AbortError —
      // that's not a failure, just fall through without downloading either.
      if (err instanceof Error && err.name === "AbortError") return;
    }
  }

  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function shareOrDownloadReceipt(data) {
  const file = await renderReceiptFile(data);
  await shareReceiptFile(file, data.businessName);
}
