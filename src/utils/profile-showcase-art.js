import { canonicalChampion } from "../../shared/champions.js";
import { assetProxyUrl } from "./matches.js";
import { pngLoadImage } from "./png-report.js";

function imageSize(image) {
  const width = image?.naturalWidth || image?.width;
  const height = image?.naturalHeight || image?.height;
  return Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0 ? { width, height } : null;
}

async function loadArt(url) {
  try { return await pngLoadImage(url); } catch { return null; }
}

/** Riot's loading artwork already frames the champion. Never guess splash focal points. */
export async function loadProfileChampionArt(champion = "") {
  const id = canonicalChampion(champion);
  if (!id) return { art: null, backdrop: null, artLayout: "empty" };
  const root = "https://ddragon.leagueoflegends.com/cdn/img/champion";
  const portrait = await loadArt(assetProxyUrl(`${root}/loading/${id}_0.jpg`));
  // A decorative splash must not delay the face or duplicate its silhouette.
  if (imageSize(portrait)) return { art: portrait, backdrop: null, artLayout: "portrait" };
  // Even the fallback keeps the full source: a less imposing champion is better
  // than cutting their head out of the frame when the portrait is unavailable.
  const splash = await loadArt(assetProxyUrl(`${root}/splash/${id}_0.jpg`));
  if (imageSize(splash)) return { art: splash, backdrop: null, artLayout: "landscape" };
  return { art: null, backdrop: null, artLayout: "empty" };
}

/** Full-source, centered containment shared by the preview and PNG export. */
export function profileChampionArtLayout(image, { x = 0, y = 0, width, height, radius = 0 } = {}) {
  const source = imageSize(image);
  if (!source || ![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return null;
  // A small inset keeps all source corners inside a rounded destination too.
  const inset = Math.max(0, Math.min(Number.isFinite(radius) ? radius : 0, width / 2, height / 2)) * (1 - Math.SQRT1_2);
  const scale = Math.min((width - inset * 2) / source.width, (height - inset * 2) / source.height);
  const destinationWidth = source.width * scale;
  const destinationHeight = source.height * scale;
  return {
    sourceX: 0, sourceY: 0, sourceWidth: source.width, sourceHeight: source.height,
    x: x + (width - destinationWidth) / 2, y: y + (height - destinationHeight) / 2,
    width: destinationWidth, height: destinationHeight,
  };
}

/** Only the subdued background may be cropped; the visible champion never is. */
export function drawProfileChampionArt(ctx, assets, { x = 0, y = 0, width, height, opacity = 1, radius = 0 } = {}) {
  const layout = profileChampionArtLayout(assets?.art, { x, y, width, height, radius });
  if (!layout) return false;
  const alpha = Math.max(0, Math.min(1, Number.isFinite(opacity) ? opacity : 1));
  const backdrop = imageSize(assets?.backdrop);
  if (backdrop && assets.backdrop !== assets.art) {
    const corner = Number.isFinite(radius) ? Math.max(0, Math.min(radius, width / 2, height / 2)) : 0;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, corner);
    ctx.clip();
    ctx.globalAlpha *= alpha * .12;
    const scale = Math.max(width / backdrop.width, height / backdrop.height);
    ctx.drawImage(assets.backdrop, x + (width - backdrop.width * scale) / 2, y + (height - backdrop.height * scale) / 2, backdrop.width * scale, backdrop.height * scale);
    ctx.restore();
  }
  ctx.save();
  ctx.globalAlpha *= alpha;
  // Nine-argument drawImage makes the complete source rectangle explicit.
  // No clip, mask, gradient or text belongs in front of the face.
  ctx.drawImage(assets.art, layout.sourceX, layout.sourceY, layout.sourceWidth, layout.sourceHeight, layout.x, layout.y, layout.width, layout.height);
  ctx.restore();
  return true;
}
