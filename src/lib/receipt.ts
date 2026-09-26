// Renders a thermal-slip-shaped PNG client-side and hands it to the phone's
// Share Sheet. On iPhone the PeriPage app doesn't appear there (it isn't a
// share target — confirmed on the owner's phone), so the working route is
// Share → Save Image → PeriPage app → print from Photos. PeriPage printers
// speak a proprietary Bluetooth-Classic protocol browsers can't reach, so an
// image the PeriPage app prints is the only path. Falls back to a plain
// download where file sharing isn't available (desktop browsers).
//
// Two layouts share one frame (the owner's paper template):
//   label   — logo, customer name/zone, total, feedback QR, message
//   receipt — the same, plus each item with its price and the date
// Several slips can be stacked into one tall image so a batch prints in a
// single Save Image + one PeriPage print.

import qrcode from "qrcode-generator";

const RECEIPT_WIDTH = 384; // logical px = PeriPage A6 print width in dots (48mm @ 203dpi)
const SCALE = 2; // render at 2x for a crisper image; PeriPage scales to its width
const PADDING = 20;
const LINE_HEIGHT = 26;
const MAX_LOGO_HEIGHT = 300;
const QR_SIZE = 190;
// Thermal heads print only black or white; grey anti-aliasing turns into
// speckle. Everything darker than this becomes solid black.
const INK_THRESHOLD = 170;
// iOS caps canvas area (~16.7M px), so a batch image holds at most this many slips.
export const SLIPS_PER_IMAGE = 5;
const FALLBACK_FONT = '"Kanit", "Sarabun", "Noto Sans Thai", "Leelawadee UI", Tahoma, sans-serif';

export type SlipKind = "label" | "receipt";

export type ReceiptLine = { name: string; qty: number; price: number };

export type ReceiptData = {
  kind?: SlipKind; // defaults to "label"
  businessName: string;
  dateLabel: string;
  lines: ReceiptLine[];
  total: number;
  customerRef?: string | null;
  logoDataUrl?: string | null;
  address?: string | null;
  phone?: string | null;
  contactLine?: string | null;
  footer?: string | null;
  feedbackUrl?: string | null;
};

// navigator.canShare/share aren't universally in lib.dom's Navigator yet —
// declared narrowly here rather than widening to `any`.
type ShareableNavigator = Navigator & {
  canShare?: (data: { files?: File[] }) => boolean;
  share?: (data: { files?: File[]; title?: string }) => Promise<void>;
};

// Kanit is loaded by next/font in the root layout under a hashed family name,
// exposed as --font-kanit. Canvas silently falls back to a system font if the
// face isn't loaded yet, so load it explicitly before the first draw.
let fontPromise: Promise<string> | null = null;
function loadSlipFont(): Promise<string> {
  if (!fontPromise) {
    fontPromise = (async () => {
      const kanit = getComputedStyle(document.documentElement).getPropertyValue("--font-kanit").trim();
      const family = kanit ? `${kanit}, ${FALLBACK_FONT}` : FALLBACK_FONT;
      try {
        await Promise.all([
          document.fonts.load(`400 16px ${family}`, "คุณ Name 0"),
          document.fonts.load(`600 16px ${family}`, "คุณ Name 0"),
        ]);
      } catch {
        // offline or blocked — the system Thai font still prints legibly
      }
      return family;
    })();
  }
  return fontPromise;
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let result = text;
  while (result.length > 1 && ctx.measureText(result + "…").width > maxWidth) {
    result = result.slice(0, -1);
  }
  return result + "…";
}

// Wraps on spaces where possible, otherwise per character (Thai has no spaces
// between words, so a long Thai line would never break on spaces alone).
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const out: string[] = [];
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

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null); // a broken logo shouldn't block printing
    img.src = src;
  });
}

const money = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

type SlipAssets = { font: string; logo: HTMLImageElement | null };

// Draws one slip starting at `top` (logical px) and returns the y where it ends.
function drawSlip(ctx: CanvasRenderingContext2D, data: ReceiptData, top: number, assets: SlipAssets): number {
  const { font, logo } = assets;
  const kind = data.kind ?? "label";
  const contentWidth = RECEIPT_WIDTH - PADDING * 2;
  const center = RECEIPT_WIDTH / 2;
  const left = PADDING;
  const right = RECEIPT_WIDTH - PADDING;
  let y = top;

  ctx.fillStyle = "#000000";
  ctx.strokeStyle = "#000000";
  ctx.textBaseline = "top";

  const centered = (text: string, f: string, lineHeight = LINE_HEIGHT) => {
    ctx.font = f;
    ctx.textAlign = "center";
    for (const line of wrap(ctx, text, contentWidth)) {
      ctx.fillText(line, center, y);
      y += lineHeight;
    }
  };

  const rule = (style: "solid" | "dashed", gapAfter = 14) => {
    ctx.lineWidth = style === "solid" ? 2 : 1.5;
    ctx.setLineDash(style === "dashed" ? [8, 5] : []);
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
    ctx.stroke();
    ctx.setLineDash([]);
    y += gapAfter;
  };

  // Cut line with a heart in the middle, like the paper template's last row.
  const heartRule = () => {
    ctx.font = `600 18px ${font}`;
    ctx.textAlign = "center";
    const heartWidth = ctx.measureText("♥").width + 16;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([8, 5]);
    ctx.beginPath();
    ctx.moveTo(left, y + 9);
    ctx.lineTo(center - heartWidth / 2, y + 9);
    ctx.moveTo(center + heartWidth / 2, y + 9);
    ctx.lineTo(right, y + 9);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillText("♥", center, y);
    y += 22;
  };

  const heading = (text: string) => {
    ctx.font = `600 20px ${font}`;
    ctx.textAlign = "left";
    ctx.fillText(text, left, y);
    y += 36;
  };

  rule("dashed", 18);

  if (logo) {
    const ratio = Math.min(contentWidth / logo.width, MAX_LOGO_HEIGHT / logo.height);
    const w = logo.width * ratio;
    const h = logo.height * ratio;
    ctx.drawImage(logo, center - w / 2, y, w, h);
    y += h + 12;
  } else {
    // No logo uploaded yet: the shop name stands in for it.
    y += 8;
    centered(data.businessName, `600 32px ${font}`, 42);
    y += 6;
  }
  const contact = [data.phone, data.contactLine].filter(Boolean).join("  ·  ");
  if (data.address) centered(data.address, `400 14px ${font}`, 20);
  if (contact) centered(contact, `400 14px ${font}`, 20);

  y += 6;
  rule("dashed", 18);

  heading("คุณ (Name) / โซน (Zone):");
  if (data.customerRef) {
    centered(data.customerRef, `600 30px ${font}`, 40);
    y += 4;
  } else {
    // Blank for handwriting, as on the paper version.
    y += 26;
    rule("dashed", 30);
  }
  rule("solid", 18);

  if (kind === "receipt") {
    ctx.font = `400 16px ${font}`;
    for (const line of data.lines.length > 0 ? data.lines : [{ name: "—", qty: 0, price: 0 }]) {
      const priceLabel = money(line.price);
      const priceWidth = ctx.measureText(priceLabel).width;
      ctx.textAlign = "left";
      ctx.fillText(truncate(ctx, `${line.qty} × ${line.name}`, contentWidth - priceWidth - 10), left, y);
      ctx.textAlign = "right";
      ctx.fillText(priceLabel, right, y);
      y += LINE_HEIGHT;
    }
    y += 4;
    rule("dashed", 18);
  }

  heading("ยอดรวม (Total):");
  ctx.font = `600 30px ${font}`;
  ctx.textAlign = "right";
  const baht = "บาท";
  const bahtWidth = ctx.measureText(baht).width;
  ctx.fillText(baht, right, y);
  ctx.textAlign = "center";
  ctx.fillText(money(data.total), left + (contentWidth - bahtWidth - 12) / 2, y);
  y += 40;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(left, y);
  ctx.lineTo(right - bahtWidth - 12, y);
  ctx.stroke();
  ctx.setLineDash([]);
  y += 14;
  rule("solid", 22);

  if (kind === "receipt") {
    centered(data.dateLabel, `400 13px ${font}`, 20);
    y += 8;
  }

  if (data.feedbackUrl) {
    const qr = qrcode(0, "M");
    qr.addData(data.feedbackUrl);
    qr.make();
    const count = qr.getModuleCount();
    // Whole-pixel modules (at the 2x render scale) keep edges sharp for scanning.
    const cell = Math.max(1, Math.floor((QR_SIZE * SCALE) / count)) / SCALE;
    const size = cell * count;
    const x0 = center - size / 2;
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (qr.isDark(r, c)) ctx.fillRect(x0 + c * cell, y + r * cell, cell, cell);
      }
    }
    y += size + 18;
  }

  // Message: first line bold as a headline, the rest regular — matches the
  // template's "เสียงของลูกค้าสำคัญที่สุด" block.
  if (data.footer) {
    const [first, ...rest] = data.footer.split(/\r?\n/);
    if (first.trim()) centered(first.trim(), `600 17px ${font}`, 26);
    if (rest.join("\n").trim()) centered(rest.join("\n").trim(), `400 15px ${font}`, 22);
    y += 10;
  }

  y += 6;
  heartRule();
  return y + 8;
}

// Converts anti-aliased grey to pure black/white for the thermal head.
function toBlackAndWhite(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const image = ctx.getImageData(0, 0, width, height);
  const px = image.data;
  for (let i = 0; i < px.length; i += 4) {
    const lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    const v = lum < INK_THRESHOLD ? 0 : 255;
    px[i] = px[i + 1] = px[i + 2] = v;
    px[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
}

async function buildSlipsCanvas(slips: ReceiptData[]): Promise<HTMLCanvasElement> {
  const font = await loadSlipFont();
  // Every slip in a batch comes from the same shop profile, so one logo load.
  const logoUrl = slips[0]?.logoDataUrl;
  const logo = logoUrl ? await loadImage(logoUrl) : null;
  const assets = { font, logo };

  // Draw onto an oversized canvas, then crop to the height actually used —
  // simpler than pre-measuring every wrapped line.
  const draftHeight = 1600 * slips.length;
  const draft = document.createElement("canvas");
  draft.width = RECEIPT_WIDTH * SCALE;
  draft.height = draftHeight * SCALE;
  const ctx = draft.getContext("2d");
  if (!ctx) throw new Error("Canvas is not supported on this device");
  ctx.scale(SCALE, SCALE);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, RECEIPT_WIDTH, draftHeight);

  let y = 8;
  for (const slip of slips) y = drawSlip(ctx, slip, y, assets) + 12;

  const canvas = document.createElement("canvas");
  canvas.width = RECEIPT_WIDTH * SCALE;
  canvas.height = Math.ceil(y * SCALE);
  const out = canvas.getContext("2d");
  if (!out) throw new Error("Canvas is not supported on this device");
  out.drawImage(draft, 0, 0);
  toBlackAndWhite(out, canvas.width, canvas.height);
  return canvas;
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Could not create the receipt image"));
    }, "image/png");
  });
}

const safe = (s: string) => s.replace(/[^0-9a-zA-Z฀-๿-]/g, "");

/** Render ahead of time so a later tap can share it without an await first
 * (iOS only opens the Share Sheet directly inside the tap). */
export async function renderReceiptFile(data: ReceiptData): Promise<File> {
  const blob = await canvasToBlob(await buildSlipsCanvas([data]));
  const name = safe(data.customerRef || data.dateLabel);
  return new File([blob], `${data.kind ?? "label"}-${name || "sale"}.png`, { type: "image/png" });
}

/** Stacks slips into as few tall images as the canvas limit allows. */
export async function renderBatchFiles(slips: ReceiptData[], stamp: string): Promise<File[]> {
  const files: File[] = [];
  for (let i = 0; i < slips.length; i += SLIPS_PER_IMAGE) {
    const chunk = slips.slice(i, i + SLIPS_PER_IMAGE);
    const blob = await canvasToBlob(await buildSlipsCanvas(chunk));
    const part = slips.length > SLIPS_PER_IMAGE ? `-${i / SLIPS_PER_IMAGE + 1}` : "";
    files.push(new File([blob], `labels-${safe(stamp)}${part}.png`, { type: "image/png" }));
  }
  return files;
}

/** Resolves "shared" once the Share Sheet completes (or the file downloaded),
 * "cancelled" if the operator backed out of the Share Sheet. */
export async function shareReceiptFiles(files: File[], title: string): Promise<"shared" | "cancelled"> {
  const nav = navigator as ShareableNavigator;
  if (nav.canShare?.({ files }) && nav.share) {
    try {
      await nav.share({ files, title });
      return "shared";
    } catch (err) {
      // Cancelling the Share Sheet rejects with AbortError — not a failure,
      // and not a reason to download either.
      if (err instanceof Error && err.name === "AbortError") return "cancelled";
    }
  }

  for (const file of files) {
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  return "shared";
}

export async function shareReceiptFile(file: File, title: string): Promise<"shared" | "cancelled"> {
  return shareReceiptFiles([file], title);
}

export async function shareOrDownloadReceipt(data: ReceiptData): Promise<void> {
  const file = await renderReceiptFile(data);
  await shareReceiptFile(file, data.businessName);
}
