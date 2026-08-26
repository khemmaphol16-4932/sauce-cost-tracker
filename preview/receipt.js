// Mirrors src/lib/receipt.ts — renders a thermal-receipt-shaped PNG
// client-side and hands it to the Share Sheet (navigator.share), falling
// back to a plain download when File sharing isn't available.

const RECEIPT_WIDTH = 384; // logical px, matches a 58mm thermal printer
const RECEIPT_SCALE = 2;
const RECEIPT_PADDING = 20;
const RECEIPT_LINE_HEIGHT = 26;

function receiptTruncate(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let result = text;
  while (result.length > 1 && ctx.measureText(result + "…").width > maxWidth) {
    result = result.slice(0, -1);
  }
  return result + "…";
}

function buildReceiptCanvas(data) {
  const rowCount = Math.max(data.lines.length, 1);
  const height =
    RECEIPT_PADDING * 2 +
    RECEIPT_LINE_HEIGHT * 2 +
    16 +
    RECEIPT_LINE_HEIGHT * rowCount +
    16 +
    RECEIPT_LINE_HEIGHT +
    (data.customerRef ? RECEIPT_LINE_HEIGHT : 0);

  const canvas = document.createElement("canvas");
  canvas.width = RECEIPT_WIDTH * RECEIPT_SCALE;
  canvas.height = height * RECEIPT_SCALE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not supported on this device");
  ctx.scale(RECEIPT_SCALE, RECEIPT_SCALE);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, RECEIPT_WIDTH, height);
  ctx.fillStyle = "#000000";
  ctx.textBaseline = "top";

  const contentWidth = RECEIPT_WIDTH - RECEIPT_PADDING * 2;
  let y = RECEIPT_PADDING;

  ctx.font = "bold 20px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(receiptTruncate(ctx, data.businessName, contentWidth), RECEIPT_WIDTH / 2, y);
  y += RECEIPT_LINE_HEIGHT;

  ctx.font = "13px sans-serif";
  ctx.fillText(data.dateLabel, RECEIPT_WIDTH / 2, y);
  y += RECEIPT_LINE_HEIGHT;

  const divider = () => {
    ctx.beginPath();
    ctx.moveTo(RECEIPT_PADDING, y + 6);
    ctx.lineTo(RECEIPT_WIDTH - RECEIPT_PADDING, y + 6);
    ctx.stroke();
    y += 16;
  };
  divider();

  ctx.font = "14px sans-serif";
  const lines = data.lines.length > 0 ? data.lines : [{ name: "—", qty: 0, price: 0 }];
  for (const line of lines) {
    const priceLabel = money(line.price);
    const priceWidth = ctx.measureText(priceLabel).width;
    const nameLabel = `${line.qty} × ${line.name}`;
    ctx.textAlign = "left";
    ctx.fillText(receiptTruncate(ctx, nameLabel, contentWidth - priceWidth - 8), RECEIPT_PADDING, y);
    ctx.textAlign = "right";
    ctx.fillText(priceLabel, RECEIPT_WIDTH - RECEIPT_PADDING, y);
    y += RECEIPT_LINE_HEIGHT;
  }

  divider();

  ctx.font = "bold 16px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Total", RECEIPT_PADDING, y);
  ctx.textAlign = "right";
  ctx.fillText(money(data.total), RECEIPT_WIDTH - RECEIPT_PADDING, y);
  y += RECEIPT_LINE_HEIGHT;

  if (data.customerRef) {
    ctx.font = "13px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(receiptTruncate(ctx, data.customerRef, contentWidth), RECEIPT_PADDING, y);
  }

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

async function shareOrDownloadReceipt(data) {
  const canvas = buildReceiptCanvas(data);
  const blob = await canvasToBlob(canvas);
  const filename = `receipt-${data.dateLabel.replace(/[^0-9a-zA-Z-]/g, "")}.png`;
  const file = new File([blob], filename, { type: "image/png" });

  if (navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
    try {
      await navigator.share({ files: [file], title: data.businessName });
      return;
    } catch (err) {
      if (err && err.name === "AbortError") return;
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
