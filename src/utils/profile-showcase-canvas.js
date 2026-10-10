import { championDisplayName } from "../../shared/champions.js";
import { loadProfileChampionArt, drawProfileChampionArt } from "./profile-showcase-art.js";
import {
  PNG_THEME, pngFitText, pngWrapText, pngLine, pngPanel, pngLoadImage,
  pngImageContain, pngNumber, pngPercent, pngNumeric,
} from "./png-report.js";

export const PROFILE_SHOWCASE_SIZE = Object.freeze({ width: 1080, height: 1620 });
const W = PROFILE_SHOWCASE_SIZE.width;
const H = PROFILE_SHOWCASE_SIZE.height;
const C = { ...PNG_THEME, secondary: PNG_THEME.muted, violet: "#C4B5FD" };

/** Canvas and downloads deliberately use the same already loaded artwork. */
export async function loadProfileShowcaseAssets(champion = "") {
  const [championArt, logo, mark] = await Promise.all([
    loadProfileChampionArt(champion),
    pngLoadImage("/assets/nxt5-wordmark-640.webp"),
    pngLoadImage("/assets/nxt5-loader-favicon-256.webp"),
  ]);
  return { ...championArt, logo, mark };
}

function fit(ctx, value, x, y, size = 28, color = C.text, weight = 600, width = W - 72 - x, align = "left", min = size) {
  return pngFitText(ctx, value, x, y, width, { font: `${weight} ${size}px Inter, Arial, sans-serif`, color, min, align });
}

function paragraph(ctx, value, x, y, width = 932, size = 26, color = C.secondary, maxLines = 2, lineHeight = size * 1.35, weight = 400) {
  const font = `${weight} ${size}px Inter, Arial, sans-serif`;
  const lines = pngWrapText(ctx, value, width, { font, maxLines });
  lines.forEach((line, i) => fit(ctx, line, x, y + i * lineHeight, size, color, weight, width));
  return y + Math.max(0, lines.length - 1) * lineHeight;
}

function spectrum(ctx, x = 0, y = 0, width = W, height = 600) {
  const gradient = ctx.createLinearGradient(x, y, x + width, y + height);
  gradient.addColorStop(0, C.cyan);
  gradient.addColorStop(.38, "#818CF8");
  gradient.addColorStop(.65, C.purple);
  gradient.addColorStop(1, C.pink);
  return gradient;
}

function background(ctx) {
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(890, 260, 30, 890, 260, 850);
  glow.addColorStop(0, "rgba(124,58,237,.16)");
  glow.addColorStop(1, "rgba(124,58,237,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
}

function frame(ctx) {
  pngLine(ctx, 72, 40, 232, 40, spectrum(ctx, 72, 40, 160, 0), 3);
}

// These rectangles are exclusively reserved for whole, centred artwork. Neither
// text nor a foreground fade is painted over the portrait, including its eyes.
export const PROFILE_ART_REGIONS = Object.freeze({
  front: Object.freeze({ x: 70, y: 210, width: 940, height: 884 }),
  signature: Object.freeze({ x: 70, y: 380, width: 940, height: 870 }),
  highlight: Object.freeze({ x: 70, y: 380, width: 940, height: 794 }),
});

function artwork(ctx, assets, region) {
  if (drawProfileChampionArt(ctx, assets, region)) return true;
  const centerX = region.x + region.width / 2;
  const centerY = region.y + region.height / 2;
  pngImageContain(ctx, assets.mark, centerX - 96, centerY - 124, 192, 192);
  fit(ctx, "Illustration indisponible", centerX, centerY + 113, 26, C.secondary, 400, region.width - 20, "center");
  return false;
}

const countLabel = (count) => `${pngNumber(count)} partie${count === 1 ? "" : "s"}`;
const identity = (r) => [r.teamName, r.role].filter(Boolean).join(" · ");
const metric = (r, key) => r.metrics?.[key] || { value: null, count: 0 };
const coverage = (count, total) => `${pngNumber(count)} / ${pngNumber(total)} parties`;
const rateCoverage = (r) => r.results?.unknown > 0 ? `${pngNumber(r.results.known)} résultats connus / ${pngNumber(r.games)}` : countLabel(r.games);
const signed = (value, digits = 1) => {
  if (pngNumeric(value) === null) return "—";
  const rounded = Number(Number(value).toFixed(digits));
  return `${rounded > 0 ? "+" : ""}${pngNumber(rounded, digits)}`;
};

function duration(seconds) {
  if (pngNumeric(seconds) === null) return "—";
  const minutes = Math.floor(seconds / 60);
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, "0")}` : `${minutes} min`;
}

function header(ctx, r, assets, { story = false, chapter = 0 } = {}) {
  pngImageContain(ctx, assets.logo, 70, 66, 156, 49);
  fit(ctx, r.contextLabel || "PARTIES SÉLECTIONNÉES", 1006, 88, 24, C.text, 500, 690, "right");
  fit(ctx, r.dateLabel || "Dates indisponibles", 1006, 128, 24, C.secondary, 400, 690, "right");
  if (story) {
    fit(ctx, `WRAPPED / ${String(chapter + 1).padStart(2, "0")}`, 74, 174, 23, C.secondary, 500, 390);
  }
  frame(ctx);
}

function footer(ctx, r) {
  pngLine(ctx, 70, 1482, 1010, 1482);
  fit(ctx, r.playerName || "Joueur", 70, 1532, 29, C.text, 600, 435);
  fit(ctx, identity(r), 1010, 1532, 27, C.secondary, 400, 475, "right");
  fit(ctx, `${countLabel(r.games)} · ${r.dateLabel || "Dates indisponibles"}`, 70, 1580, 24, C.secondary, 400, 940);
}

function name(ctx, value, x, y, width, size, min = 58) {
  fit(ctx, String(value || "Joueur").toUpperCase(), x, y, size, C.text, 700, width, "left", min);
}

function front(ctx, r, assets) {
  background(ctx);
  const signature = r.signature;
  stage(ctx, PROFILE_ART_REGIONS.front, { variant: "card" });
  artwork(ctx, assets, PROFILE_ART_REGIONS.front);
  header(ctx, r, assets);
  name(ctx, r.playerName, 62, 1257, 950, 154, 60);
  fit(ctx, identity(r) || "Profil joueur", 73, 1302, 27, C.secondary, 500, 934);
  fit(ctx, signature ? `${championDisplayName(signature.champion)} · CHAMPION LE PLUS JOUÉ` : "Champion indisponible", 73, 1344, 23, C.cyan, 500, 934);
  polygon(ctx, [[40, 1380], [1040, 1380], [1040, 1555], [72, 1555], [40, 1523]], "#0E1D30");
  pngLine(ctx, 40, 1380, 392, 1380, C.cyan, 4);
  pngLine(ctx, 705, 1555, 1040, 1555, C.purple, 4);
  const stats = [
    [pngNumber(metric(r, "kda").value, 1), "KDA GLOBAL", metric(r, "kda").count],
    [pngNumber(metric(r, "csPerMin").value, 1), "CS / MIN", metric(r, "csPerMin").count],
    [pngPercent(metric(r, "kp").value), "PARTICIPATION (KP)", metric(r, "kp").count],
  ];
  stats.forEach(([value, label, count], i) => {
    const x = 74 + i * 316;
    fit(ctx, value, x, 1464, 78, C.text, 700, 270, "left", 43);
    fit(ctx, label, x + 2, 1502, 24, C.secondary, 500, 281);
    fit(ctx, coverage(count, r.games), x + 2, 1533, 22, C.secondary, 400, 278);
  });
  fit(ctx, rateCoverage(r), 74, 1585, 22, C.secondary, 400, 915);
}

function back(ctx, r, assets) {
  background(ctx);
  header(ctx, r, assets);
  fit(ctx, "LE BILAN DU JOUEUR", 75, 229, 26, C.cyan, 600, 745);
  name(ctx, r.playerName, 67, 338, 780, 110, 52);
  pngImageContain(ctx, assets.mark, 890, 254, 114, 114);
  fit(ctx, identity(r), 76, 382, 28, C.secondary, 400, 930);
  pngLine(ctx, 74, 412, 1006, 412, spectrum(ctx), 2);
  [
    [r.totals?.kills, "ÉLIMINATIONS"], [r.totals?.deaths, "MORTS"], [r.totals?.assists, "ASSISTANCES"],
  ].forEach(([value, label], i) => {
    const x = 75 + i * 320;
    fit(ctx, pngNumber(value), x, 509, 72, i === 1 ? C.secondary : C.text, 600, 278, "left", 46);
    fit(ctx, label, x + 2, 548, 24, C.secondary, 600, 279);
  });
  fit(ctx, `Totaux · ${coverage(r.totals?.count, r.games)}`, 75, 582, 22, C.secondary, 400, 931);
  pngPanel(ctx, 74, 613, 932, 318, { radius: 17 });
  pngLine(ctx, 384, 637, 384, 910);
  pngLine(ctx, 695, 637, 695, 910);
  pngLine(ctx, 99, 771, 981, 771);
  const stats = [
    [pngNumber(metric(r, "kda").value, 1), "KDA GLOBAL", metric(r, "kda").count],
    [pngPercent(metric(r, "kp").value), "KP", metric(r, "kp").count],
    [pngNumber(metric(r, "csPerMin").value, 1), "CS / MIN", metric(r, "csPerMin").count],
    [pngNumber(metric(r, "damagePerMin").value), "DÉGÂTS / MIN", metric(r, "damagePerMin").count],
    [pngNumber(metric(r, "vision").value, 1), "VISION / PARTIE", metric(r, "vision").count],
    [pngPercent(r.results?.rate), "VICTOIRES", r.results?.known],
  ];
  stats.forEach(([value, label, count], i) => {
    const x = 103 + (i % 3) * 311;
    const y = i < 3 ? 682 : 841;
    fit(ctx, value, x, y, 49, C.text, 600, 257, "left", 36);
    fit(ctx, label, x + 1, y + 39, 24, C.secondary, 600, 257);
    fit(ctx, coverage(count, r.games), x + 1, y + 69, 22, C.secondary, 400, 257);
  });
  const recent = (r.recentResults || []).slice(-12);
  fit(ctx, `${recent.length} ${r.datedGames === r.games ? "DERNIÈRES PARTIES" : "PARTIES AFFICHÉES"}`, 75, 985, 26, C.text, 600, 930);
  const gap = 10;
  const cell = (932 - gap * 11) / 12;
  recent.forEach((entry, i) => {
    const known = entry.result === "win" || entry.result === "loss";
    const win = entry.result === "win";
    const x = 74 + i * (cell + gap);
    pngPanel(ctx, x, 1011, cell, 66, { fill: known ? win ? "#10282B" : "#291826" : C.panel, stroke: known ? win ? "#285750" : "#684050" : C.border, radius: 7 });
    fit(ctx, known ? win ? "V" : "D" : "?", x + cell / 2, 1056, 29, known ? win ? C.green : C.red : C.secondary, 600, cell - 8, "center");
  });
  fit(ctx, `${r.datedGames === r.games ? "De la plus ancienne à la plus récente" : "Ordre des dates connues"} · ? = résultat inconnu`, 75, 1118, 23, C.secondary, 400, 931);
  const pool = (r.champions || []).slice(0, 3);
  fit(ctx, "LES PLUS JOUÉS", 75, 1183, 26, C.text, 600, 400);
  fit(ctx, `${pool.length} / ${(r.champions || []).length} champions`, 1006, 1183, 25, C.secondary, 400, 480, "right");
  pool.forEach((champion, i) => {
    const y = 1217 + i * 78;
    fit(ctx, championDisplayName(champion.champion), 75, y + 25, 29, C.text, 600, 309, "left", 24);
    fit(ctx, countLabel(champion.games), 75, y + 54, 22, C.secondary, 400, 309);
    pngPanel(ctx, 399, y + 18, 304, 7, { fill: C.border, stroke: null, radius: 3 });
    const length = Math.max(0, Math.min(304, 304 * champion.games / Math.max(1, pool[0].games)));
    if (length) pngPanel(ctx, 399, y + 18, length, 7, { fill: [C.cyan, C.violet, C.pink][i], stroke: null, radius: 3 });
    fit(ctx, `${champion.wins} V / ${champion.losses} D${champion.unknown ? ` / ${champion.unknown} ?` : ""}`, 1005, y + 28, 24, C.secondary, 600, 280, "right");
    if (i < pool.length - 1) pngLine(ctx, 75, y + 66, 1004, y + 66, "rgba(198,212,229,.11)");
  });
  if (!pool.length) fit(ctx, "Aucun champion renseigné", 75, 1268, 29, C.secondary, 400, 930);
  pngLine(ctx, 74, 1470, 1006, 1470);
  paragraph(ctx, "KDA = (éliminations + assistances) / max(1, morts). KP = participation aux éliminations de l’équipe. Dégâts aux champions.", 75, 1508, 930, 22, C.secondary, 2, 30);
  fit(ctx, rateCoverage(r), 540, 1584, 23, C.secondary, 400, 930, "center");
  frame(ctx);
}

function storyBase(ctx) {
  background(ctx);
}

function chapterTitle(ctx, eyebrow, title, { size = 78, center = false } = {}) {
  const x = center ? 540 : 70;
  const align = center ? "center" : "left";
  fit(ctx, eyebrow, x, 259, 26, C.cyan, 600, 940, align);
  fit(ctx, title, x, 353, size, C.text, 700, 940, align, 48);
}

function polygon(ctx, points, fill, stroke = null, lineWidth = 1) {
  ctx.save();
  ctx.beginPath();
  points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
  ctx.restore();
}

function stage(ctx, region, { variant = "signature" } = {}) {
  // All geometry stays behind the complete official image. The
  // portrait is painted last, with no crop, mask, text or glow over its face.
  const { x, y, width, height } = region;
  const bottom = y + height;
  const light = ctx.createRadialGradient(540, y + height * .5, 30, 540, y + height * .5, width * .6);
  light.addColorStop(0, "rgba(99,102,241,.35)");
  light.addColorStop(1, "rgba(99,102,241,0)");
  ctx.fillStyle = light;
  ctx.fillRect(0, y, W, height);
  const cyanPlate = ctx.createLinearGradient(80, y, 780, bottom);
  cyanPlate.addColorStop(0, variant === "highlight" ? "#6D347E" : "#156E88");
  cyanPlate.addColorStop(1, "#112639");
  const violetPlate = ctx.createLinearGradient(520, y, 970, bottom);
  violetPlate.addColorStop(0, "#382577");
  violetPlate.addColorStop(1, variant === "signature" ? "#7652AE" : "#2A244B");
  polygon(ctx, [[x + 2, y + height * .27], [x + width * .65, y + 20], [x + width * .79, bottom - 124], [x + 76, bottom - 4]], cyanPlate);
  polygon(ctx, [[x + width * .5, y + 50], [x + width - 18, y + height * .22], [x + width - 24, bottom - 10], [x + width * .32, bottom - 146]], violetPlate);
  polygon(ctx, [[x - 12, y + height * .21], [x + width * .68, y + 2], [x + width * .8, bottom - 86], [x + 62, bottom + 10]], null, "rgba(103,232,249,.55)", 1.5);
  polygon(ctx, [[x + width * .53, y + 33], [x + width + 8, y + height * .18], [x + width - 4, bottom + 9]], null, "rgba(196,181,253,.5)", 1.5);
  // Short registration bars give the side plates an intentional printed edge.
  for (let index = 0; index < 3; index += 1) {
    pngLine(ctx, x - 16, bottom - 125 + index * 11, x + 34, bottom - 125 + index * 11, C.cyan, 3);
    pngLine(ctx, x + width - 32, y + 110 + index * 11, x + width + 16, y + 110 + index * 11, C.violet, 3);
  }
}

function resultRibbon(ctx, r, x, y, width, height = 28) {
  const total = Math.max(0, pngNumeric(r.games) ?? 0);
  pngPanel(ctx, x, y, width, height, { fill: C.panel, stroke: null, radius: height / 2 });
  if (!total) return;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, height / 2);
  ctx.clip();
  let offset = 0;
  [[r.results?.wins, C.green], [r.results?.losses, C.red], [r.results?.unknown, C.border]].forEach(([count, color]) => {
    const segment = Math.max(0, pngNumeric(count) ?? 0) / total * width;
    ctx.fillStyle = color;
    ctx.fillRect(x + offset, y, segment, height);
    offset += segment;
  });
  ctx.restore();
}

function storyBilan(ctx, r) {
  polygon(ctx, [[40, 392], [1040, 392], [1040, 865], [790, 865], [40, 721]], "#0E2335");
  polygon(ctx, [[40, 392], [577, 392], [40, 721]], "#173E51");
  pngLine(ctx, 40, 392, 403, 392, C.cyan, 5);
  polygon(ctx, [[580, 916], [1040, 916], [1040, 1115], [580, 1115]], "#1A1638");
  chapterTitle(ctx, "LE BILAN", "La sélection en chiffres.", { size: 74 });
  fit(ctx, pngNumber(r.games), 56, 655, 314, C.text, 700, 500, "left", 135);
  fit(ctx, "PARTIES", 573, 454, 47, C.cyan, 700, 435);
  paragraph(ctx, "dans cette sélection", 575, 509, 432, 37, C.secondary, 2, 48);
  fit(ctx, duration(r.playTime?.seconds), 574, 635, 78, C.text, 600, 432, "left", 52);
  fit(ctx, "DE JEU MESURÉ", 577, 678, 25, C.secondary, 600, 430);
  resultRibbon(ctx, r, 70, 731, 940, 32);
  [[r.results?.wins, "VICTOIRES", C.green], [r.results?.losses, "DÉFAITES", C.red], [r.results?.unknown, "INCONNUS", C.secondary]].forEach(([value, label, color], index) => {
    const x = 70 + index * 319;
    fit(ctx, pngNumber(value), x, 846, 66, color, 700, 95, "left", 45);
    fit(ctx, label, x + 105, 840, 25, C.secondary, 600, 200);
  });
  pngLine(ctx, 70, 894, 1010, 894);
  fit(ctx, pngPercent(r.results?.rate), 57, 1091, 194, C.text, 700, 555, "left", 112);
  fit(ctx, "DE VICTOIRES", 622, 987, 29, C.cyan, 600, 387);
  paragraph(ctx, `${pngNumber(r.results?.known)} résultats connus sur ${countLabel(r.games)}`, 623, 1044, 380, 27, C.secondary, 3, 36);
  const recent = (r.recentResults || []).slice(-12);
  fit(ctx, `${pngNumber(recent.length)} ${r.datedGames === r.games ? "DERNIÈRES PARTIES" : "PARTIES AFFICHÉES"}`, 70, 1177, 27, C.text, 600, 940);
  const gap = 10;
  const cell = (940 - gap * 11) / 12;
  recent.forEach((entry, index) => {
    const win = entry.result === "win";
    const known = win || entry.result === "loss";
    const x = 70 + index * (cell + gap);
    pngPanel(ctx, x, 1210, cell, 81, { fill: known ? win ? "#10282B" : "#291826" : C.panel, stroke: known ? win ? "#285750" : "#684050" : C.border, radius: 10 });
    fit(ctx, known ? win ? "V" : "D" : "?", x + cell / 2, 1265, 34, known ? win ? C.green : C.red : C.secondary, 600, cell - 10, "center");
  });
  if (!recent.length) fit(ctx, "Résultats individuels indisponibles", 70, 1265, 30, C.secondary, 400, 940);
  fit(ctx, r.datedGames === r.games ? "De la plus ancienne à la plus récente" : "Les dates disponibles définissent l’ordre d’affichage", 70, 1340, 25, C.secondary, 400, 940);
  fit(ctx, `? = résultat inconnu · durée : ${coverage(r.playTime?.count, r.games)}`, 70, 1412, 25, C.secondary, 400, 940);
}

function storySignature(ctx, r, assets) {
  const champion = r.signature;
  stage(ctx, PROFILE_ART_REGIONS.signature, { variant: "signature" });
  artwork(ctx, assets, PROFILE_ART_REGIONS.signature);
  chapterTitle(ctx, "LE CHAMPION SIGNATURE", String(championDisplayName(champion?.champion) || "À découvrir").toUpperCase(), { size: 112 });
  polygon(ctx, [[42, 1290], [1038, 1290], [1038, 1440], [80, 1440], [42, 1402]], "#1B183B");
  pngLine(ctx, 42, 1290, 367, 1290, C.violet, 4);
  [[pngNumber(champion?.games), "PARTIES"], [pngNumber(champion?.wins), "VICTOIRES"], [pngPercent(champion?.rate), "DE VICTOIRES"]].forEach(([value, label], i) => {
    const x = 72 + i * 318;
    fit(ctx, value, x, 1374, 76, C.text, 700, 280, "left", 48);
    fit(ctx, label, x, 1415, 24, C.secondary, 500, 280);
  });
  fit(ctx, champion ? pngNumber(champion.known) + " résultats connus sur " + countLabel(champion.games) + " · Le plus joué." : "Aucune donnée de champion disponible", 72, 1460, 23, C.secondary, 400, 938);
}

function storyHighlight(ctx, r, assets) {
  const game = r.highlight;
  stage(ctx, PROFILE_ART_REGIONS.highlight, { variant: "highlight" });
  artwork(ctx, assets, PROFILE_ART_REGIONS.highlight);
  chapterTitle(ctx, "LA PARTIE MARQUANTE", String(championDisplayName(game?.champion) || "À découvrir").toUpperCase(), { size: 116 });
  const result = game?.result === "win" ? "VICTOIRE" : game?.result === "loss" ? "DÉFAITE" : "RÉSULTAT INCONNU";
  fit(ctx, result, 72, 1225, 25, game?.result === "win" ? C.green : game?.result === "loss" ? C.red : C.secondary, 600, 400);
  fit(ctx, game ? game.dateLabel + " · " + duration(game.durationSeconds) : "Date indisponible", 1008, 1225, 24, C.secondary, 400, 560, "right");
  polygon(ctx, [[42, 1260], [1038, 1260], [1038, 1438], [84, 1438], [42, 1396]], "#281A36");
  pngLine(ctx, 42, 1260, 367, 1260, C.pink, 4);
  [[game?.kills, "ÉLIMINATIONS"], [game?.deaths, "MORTS"], [game?.assists, "ASSISTANCES"]].forEach(([value, label], i) => {
    const x = 72 + i * 318;
    fit(ctx, pngNumber(value), x, 1370, 124, C.text, 700, 280, "left", 48);
    fit(ctx, label, x, 1415, 24, C.secondary, 500, 280);
  });
  fit(ctx, game?.selectionReason || "Des statistiques complètes sont nécessaires pour sélectionner une partie.", 72, 1460, 23, C.secondary, 400, 938);
}

function progressionChart(ctx, progress, digits) {
  const points = (progress?.series || []).filter((entry) => pngNumeric(entry?.value) !== null && pngNumeric(entry?.timestamp) !== null);
  const x = 142;
  const y = 637;
  const width = 838;
  const height = 342;
  const top = points.reduce((maximum, entry) => Math.max(maximum, Number(entry.value)), 1) * 1.12;
  const firstTime = points[0]?.timestamp;
  const lastTime = points.at(-1)?.timestamp;
  const timeSpan = lastTime - firstTime;
  const px = (entry) => x + (timeSpan > 0 ? (entry.timestamp - firstTime) / timeSpan : .5) * width;
  const py = (value) => y + height - Number(value) / top * height;
  for (let row = 0; row <= 3; row += 1) {
    const value = top / 3 * row;
    const yy = py(value);
    pngLine(ctx, x, yy, x + width, yy, "rgba(198,212,229,.16)");
    fit(ctx, pngNumber(value, digits), x - 24, yy + 8, 23, C.secondary, 500, 75, "right");
  }
  if (points.length < 2 || timeSpan <= 0) {
    fit(ctx, "COURBE INDISPONIBLE", 562, 796, 29, C.secondary, 600, 792, "center");
    fit(ctx, "Les mesures datées apparaîtront ici.", 562, 847, 27, C.secondary, 400, 792, "center");
    return;
  }
  const coordinates = points.map((entry) => ({ x: px(entry), y: py(entry.value) }));
  const middle = Math.min(points.length - 1, Math.max(1, progress?.early?.count || Math.floor(points.length / 2)));
  const boundary = (px(points[middle - 1]) + px(points[middle])) / 2;
  ctx.save();
  ctx.fillStyle = "rgba(196,181,253,.04)";
  ctx.fillRect(x, y, boundary - x, height);
  ctx.fillStyle = "rgba(103,232,249,.04)";
  ctx.fillRect(boundary, y, x + width - boundary, height);
  ctx.setLineDash([8, 9]);
  pngLine(ctx, boundary, y - 20, boundary, y + height, C.border, 2);
  [[progress.early, x, boundary, C.violet], [progress.recent, boundary, x + width, C.cyan]].forEach(([part, start, end, color]) => {
    if (pngNumeric(part?.value) !== null) pngLine(ctx, start, py(part.value), end, py(part.value), color, 2);
  });
  ctx.setLineDash([]);
  const area = ctx.createLinearGradient(0, y, 0, y + height);
  area.addColorStop(0, "rgba(103,232,249,.17)");
  area.addColorStop(1, "rgba(103,232,249,0)");
  ctx.beginPath();
  ctx.moveTo(coordinates[0].x, y + height);
  coordinates.forEach((point) => ctx.lineTo(point.x, point.y));
  ctx.lineTo(coordinates.at(-1).x, y + height);
  ctx.closePath();
  ctx.fillStyle = area;
  ctx.fill();
  ctx.beginPath();
  coordinates.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
  ctx.strokeStyle = spectrum(ctx, x, y, width, 0);
  ctx.lineWidth = 4;
  ctx.lineJoin = "round";
  ctx.stroke();
  coordinates.forEach((point, index) => {
    if (points.length > 40 && index !== 0 && index !== points.length - 1) return;
    ctx.beginPath();
    ctx.arc(point.x, point.y, index === points.length - 1 ? 7 : 4.5, 0, Math.PI * 2);
    ctx.fillStyle = C.bg;
    ctx.fill();
    ctx.strokeStyle = index < middle ? C.violet : C.cyan;
    ctx.lineWidth = 3;
    ctx.stroke();
  });
  ctx.restore();
  fit(ctx, points[0].dateLabel || "Début", x, 1029, 23, C.secondary, 500, 400);
  fit(ctx, points.at(-1).dateLabel || "Fin", x + width, 1029, 23, C.secondary, 500, 400, "right");
}

function periodLabel(period) {
  const start = period?.startDateLabel;
  const end = period?.endDateLabel;
  return start ? start === end || !end ? start : `${start} – ${end}` : "Dates indisponibles";
}

function storyProgression(ctx, r) {
  const progress = r.progression;
  const digits = progress?.key === "visionPerMin" ? 2 : 1;
  polygon(ctx, [[39, 439], [1041, 439], [1041, 587], [87, 587], [39, 539]], "#19223D");
  pngLine(ctx, 39, 439, 390, 439, C.violet, 4);
  polygon(ctx, [[42, 610], [1038, 610], [1038, 1049], [42, 1049]], "#0A182A");
  chapterTitle(ctx, "L’ÉVOLUTION", "D’une partie à l’autre.", { size: 77 });
  fit(ctx, progress?.label || "Évolution indisponible", 72, 413, 36, C.secondary, 500, 936);
  fit(ctx, signed(progress?.delta, digits), 62, 568, 150, C.text, 700, 462, "left", 90);
  fit(ctx, progress?.unit || "MESURE À VENIR", 530, 497, 32, C.cyan, 600, 474);
  paragraph(ctx, "Écart entre les moyennes des deux périodes", 532, 543, 474, 25, C.secondary, 2, 34);
  progressionChart(ctx, progress, digits);
  fit(ctx, "Une mesure par partie · pointillés : moyenne de chaque période", 70, 1086, 24, C.secondary, 400, 940);
  [[progress?.early, "PREMIÈRES PARTIES", C.violet], [progress?.recent, "DERNIÈRES PARTIES", C.cyan]].forEach(([part, label, color], index) => {
    const x = index ? 558 : 70;
    pngLine(ctx, x, 1120, x + 452, 1120, C.border);
    pngLine(ctx, x + 24, 1120, x + 148, 1120, color, 3);
    fit(ctx, label, x + 26, 1166, 23, color, 600, 400);
    fit(ctx, pngNumber(part?.value, digits), x + 23, 1248, 75, C.text, 700, 260, "left", 52);
    fit(ctx, `${pngNumber(part?.count)} parties`, x + 427, 1240, 23, C.secondary, 500, 141, "right");
    fit(ctx, periodLabel(part), x + 26, 1304, 22, C.secondary, 400, 400);
  });
  paragraph(ctx, progress ? `${countLabel(progress.count)} datées${progress.excludedCount ? ` · ${progress.excludedCount} exclue${progress.excludedCount > 1 ? "s" : ""}` : ""}. Deux moitiés chronologiques, sans attribuer l’écart à une cause.` : "Au moins six mesures datées et deux blocs dont l’ordre peut être établi sont nécessaires.", 70, 1402, 940, 25, C.secondary, 2, 34);
}

function storyTeam(ctx, r, assets) {
  polygon(ctx, [[40, 416], [1040, 416], [1040, 704], [771, 704], [40, 602]], "#201B42");
  polygon(ctx, [[760, 416], [1040, 416], [1040, 704], [922, 704]], "#30255E");
  chapterTitle(ctx, "L’ÉQUIPE, AUJOURD’HUI", String(r.teamName || "Équipe").toUpperCase(), { size: 107 });
  pngLine(ctx, 70, 408, 1010, 408, spectrum(ctx), 2);
  fit(ctx, "LE JOUEUR DE CE WRAPPED", 73, 478, 25, C.secondary, 600, 710);
  name(ctx, r.playerName, 64, 628, 728, 126, 60);
  pngImageContain(ctx, assets.mark, 814, 469, 196, 196);
  fit(ctx, r.role || "Rôle non renseigné", 75, 689, 38, C.violet, 600, 730);
  paragraph(ctx, `${countLabel(r.games)} dans cette sélection · ${r.dateLabel || "dates indisponibles"}`, 75, 756, 930, 29, C.secondary, 2, 39);
  const roster = Array.isArray(r.teammates) ? r.teammates : [];
  const selectedId = r.playerId == null ? "" : String(r.playerId);
  const selected = (member) => selectedId && String(member.id) === selectedId;
  const ordered = [...roster].sort((a, b) => Number(Boolean(selected(b))) - Number(Boolean(selected(a))));
  const displayed = ordered.slice(0, 6);
  fit(ctx, "EFFECTIF ACTUEL", 73, 870, 26, C.cyan, 600, 530);
  fit(ctx, displayed.length < roster.length ? `${displayed.length} / ${roster.length} profils affichés` : `${roster.length} profil${roster.length === 1 ? "" : "s"}`, 1007, 870, 24, C.secondary, 500, 420, "right");
  displayed.forEach((member, index) => {
    const y = 901 + index * 75;
    const current = selected(member);
    if (current) pngPanel(ctx, 70, y, 940, 65, { fill: "#10242F", stroke: "#355666", radius: 10 });
    else pngLine(ctx, 74, y + 64, 1007, y + 64, "rgba(198,212,229,.14)");
    fit(ctx, member.role || "—", 92, y + 42, 25, current ? C.cyan : C.violet, 600, 151);
    fit(ctx, member.name || "Profil sans nom", 254, y + 42, 31, C.text, current ? 700 : 500, current ? 594 : 725, "left", 26);
    if (current) fit(ctx, "CE PROFIL", 986, y + 40, 21, C.cyan, 600, 130, "right");
  });
  if (!displayed.length) {
    fit(ctx, "Effectif non renseigné", 73, 987, 38, C.text, 600, 930);
    paragraph(ctx, "Le profil et les parties disponibles restent dans ce bilan.", 75, 1053, 926, 30, C.secondary, 2, 41);
  }
  paragraph(ctx, "L’effectif actuel ne permet pas de déduire qui a joué ces parties.", 73, 1415, 934, 25, C.secondary, 2, 32);
}
/** Pure drawing: no fetching, persistence, download, or data recomputation. */
export function drawProfileShowcase(canvas, report, { view = "front", chapter = 0, assets = {} } = {}) {
  if (!canvas || typeof canvas.getContext !== "function") throw new TypeError("Un canvas est nécessaire pour dessiner le profil.");
  if (!report || typeof report !== "object") throw new TypeError("Un bilan de profil est nécessaire.");
  if (canvas.width !== W) canvas.width = W;
  if (canvas.height !== H) canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Le navigateur ne peut pas dessiner cette carte.");

  ctx.save();
  try {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    if (view === "back") back(ctx, report, assets);
    else if (view === "story") {
      const page = Math.max(0, Math.min(4, Math.trunc(Number(chapter) || 0)));
      storyBase(ctx);
      [storyBilan, storySignature, storyHighlight, storyProgression, storyTeam][page](ctx, report, assets);
      header(ctx, report, assets, { story: true, chapter: page });
      footer(ctx, report);
    } else front(ctx, report, assets);
  } finally {
    ctx.restore();
  }
  return canvas;
}
