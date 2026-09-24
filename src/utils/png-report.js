export const PNG_THEME = Object.freeze({
  bg: "#020611",
  panel: "#0a1427",
  panelAlt: "#070e1d",
  border: "#293d52",
  text: "#f8fafc",
  muted: "#c6d4e5",
  subtle: "#afc1d6",
  cyan: "#67e8f9",
  blue: "#93c5fd",
  green: "#6ee7b7",
  yellow: "#fcd34d",
  red: "#fda4af",
  purple: "#a78bfa",
  pink: "#e879f9",
});

export function pngAccent(name = "cyan") {
  const key = { rose: "red", orange: "pink", amber: "yellow", emerald: "green", slate: "muted" }[name] || name;
  return PNG_THEME[key] || PNG_THEME.cyan;
}

export function pngTint(name = "cyan", alpha = 0.12) {
  const hex = pngAccent(name).slice(1);
  const rgb = [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
  return `rgba(${rgb.join(",")},${Math.max(0, Math.min(1, alpha))})`;
}

// Every truncation removes a source character, even when the ellipsis is wider
// than the available space. This also handles very long unbroken identifiers.
function ellipsize(ctx, text, width) {
  if (ctx.measureText(text).width <= width) return text;
  const chars = Array.from(text);
  while (chars.length && ctx.measureText(`${chars.join("")}…`).width > width) chars.pop();
  return ctx.measureText("…").width <= width ? `${chars.join("").trimEnd()}…` : "";
}

export function pngFitText(ctx, text, x, y, maxWidth, { font = "600 20px Inter, Arial, sans-serif", color = PNG_THEME.text, min = 20, align = "left" } = {}) {
  const value = String(text ?? "");
  const sizeMatch = font.match(/(\d+(?:\.\d+)?)px/);
  let size = sizeMatch ? Number(sizeMatch[1]) : 20;
  ctx.save();
  ctx.font = font;
  while (ctx.measureText(value).width > maxWidth && size > min) {
    size = Math.max(min, size - 1);
    ctx.font = font.replace(/\d+(?:\.\d+)?px/, `${size}px`);
  }
  const fitted = ellipsize(ctx, value, Math.max(0, maxWidth));
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(fitted, x, y);
  ctx.restore();
  return fitted;
}

export function pngWrapText(ctx, text, maxWidth, { font = "500 20px Inter, Arial, sans-serif", maxLines = Infinity } = {}) {
  if (maxLines <= 0 || maxWidth <= 0) return [];
  ctx.save();
  ctx.font = font;
  const lines = [];
  for (const paragraph of String(text ?? "").split(/\r?\n/)) {
    let line = "";
    for (const word of paragraph.trim().split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth) { line = candidate; continue; }
      if (line) { lines.push(line); line = ""; }
      for (const char of Array.from(word)) {
        if (line && ctx.measureText(line + char).width > maxWidth) { lines.push(line); line = ""; }
        line += char;
      }
    }
    lines.push(line);
  }
  const result = lines.slice(0, maxLines);
  if (lines.length > maxLines && result.length) {
    result[result.length - 1] = ellipsize(ctx, `${result.at(-1)}…`, maxWidth);
  }
  ctx.restore();
  return result;
}

export function pngLine(ctx, x1, y1, x2, y2, color = PNG_THEME.border, width = 1) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

export function pngPanel(ctx, x, y, w, h, { fill = PNG_THEME.panel, stroke = PNG_THEME.border, radius = 18, accent } = {}) {
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
  if (accent) {
    ctx.clip();
    ctx.fillStyle = pngAccent(accent);
    ctx.fillRect(x, y, 4, h);
  }
  ctx.restore();
}

export function pngBackground(ctx, width, height) {
  ctx.fillStyle = PNG_THEME.bg;
  ctx.fillRect(0, 0, width, height);
  const accent = ctx.createLinearGradient(0, 0, width, 0);
  accent.addColorStop(0, PNG_THEME.cyan);
  accent.addColorStop(0.55, PNG_THEME.blue);
  accent.addColorStop(1, PNG_THEME.pink);
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, width, 4);
}

export function pngMetricStrip(ctx, { x = 64, y = 200, width, items = [] }) {
  if (!items.length) return;
  pngPanel(ctx, x, y, width, 120);
  const cellWidth = width / items.length;
  items.forEach((item, index) => {
    const cellX = x + index * cellWidth;
    if (index) pngLine(ctx, cellX, y + 20, cellX, y + 100);
    pngFitText(ctx, item.label, cellX + 24, y + 30, cellWidth - 48, { font: "600 20px Inter, Arial, sans-serif", color: PNG_THEME.muted });
    pngFitText(ctx, item.value, cellX + 24, y + 73, cellWidth - 48, { font: "700 38px Inter, Arial, sans-serif", color: item.accent ? pngAccent(item.accent) : PNG_THEME.text, min: 28 });
    pngFitText(ctx, item.detail, cellX + 24, y + 101, cellWidth - 48 - (item.marker ? 110 : 0), { font: "500 20px Inter, Arial, sans-serif", color: PNG_THEME.muted });
    if (item.marker) pngFitText(ctx, item.marker, cellX + cellWidth - 24, y + 101, 102, { font: "600 20px Inter, Arial, sans-serif", color: pngAccent(item.markerAccent), align: "right" });
  });
}

export function pngHeader(ctx, { width, title, subtitle = "", eyebrow = "", logo, meta, margin = 64 }) {
  const textWidth = width - margin * 2 - 270;
  if (eyebrow) pngFitText(ctx, eyebrow, margin, 62, textWidth, { font: "600 20px Inter, Arial, sans-serif", color: PNG_THEME.cyan });
  pngFitText(ctx, title, margin, 117, textWidth, { font: "700 44px Inter, Arial, sans-serif", min: 28 });
  pngFitText(ctx, subtitle, margin, 156, width - margin * 2, { font: "500 22px Inter, Arial, sans-serif", color: PNG_THEME.muted });
  pngImageContain(ctx, logo, width - margin - 204, 46, 204, 65);
  if (meta) pngFitText(ctx, meta, width - margin, 129, 240, { font: "500 20px Inter, Arial, sans-serif", color: PNG_THEME.muted, align: "right" });
  pngLine(ctx, margin, 184, width - margin, 184);
  return 200;
}

export function pngFooter(ctx, { width, height, label = "", margin = 64 }) {
  pngLine(ctx, margin, height - 67, width - margin, height - 67);
  pngFitText(ctx, label, margin, height - 33, width - margin * 2 - 290, { font: "500 20px Inter, Arial, sans-serif", color: PNG_THEME.muted });
  pngFitText(ctx, `Exporté le ${new Date().toLocaleDateString("fr-FR")}`, width - margin, height - 33, 280, { font: "500 20px Inter, Arial, sans-serif", color: PNG_THEME.muted, align: "right" });
}

// An absent metric remains absent; a recorded zero remains a number.
export function pngNumeric(value) {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !value.trim()) return null;
  const number = Number(typeof value === "string" ? value.trim().replace(/\s/g, "").replace(",", ".").replace(/%$/, "") : value);
  return Number.isFinite(number) ? number : null;
}

export function pngNumber(value, digits = 0) {
  const number = pngNumeric(value);
  return number === null ? "—" : number.toLocaleString("fr-FR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function pngPercent(value, digits = 0) {
  return pngNumeric(value) === null ? "—" : `${pngNumber(value, digits)} %`;
}

export function pngMean(values = []) {
  const known = values.map(pngNumeric).filter((value) => value !== null);
  return known.length ? known.reduce((sum, value) => sum + value, 0) / known.length : null;
}

export function pngSum(values = []) {
  const known = values.map(pngNumeric).filter((value) => value !== null);
  return known.length ? known.reduce((sum, value) => sum + value, 0) : null;
}

export function pngDateRange(matches = []) {
  const dates = matches.flatMap((match) => {
    let raw = match.raw;
    if (typeof raw === "string") { try { raw = JSON.parse(raw); } catch { raw = null; } }
    const candidates = [raw?.info?.gameStartTimestamp, raw?.info?.gameCreation, match.game_date, match.played_at, match.game_creation, match.date];
    for (let value of candidates) {
      if (value === null || value === undefined || value === "") continue;
      if (typeof value === "number" || /^\d{10,13}$/.test(String(value))) {
        value = Number(value);
        if (value <= 0) continue;
        if (value < 1e12) value *= 1000;
      }
      const date = new Date(value);
      if (Number.isFinite(date.getTime())) return [date];
    }
    return [];
  }).sort((a, b) => a - b);
  if (!dates.length) return "Date indisponible";
  const format = (date) => date.toLocaleDateString("fr-FR");
  const first = format(dates[0]);
  const last = format(dates.at(-1));
  return first === last ? first : `${first} – ${last}`;
}

export function pngCreateCanvas(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Le navigateur ne peut pas créer l’export PNG.");
  return { canvas, ctx };
}

const imageCache = new Map();

export function pngLoadImage(url) {
  if (!url) return Promise.resolve(null);
  if (imageCache.has(url)) return imageCache.get(url);
  const pending = new Promise((resolve) => {
    const image = new Image();
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      image.onload = null;
      image.onerror = null;
      resolve(value);
    };
    const timeout = setTimeout(() => { finish(null); image.src = ""; }, 8000);
    image.crossOrigin = "anonymous";
    image.onload = () => finish(image);
    image.onerror = () => finish(null);
    image.src = url;
  });
  imageCache.set(url, pending);
  pending.then((image) => { if (!image) imageCache.delete(url); });
  return pending;
}

export function pngImageCover(ctx, image, x, y, w, h, radius = 10) {
  if (!image || !image.width || !image.height) return false;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.clip();
  const scale = Math.max(w / image.width, h / image.height);
  const dw = image.width * scale;
  const dh = image.height * scale;
  ctx.drawImage(image, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  ctx.restore();
  return true;
}

export function pngImageContain(ctx, image, x, y, w, h) {
  if (!image || !image.width || !image.height) return false;
  const scale = Math.min(w / image.width, h / image.height);
  const dw = image.width * scale;
  const dh = image.height * scale;
  ctx.drawImage(image, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  return true;
}

export function pngBlob(canvas) {
  return new Promise((resolve, reject) => canvas.toBlob((image) => image ? resolve(image) : reject(new Error("Impossible de générer le PNG.")), "image/png"));
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = filename;
  link.href = url;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export async function pngDownload(canvas, filename) {
  downloadBlob(await pngBlob(canvas), filename);
}

const pngCrcTable = Uint32Array.from({ length: 256 }, (_, value) => {
  for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
  return value >>> 0;
});

function pngChunk(type, data = new Uint8Array()) {
  const chunk = new Uint8Array(data.length + 12);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, data.length);
  for (let index = 0; index < 4; index++) chunk[index + 4] = type.charCodeAt(index);
  chunk.set(data, 8);
  let crc = 0xffffffff;
  for (let index = 4; index < chunk.length - 4; index++) crc = (crc >>> 8) ^ pngCrcTable[(crc ^ chunk[index]) & 255];
  view.setUint32(chunk.length - 4, (crc ^ 0xffffffff) >>> 0);
  return chunk;
}

// Stack every section at its original resolution in ONE PNG. Encode small
// strips into one zlib stream instead of allocating a report-sized canvas:
// long histories can exceed the browser's canvas height or pixel limits.
export async function pngPagesBlob(canvases) {
  if (!canvases.length) throw new Error("Aucune page à exporter.");
  let width = 0;
  let height = 0;
  for (const canvas of canvases) {
    if (!Number.isInteger(canvas.width) || !Number.isInteger(canvas.height) || canvas.width <= 0 || canvas.height <= 0) {
      throw new Error("Les dimensions de l’export PNG sont invalides.");
    }
    width = Math.max(width, canvas.width);
    height += canvas.height;
  }
  if (width > 0x7fffffff || height > 0x7fffffff) throw new Error("L’export PNG est trop grand. Réduis la sélection.");
  if (canvases.length === 1) return pngBlob(canvases[0]);
  if (typeof CompressionStream === "undefined") throw new Error("Cet export PNG nécessite un navigateur à jour.");

  const header = new Uint8Array(13);
  const headerView = new DataView(header.buffer);
  headerView.setUint32(0, width);
  headerView.setUint32(4, height);
  header[8] = 8; // Eight bits per RGBA channel, no interlacing.
  header[9] = 6;
  const chunks = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), pngChunk("IHDR", header)];
  const stripHeight = 128;
  const { canvas: strip, ctx } = pngCreateCanvas(width, stripHeight);
  let pageIndex = 0;
  let sourceY = 0;
  const pixels = new ReadableStream({
    pull(controller) {
      if (pageIndex === canvases.length) { controller.close(); return; }
      const source = canvases[pageIndex];
      const rows = Math.min(stripHeight, source.height - sourceY);
      ctx.fillStyle = PNG_THEME.bg;
      ctx.fillRect(0, 0, width, rows);
      ctx.drawImage(source, 0, sourceY, source.width, rows, 0, 0, source.width, rows);
      const rgba = ctx.getImageData(0, 0, width, rows).data;
      const stride = width * 4;
      const scanlines = new Uint8Array((stride + 1) * rows);
      for (let row = 0; row < rows; row++) {
        // Each row starts with PNG filter 0; preserve every original pixel.
        scanlines.set(rgba.subarray(row * stride, (row + 1) * stride), row * (stride + 1) + 1);
      }
      controller.enqueue(scanlines);
      sourceY += rows;
      if (sourceY === source.height) { pageIndex++; sourceY = 0; }
    },
  });
  const reader = pixels.pipeThrough(new CompressionStream("deflate")).getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(pngChunk("IDAT", value));
    }
    chunks.push(pngChunk("IEND"));
    return new Blob(chunks, { type: "image/png" });
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
    strip.width = 0;
    strip.height = 0;
  }
}

export async function pngDownloadPages(canvases, filename) {
  downloadBlob(await pngPagesBlob(canvases), filename);
}
