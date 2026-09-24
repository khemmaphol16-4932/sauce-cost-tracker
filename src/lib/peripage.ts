// Direct printing to a PeriPage A6 (203dpi, 384 dots wide) from a desktop
// browser. PeriPage publishes no API; the byte protocol below comes from the
// community reverse-engineering projects (github.com/bitrate16/peripage-python,
// github.com/eliasweingaertner/peripage-A6-bluetooth).
//
// Transport is Web Serial (Chrome/Edge on a computer): once the A6 is paired
// over Bluetooth, the OS exposes it as a serial port ("Standard Serial over
// Bluetooth link" COMx on Windows), which navigator.serial can open. Phones
// can't do this — iOS has no Web Serial/Bluetooth — hence the print station.

export const PRINT_WIDTH = 384; // dots per line on the A6
const ROW_BYTES = PRINT_WIDTH / 8; // 48
const MAX_ROWS_PER_BLOCK = 255; // row count is a single byte in the header
const CHUNK_BYTES = 122; // write size used by the known-good implementations
const CHUNK_DELAY_MS = 20; // gives the printer's small buffer time to drain

const hex = (s: string) => new Uint8Array(s.match(/../g)!.map((b) => parseInt(b, 16)));

const RESET = hex("10fffe01" + "00".repeat(12));
const DENSITY_DARK = hex("10ff100002"); // concentration level 2 (darkest)
const FEED_AFTER = hex("1b4a40"); // feed 64 dots so the label clears the tear bar
const END = hex("10fffe45");

// Minimal Web Serial typings — not in TypeScript's lib.dom yet.
export type SerialPortLike = {
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  readonly writable: WritableStream<Uint8Array> | null;
  getInfo(): { usbVendorId?: number; bluetoothServiceClassId?: number | string };
};
type SerialLike = {
  requestPort(options?: object): Promise<SerialPortLike>;
  getPorts(): Promise<SerialPortLike[]>;
};

export function getSerial(): SerialLike | null {
  const nav = navigator as Navigator & { serial?: SerialLike };
  return nav.serial ?? null;
}

const INK_THRESHOLD = 190; // luminance below this prints black — generous so thin Thai strokes stay joined

/**
 * Canvas (already PRINT_WIDTH wide) → 1-bit rows, 1 = black, MSB = leftmost dot.
 * A plain threshold, not dithering: dithering speckles the anti-aliased edges
 * of small text. Photos/grey logos are dithered once at upload instead (see
 * ditherToBlackAndWhite), so they arrive here already black-and-white.
 */
export function canvasToRows(canvas: HTMLCanvasElement): { rows: Uint8Array; height: number } {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not supported on this device");
  const { width, height } = canvas;
  if (width !== PRINT_WIDTH) throw new Error(`Receipt must be ${PRINT_WIDTH}px wide`);
  const { data } = ctx.getImageData(0, 0, width, height);

  const rows = new Uint8Array(ROW_BYTES * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const a = data[i + 3] / 255; // transparent → white paper
      const l = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) * a + 255 * (1 - a);
      if (l < INK_THRESHOLD) rows[y * ROW_BYTES + (x >> 3)] |= 0x80 >> (x & 7);
    }
  }
  return { rows, height };
}

/** Floyd–Steinberg a canvas to pure black/white in place (used on logo upload). */
export function ditherToBlackAndWhite(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { width, height } = canvas;
  const image = ctx.getImageData(0, 0, width, height);
  const d = image.data;
  const lum = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const a = d[i * 4 + 3] / 255;
    lum[i] = (0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]) * a + 255 * (1 - a);
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const v = lum[i] < 128 ? 0 : 255;
      const err = lum[i] - v;
      d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v;
      d[i * 4 + 3] = 255;
      if (x + 1 < width) lum[i + 1] += (err * 7) / 16;
      if (y + 1 < height) {
        if (x > 0) lum[i + width - 1] += (err * 3) / 16;
        lum[i + width] += (err * 5) / 16;
        if (x + 1 < width) lum[i + width + 1] += err / 16;
      }
    }
  }
  ctx.putImageData(image, 0, 0);
}

/** Full byte stream for one label: per ≤255-row block a reset + raster header + rows. */
export function buildPrintBytes(rows: Uint8Array, height: number): Uint8Array[] {
  const parts: Uint8Array[] = [DENSITY_DARK];
  for (let start = 0; start < height; start += MAX_ROWS_PER_BLOCK) {
    const blockRows = Math.min(MAX_ROWS_PER_BLOCK, height - start);
    parts.push(RESET);
    // GS v 0: 1d 76 30 m xL xH yL yH — 48 bytes wide, blockRows high.
    parts.push(new Uint8Array([0x1d, 0x76, 0x30, 0x00, ROW_BYTES, 0x00, blockRows, 0x00]));
    parts.push(rows.subarray(start * ROW_BYTES, (start + blockRows) * ROW_BYTES));
  }
  parts.push(FEED_AFTER, END);
  return parts;
}

// setTimeout is clamped to ≥1s in background tabs, which would turn a 5s
// print into minutes when the station window is behind others. MessageChannel
// tasks aren't timer-throttled, so yield through those until the time passes.
function sleep(ms: number): Promise<void> {
  const until = performance.now() + ms;
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => {
      if (performance.now() >= until) {
        channel.port1.close();
        resolve();
      } else {
        channel.port2.postMessage(0);
      }
    };
    channel.port2.postMessage(0);
  });
}

export async function writeToPrinter(port: SerialPortLike, parts: Uint8Array[]): Promise<void> {
  if (!port.writable) throw new Error("Printer isn't connected");
  const writer = port.writable.getWriter();
  try {
    for (const part of parts) {
      for (let i = 0; i < part.length; i += CHUNK_BYTES) {
        await writer.write(part.slice(i, i + CHUNK_BYTES));
        await sleep(CHUNK_DELAY_MS);
      }
    }
  } finally {
    writer.releaseLock();
  }
}

export async function printCanvas(port: SerialPortLike, canvas: HTMLCanvasElement): Promise<void> {
  const { rows, height } = canvasToRows(canvas);
  await writeToPrinter(port, buildPrintBytes(rows, height));
}
