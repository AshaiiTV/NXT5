export const PNG_THEME = Object.freeze({
  bg: "#080e19",
  panel: "#101a29",
  panelAlt: "#0d1623",
  border: "#263345",
  text: "#f1f5f9",
  muted: "#94a3b8",
  subtle: "#64748b",
  cyan: "#67e8f9",
  blue: "#93c5fd",
  green: "#6ee7b7",
  yellow: "#fcd34d",
  red: "#fda4af",
  purple: "#c4b5fd",
});

export function pngAccent(name = "cyan") {
  const key = { pink: "red", rose: "red", orange: "yellow", amber: "yellow", emerald: "green", slate: "muted" }[name] || name;
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

export function pngFitText(ctx, text, x, y, maxWidth, { font = "600 20px Inter, Arial, sans-serif", color = PNG_THEME.text, min = 16, align = "left" } = {}) {
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
}

export function pngMetricStrip(ctx, { x = 64, y = 200, width, items = [] }) {
  if (!items.length) return;
  pngPanel(ctx, x, y, width, 120);
  const cellWidth = width / items.length;
  items.forEach((item, index) => {
    const cellX = x + index * cellWidth;
    if (index) pngLine(ctx, cellX, y + 20, cellX, y + 100);
    pngFitText(ctx, String(item.label || "").toUpperCase(), cellX + 24, y + 30, cellWidth - 48, { font: "600 16px Inter, Arial, sans-serif", color: PNG_THEME.muted, min: 14 });
    pngFitText(ctx, item.value, cellX + 24, y + 72, cellWidth - 48, { font: "700 36px Inter, Arial, sans-serif", color: item.accent ? pngAccent(item.accent) : PNG_THEME.text, min: 24 });
    pngFitText(ctx, item.detail, cellX + 24, y + 98, cellWidth - 48 - (item.marker ? 100 : 0), { font: "500 16px Inter, Arial, sans-serif", color: PNG_THEME.muted, min: 14 });
    if (item.marker) pngFitText(ctx, item.marker, cellX + cellWidth - 24, y + 98, 92, { font: "600 16px Inter, Arial, sans-serif", color: pngAccent(item.markerAccent), min: 14, align: "right" });
  });
}

export function pngHeader(ctx, { width, title, subtitle = "", eyebrow = "Analyse équipe", logo, meta, margin = 64 }) {
  const textWidth = width - margin * 2 - 270;
  pngFitText(ctx, eyebrow.toUpperCase(), margin, 62, textWidth, { font: "600 15px Inter, Arial, sans-serif", color: PNG_THEME.cyan, min: 14 });
  pngFitText(ctx, title, margin, 117, textWidth, { font: "700 44px Inter, Arial, sans-serif", min: 28 });
  pngFitText(ctx, subtitle, margin, 156, width - margin * 2, { font: "500 21px Inter, Arial, sans-serif", color: PNG_THEME.muted, min: 17 });
  if (!pngImageContain(ctx, logo, width - margin - 204, 46, 204, 65)) {
    pngFitText(ctx, "NXT5", width - margin, 93, 220, { font: "800 36px Inter, Arial, sans-serif", align: "right" });
  }
  if (meta) pngFitText(ctx, meta, width - margin, 129, 240, { font: "500 14px Inter, Arial, sans-serif", color: PNG_THEME.muted, min: 13, align: "right" });
  pngLine(ctx, margin, 184, width - margin, 184);
  return 200;
}

export function pngFooter(ctx, { width, height, label = "Rapport équipe", margin = 64 }) {
  pngLine(ctx, margin, height - 67, width - margin, height - 67);
  pngFitText(ctx, `NXT5 · ${label}`, margin, height - 33, width - margin * 2 - 290, { font: "500 16px Inter, Arial, sans-serif", color: PNG_THEME.muted });
  pngFitText(ctx, new Date().toLocaleDateString("fr-FR"), width - margin, height - 33, 260, { font: "500 16px Inter, Arial, sans-serif", color: PNG_THEME.muted, align: "right" });
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

export async function pngDownload(canvas, filename) {
  const blob = await new Promise((resolve, reject) => canvas.toBlob((image) => image ? resolve(image) : reject(new Error("Impossible de générer le PNG.")), "image/png"));
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = filename;
  link.href = url;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
