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

function pngBlob(canvas) {
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

// PNGs are already compressed. A stored ZIP keeps all pages in one browser
// download, avoiding the permission prompt for multiple automatic downloads.
export async function pngDownloadPages(canvases, filename) {
  if (!canvases.length) throw new Error("Aucune page à exporter.");
  if (canvases.length === 1) return pngDownload(canvases[0], filename);
  const entries = [];
  const directory = [];
  const encoder = new TextEncoder();
  let offset = 0;
  let directorySize = 0;
  const base = filename.replace(/\.png$/i, "");
  for (let index = 0; index < canvases.length; index++) {
    const name = encoder.encode(`${base}-${String(index + 1).padStart(2, "0")}.png`);
    const bytes = new Uint8Array(await (await pngBlob(canvases[index])).arrayBuffer());
    let crc = 0xffffffff;
    for (const byte of bytes) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    crc = (crc ^ 0xffffffff) >>> 0;
    const local = new Uint8Array(30 + name.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    localView.setUint16(12, 33, true); // 1980-01-01: valid DOS date.
    localView.setUint32(14, crc, true);
    localView.setUint32(18, bytes.length, true);
    localView.setUint32(22, bytes.length, true);
    localView.setUint16(26, name.length, true);
    local.set(name, 30);
    entries.push(local, bytes);

    const central = new Uint8Array(46 + name.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(14, 33, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, bytes.length, true);
    centralView.setUint32(24, bytes.length, true);
    centralView.setUint16(28, name.length, true);
    centralView.setUint32(42, offset, true);
    central.set(name, 46);
    directory.push(central);
    directorySize += central.length;
    offset += local.length + bytes.length;
  }
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, canvases.length, true);
  endView.setUint16(10, canvases.length, true);
  endView.setUint32(12, directorySize, true);
  endView.setUint32(16, offset, true);
  downloadBlob(new Blob([...entries, ...directory, end], { type: "application/zip" }), `${base}.zip`);
}
