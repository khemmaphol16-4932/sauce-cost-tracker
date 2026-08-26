// Renders a thermal-receipt-shaped PNG client-side and hands it to iOS's
// Share Sheet (no Web Bluetooth on iPhone Safari, so "print to PeriPage" here
// means "generate an image, let the operator pick the PeriPage app to print
// it"). Falls back to a plain download when the Share Sheet / File sharing
// isn't available (desktop browsers, older iOS).

const RECEIPT_WIDTH = 384; // logical px, matches a 58mm thermal printer
const SCALE = 2; // render at 2x for a crisper print
const PADDING = 20;
const LINE_HEIGHT = 26;

export type ReceiptLine = { name: string; qty: number; price: number };

export type ReceiptData = {
  businessName: string;
  dateLabel: string;
  lines: ReceiptLine[];
  total: number;
  customerRef?: string | null;
};

// navigator.canShare/share aren't universally in lib.dom's Navigator yet —
// declared narrowly here rather than widening to `any`.
type ShareableNavigator = Navigator & {
  canShare?: (data: { files?: File[] }) => boolean;
  share?: (data: { files?: File[]; title?: string }) => Promise<void>;
};

function truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let result = text;
  while (result.length > 1 && ctx.measureText(result + "…").width > maxWidth) {
    result = result.slice(0, -1);
  }
  return result + "…";
}

function buildReceiptCanvas(data: ReceiptData): HTMLCanvasElement {
  const rowCount = Math.max(data.lines.length, 1);
  const height =
    PADDING * 2 +
    LINE_HEIGHT * 2 + // business name + date
    16 + // divider
    LINE_HEIGHT * rowCount +
    16 + // divider
    LINE_HEIGHT + // total
    (data.customerRef ? LINE_HEIGHT : 0);

  const canvas = document.createElement("canvas");
  canvas.width = RECEIPT_WIDTH * SCALE;
  canvas.height = height * SCALE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not supported on this device");
  ctx.scale(SCALE, SCALE);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, RECEIPT_WIDTH, height);
  ctx.fillStyle = "#000000";
  ctx.textBaseline = "top";

  const contentWidth = RECEIPT_WIDTH - PADDING * 2;
  let y = PADDING;

  ctx.font = "bold 20px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(truncate(ctx, data.businessName, contentWidth), RECEIPT_WIDTH / 2, y);
  y += LINE_HEIGHT;

  ctx.font = "13px sans-serif";
  ctx.fillText(data.dateLabel, RECEIPT_WIDTH / 2, y);
  y += LINE_HEIGHT;

  const divider = () => {
    ctx.beginPath();
    ctx.moveTo(PADDING, y + 6);
    ctx.lineTo(RECEIPT_WIDTH - PADDING, y + 6);
    ctx.stroke();
    y += 16;
  };
  divider();

  ctx.font = "14px sans-serif";
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

  ctx.font = "bold 16px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Total", PADDING, y);
  ctx.textAlign = "right";
  ctx.fillText(`฿${data.total.toFixed(2)}`, RECEIPT_WIDTH - PADDING, y);
  y += LINE_HEIGHT;

  if (data.customerRef) {
    ctx.font = "13px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(truncate(ctx, data.customerRef, contentWidth), PADDING, y);
  }

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

export async function shareOrDownloadReceipt(data: ReceiptData): Promise<void> {
  const canvas = buildReceiptCanvas(data);
  const blob = await canvasToBlob(canvas);
  const filename = `receipt-${data.dateLabel.replace(/[^0-9a-zA-Z-]/g, "")}.png`;
  const file = new File([blob], filename, { type: "image/png" });

  const nav = navigator as ShareableNavigator;
  if (nav.canShare?.({ files: [file] }) && nav.share) {
    try {
      await nav.share({ files: [file], title: data.businessName });
      return;
    } catch (err) {
      // The operator cancelling the Share Sheet rejects with AbortError —
      // that's not a failure, just fall through without downloading either.
      if (err instanceof Error && err.name === "AbortError") return;
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
