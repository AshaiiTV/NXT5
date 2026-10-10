import { t } from "../i18n/translate.js";
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
  return pngFitText(ctx, value, x, y, width, { font: `${weight} ${size}px Inter, Arial, sans-serif`, color, min, align, localize: false });
}

function paragraph(ctx, value, x, y, width = 932, size = 26, color = C.secondary, maxLines = 2, lineHeight = size * 1.35, weight = 400) {
  const font = `${weight} ${size}px Inter, Arial, sans-serif`;
  const lines = pngWrapText(ctx, value, width, { font, maxLines, localize: false });
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
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(20, 20, W - 40, H - 40, 29);
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = .68;
  ctx.strokeStyle = spectrum(ctx, 20, 20, W - 40, H - 40);
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(31, 31, W - 62, H - 62, 22);
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(198,212,229,.18)";
  ctx.stroke();
  ctx.restore();
}

// These rectangles are exclusively reserved for whole, centred artwork. Neither
// text nor a foreground fade is painted over the portrait, including its eyes.
export const PROFILE_ART_REGIONS = Object.freeze({
  front: Object.freeze({ x: 90, y: 197, width: 900, height: 815 }),
  signature: Object.freeze({ x: 240, y: 390, width: 600, height: 1000 }),
  highlight: Object.freeze({ x: 298, y: 417, width: 484, height: 750 }),
});

function artwork(ctx, assets, region) {
  if (drawProfileChampionArt(ctx, assets, region)) return true;
  const centerX = region.x + region.width / 2;
  const centerY = region.y + region.height / 2;
  pngImageContain(ctx, assets.mark, centerX - 96, centerY - 124, 192, 192);
  fit(ctx, t("Illustration indisponible"), centerX, centerY + 113, 26, C.secondary, 400, region.width - 20, "center");
  return false;
}

const countLabel = (count) => t("{0} partie{1}", [pngNumber(count), count === 1 ? "" : "s"]);
const identity = (r) => [r.teamName, r.role].filter(Boolean).join(" · ");
const metric = (r, key) => r.metrics?.[key] || { value: null, count: 0 };
const coverage = (count, total) => t("{0} / {1} parties", [pngNumber(count), pngNumber(total)]);
const rateCoverage = (r) => r.results?.unknown > 0 ? t("{0} résultats connus / {1}", [pngNumber(r.results.known), pngNumber(r.games)]) : countLabel(r.games);
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
  pngImageContain(ctx, assets.logo, 70, 66, 174, 55);
  fit(ctx, story ? t("WRAPPED") : t("COLLECTION JOUEUR"), 74, 160, 23, C.secondary, 600, 390);
  fit(ctx, r.contextLabel || t("PARTIES SÉLECTIONNÉES"), 1006, 91, 24, C.text, 600, 690, "right");
  fit(ctx, r.dateLabel || t("Dates indisponibles"), 1006, 130, 24, C.secondary, 400, 690, "right");
  if (story) {
    fit(ctx, `${String(chapter + 1).padStart(2, "0")} / 05`, 1006, 167, 24, C.secondary, 600, 220, "right");
    for (let i = 0; i < 5; i += 1) {
      pngPanel(ctx, 70 + i * 190, 194, 178, 4, { fill: i === chapter ? spectrum(ctx) : i < chapter ? C.violet : C.border, stroke: null, radius: 2 });
    }
  }
}

function footer(ctx, r) {
  pngLine(ctx, 70, 1482, 1010, 1482);
  fit(ctx, r.playerName || t("Joueur"), 70, 1532, 29, C.text, 600, 435);
  fit(ctx, identity(r), 1010, 1532, 27, C.secondary, 400, 475, "right");
  fit(ctx, `${countLabel(r.games)} · ${r.dateLabel || "Dates indisponibles"}`, 70, 1580, 24, C.secondary, 400, 940);
}

function name(ctx, value, x, y, width, size, min = 58) {
  fit(ctx, String(value || t("Joueur")).toUpperCase(), x, y, size, C.text, 700, width, "left", min);
}

function front(ctx, r, assets) {
  background(ctx);
  artwork(ctx, assets, PROFILE_ART_REGIONS.front);
  header(ctx, r, assets);
  fit(ctx, t("TON PROFIL EN GRAND"), 74, 1053, 28, C.cyan, 600, 932);
  name(ctx, r.playerName, 62, 1156, 944, 124, 60);
  paragraph(ctx, identity(r) || t("Profil joueur"), 76, 1200, 930, 29, C.secondary, 1);
  pngLine(ctx, 74, 1223, 1006, 1223, "rgba(198,212,229,.23)");
  const stats = [
    [pngNumber(metric(r, "kda").value, 1), "KDA GLOBAL", metric(r, "kda").count],
    [pngNumber(metric(r, "csPerMin").value, 1), "CS / MIN", metric(r, "csPerMin").count],
    [pngPercent(metric(r, "kp").value), "PARTICIPATION (KP)", metric(r, "kp").count],
  ];
  stats.forEach(([value, label, count], i) => {
    const x = 74 + i * 316;
    fit(ctx, value, x, 1299, 62, C.text, 600, 270, "left", 43);
    fit(ctx, t(label), x + 2, 1335, 24, C.secondary, 600, 281);
    fit(ctx, coverage(count, r.games), x + 2, 1367, 22, C.secondary, 400, 278);
    if (i) pngLine(ctx, x - 32, 1253, x - 32, 1364, "rgba(198,212,229,.16)");
  });
  pngPanel(ctx, 74, 1394, 932, 84, { fill: "#0B1729", stroke: "rgba(103,232,249,.23)", radius: 10 });
  const results = r.results || {};
  fit(ctx, `${pngNumber(results.wins)} V / ${pngNumber(results.losses)} D${results.unknown ? ` / ${pngNumber(results.unknown)} ?` : ""}`, 101, 1446, 34, C.text, 600, 389, "left", 27);
  fit(ctx, pngPercent(results.rate), 522, 1446, 38, C.text, 700, 208, "left", 30);
  fit(ctx, t("de victoires"), 984, 1443, 25, C.secondary, 400, 239, "right");
  fit(ctx, t("CHAMPION LE PLUS JOUÉ"), 74, 1518, 23, C.secondary, 600, 700);
  const signature = r.signature;
  fit(ctx, signature ? `${championDisplayName(signature.champion)} · ${countLabel(signature.games)}` : t("Champion indisponible"), 74, 1558, 30, C.text, 600, 820, "left", 26);
  pngImageContain(ctx, assets.mark, 934, 1495, 73, 73);
  fit(ctx, rateCoverage(r), 540, 1591, 22, C.secondary, 400, 915, "center");
  frame(ctx);
}

function back(ctx, r, assets) {
  background(ctx);
  header(ctx, r, assets);
  fit(ctx, t("LE BILAN DU JOUEUR"), 75, 229, 26, C.cyan, 600, 745);
  name(ctx, r.playerName, 67, 338, 780, 110, 52);
  pngImageContain(ctx, assets.mark, 890, 254, 114, 114);
  fit(ctx, identity(r), 76, 382, 28, C.secondary, 400, 930);
  pngLine(ctx, 74, 412, 1006, 412, spectrum(ctx), 2);
  [
    [r.totals?.kills, "ÉLIMINATIONS"], [r.totals?.deaths, "MORTS"], [r.totals?.assists, "ASSISTANCES"],
  ].forEach(([value, label], i) => {
    const x = 75 + i * 320;
    fit(ctx, pngNumber(value), x, 509, 72, i === 1 ? C.secondary : C.text, 600, 278, "left", 46);
    fit(ctx, t(label), x + 2, 548, 24, C.secondary, 600, 279);
  });
  fit(ctx, t("Totaux · {0}", [coverage(r.totals?.count, r.games)]), 75, 582, 22, C.secondary, 400, 931);
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
    fit(ctx, t(label), x + 1, y + 39, 24, C.secondary, 600, 257);
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
  fit(ctx, t("{0} · ? = résultat inconnu", [r.datedGames === r.games ? t("De la plus ancienne à la plus récente") : t("Ordre des dates connues")]), 75, 1118, 23, C.secondary, 400, 931);
  const pool = (r.champions || []).slice(0, 3);
  fit(ctx, t("LES PLUS JOUÉS"), 75, 1183, 26, C.text, 600, 400);
  fit(ctx, t("{0} / {1} champions", [pool.length, (r.champions || []).length]), 1006, 1183, 25, C.secondary, 400, 480, "right");
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
  if (!pool.length) fit(ctx, t("Aucun champion renseigné"), 75, 1268, 29, C.secondary, 400, 930);
  pngLine(ctx, 74, 1470, 1006, 1470);
  paragraph(ctx, t("KDA = (éliminations + assistances) / max(1, morts). KP = participation aux éliminations de l’équipe. Dégâts aux champions."), 75, 1508, 930, 22, C.secondary, 2, 30);
  fit(ctx, rateCoverage(r), 540, 1584, 23, C.secondary, 400, 930, "center");
  frame(ctx);
}

function storyBase(ctx) {
  background(ctx);
  pngLine(ctx, 34, 231, 34, 1444, "rgba(198,212,229,.14)");
  pngLine(ctx, 1046, 231, 1046, 1444, "rgba(198,212,229,.14)");
}

function chapterTitle(ctx, eyebrow, title, { size = 78, center = false } = {}) {
  const x = center ? 540 : 70;
  const align = center ? "center" : "left";
  fit(ctx, eyebrow, x, 259, 26, C.cyan, 600, 940, align);
  fit(ctx, title, x, 353, size, C.text, 700, 940, align, 48);
}

function stage(ctx, region) {
  const { x, y, width, height } = region;
  const glow = ctx.createRadialGradient(540, y + height * .52, 10, 540, y + height * .52, width * .86);
  glow.addColorStop(0, "rgba(129,140,248,.15)");
  glow.addColorStop(1, "rgba(129,140,248,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(70, y, 940, height);
  // All framing marks stay outside the entire art region.
  for (const side of [-1, 1]) {
    const edge = side === -1 ? x - 13 : x + width + 13;
    pngLine(ctx, edge, y + 30, edge, y + 100, C.border, 2);
    pngLine(ctx, edge, y + height - 100, edge, y + height - 30, C.border, 2);
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
  chapterTitle(ctx, t("01 · LE BILAN"), t("Chaque partie compte."));
  fit(ctx, pngNumber(r.games), 56, 655, 314, C.text, 700, 500, "left", 135);
  fit(ctx, t("PARTIES"), 573, 454, 47, C.cyan, 700, 435);
  paragraph(ctx, t("dans cette sélection"), 575, 509, 432, 37, C.secondary, 2, 48);
  fit(ctx, duration(r.playTime?.seconds), 574, 635, 78, C.text, 600, 432, "left", 52);
  fit(ctx, t("DE JEU MESURÉ"), 577, 678, 25, C.secondary, 600, 430);
  resultRibbon(ctx, r, 70, 731, 940, 32);
  [[r.results?.wins, "VICTOIRES", C.green], [r.results?.losses, "DÉFAITES", C.red], [r.results?.unknown, "INCONNUS", C.secondary]].forEach(([value, label, color], index) => {
    const x = 70 + index * 319;
    fit(ctx, pngNumber(value), x, 846, 66, color, 700, 95, "left", 45);
    fit(ctx, t(label), x + 105, 840, 25, C.secondary, 600, 200);
  });
  pngLine(ctx, 70, 894, 1010, 894);
  fit(ctx, pngPercent(r.results?.rate), 57, 1091, 194, C.text, 700, 555, "left", 112);
  fit(ctx, t("DE VICTOIRES"), 622, 987, 29, C.cyan, 600, 387);
  paragraph(ctx, t("{0} résultats connus sur {1}", [pngNumber(r.results?.known), countLabel(r.games)]), 623, 1044, 380, 27, C.secondary, 3, 36);
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
  if (!recent.length) fit(ctx, t("Résultats individuels indisponibles"), 70, 1265, 30, C.secondary, 400, 940);
  fit(ctx, r.datedGames === r.games ? t("De la plus ancienne à la plus récente") : t("Les dates disponibles définissent l’ordre d’affichage"), 70, 1340, 25, C.secondary, 400, 940);
  fit(ctx, t("? = résultat inconnu · durée : {0}", [coverage(r.playTime?.count, r.games)]), 70, 1412, 25, C.secondary, 400, 940);
}

function storySignature(ctx, r, assets) {
  const champion = r.signature;
  chapterTitle(ctx, t("02 · TON CHAMPION SIGNATURE"), String(championDisplayName(champion?.champion) || t("À découvrir")).toUpperCase(), { size: 119, center: true });
  stage(ctx, PROFILE_ART_REGIONS.signature);
  artwork(ctx, assets, PROFILE_ART_REGIONS.signature);
  fit(ctx, pngNumber(champion?.games), 71, 746, 108, C.text, 700, 155, "left", 58);
  fit(ctx, t("PARTIES"), 74, 791, 26, C.cyan, 600, 152);
  fit(ctx, t("SUR"), 74, 881, 24, C.secondary, 500, 152);
  fit(ctx, pngNumber(r.games), 71, 965, 76, C.secondary, 600, 155);
  fit(ctx, pngPercent(champion?.rate), 1008, 746, 79, C.text, 700, 155, "right", 44);
  fit(ctx, t("VICTOIRES"), 1007, 791, 24, C.cyan, 600, 154, "right");
  fit(ctx, pngNumber(champion?.known), 1008, 925, 68, C.secondary, 600, 152, "right", 44);
  fit(ctx, t("RÉSULTATS"), 1007, 970, 24, C.secondary, 500, 154, "right");
  fit(ctx, t("CONNUS"), 1007, 1005, 24, C.secondary, 500, 154, "right");
  fit(ctx, champion ? t("Le champion le plus joué sur cette sélection.") : t("Aucune donnée de champion disponible"), 540, 1443, 29, C.text, 500, 940, "center");
}
function storyHighlight(ctx, r, assets) {
  const game = r.highlight;
  chapterTitle(ctx, t("03 · TA PARTIE MARQUANTE"), t("Une partie à revoir."), { size: 82 });
  fit(ctx, championDisplayName(game?.champion) || t("Champion indisponible"), 540, 397, 29, C.violet, 600, 940, "center");
  stage(ctx, PROFILE_ART_REGIONS.highlight);
  artwork(ctx, assets, PROFILE_ART_REGIONS.highlight);
  const result = game?.result === "win" ? "VICTOIRE" : game?.result === "loss" ? "DÉFAITE" : "RÉSULTAT INCONNU";
  fit(ctx, t(result), 72, 485, 27, game?.result === "win" ? C.green : game?.result === "loss" ? C.red : C.secondary, 600, 211);
  paragraph(ctx, game?.dateLabel || t("Date indisponible"), 73, 534, 209, 27, C.secondary, 2, 37);
  fit(ctx, duration(game?.durationSeconds), 73, 639, 41, C.text, 600, 209);
  fit(ctx, t("DURÉE"), 75, 679, 23, C.secondary, 600, 209);
  fit(ctx, pngNumber(game?.kda, 1), 68, 856, 108, C.text, 700, 209, "left", 55);
  fit(ctx, t("KDA DE LA PARTIE"), 75, 903, 23, C.cyan, 600, 209);
  fit(ctx, pngNumber(game?.damagePerMin), 1007, 605, 76, C.text, 700, 208, "right", 46);
  fit(ctx, t("DÉGÂTS / MIN"), 1007, 649, 24, C.cyan, 600, 208, "right");
  fit(ctx, pngNumber(game?.csPerMin, 1), 1007, 819, 76, C.text, 700, 208, "right", 46);
  fit(ctx, t("CS / MIN"), 1007, 862, 24, C.cyan, 600, 208, "right");
  fit(ctx, game?.title || t("Statistiques de la sélection"), 540, 1208, 26, C.secondary, 500, 934, "center");
  pngLine(ctx, 70, 1234, 1010, 1234, spectrum(ctx), 2);
  [[game?.kills, "ÉLIMINATIONS"], [game?.deaths, "MORTS"], [game?.assists, "ASSISTANCES"]].forEach(([value, label], index) => {
    const center = 221 + index * 320;
    fit(ctx, pngNumber(value), center, 1347, 96, index === 1 ? C.secondary : C.text, 700, 284, "center", 66);
    fit(ctx, t(label), center, 1386, 24, C.secondary, 600, 284, "center");
    if (index < 2) pngLine(ctx, center + 160, 1260, center + 160, 1380, C.border);
  });
  paragraph(ctx, t(game?.selectionReason) || t("Des statistiques complètes sont nécessaires pour sélectionner une partie."), 70, 1432, 940, 23, C.secondary, 1, 30);
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
    fit(ctx, t("COURBE INDISPONIBLE"), 562, 796, 29, C.secondary, 600, 792, "center");
    fit(ctx, t("Les mesures datées apparaîtront ici."), 562, 847, 27, C.secondary, 400, 792, "center");
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
  fit(ctx, points[0].dateLabel || t("Début"), x, 1029, 23, C.secondary, 500, 400);
  fit(ctx, points.at(-1).dateLabel || t("Fin"), x + width, 1029, 23, C.secondary, 500, 400, "right");
}

function periodLabel(period) {
  const start = period?.startDateLabel;
  const end = period?.endDateLabel;
  return start ? start === end || !end ? start : `${start} – ${end}` : t("Dates indisponibles");
}

function storyProgression(ctx, r) {
  const progress = r.progression;
  const digits = progress?.key === "visionPerMin" ? 2 : 1;
  chapterTitle(ctx, t("04 · TON ÉVOLUTION"), t("D’une partie à l’autre."), { size: 77 });
  fit(ctx, t(progress?.label) || t("Évolution indisponible"), 72, 413, 36, C.secondary, 500, 936);
  fit(ctx, signed(progress?.delta, digits), 62, 568, 150, C.text, 700, 462, "left", 90);
  fit(ctx, t(progress?.unit) || t("MESURE À VENIR"), 530, 497, 32, C.cyan, 600, 474);
  paragraph(ctx, t("Écart entre les moyennes des deux périodes"), 532, 543, 474, 25, C.secondary, 2, 34);
  progressionChart(ctx, progress, digits);
  fit(ctx, t("Une mesure par partie · pointillés : moyenne de chaque période"), 70, 1086, 24, C.secondary, 400, 940);
  [[progress?.early, "PREMIÈRES PARTIES", C.violet], [progress?.recent, "DERNIÈRES PARTIES", C.cyan]].forEach(([part, label, color], index) => {
    const x = index ? 558 : 70;
    pngPanel(ctx, x, 1120, 452, 223, { fill: C.panel, stroke: C.border, radius: 16 });
    pngLine(ctx, x + 24, 1120, x + 148, 1120, color, 3);
    fit(ctx, t(label), x + 26, 1166, 23, color, 600, 400);
    fit(ctx, pngNumber(part?.value, digits), x + 23, 1248, 75, C.text, 700, 260, "left", 52);
    fit(ctx, t("{0} parties", [pngNumber(part?.count)]), x + 427, 1240, 23, C.secondary, 500, 141, "right");
    fit(ctx, periodLabel(part), x + 26, 1304, 22, C.secondary, 400, 400);
  });
  paragraph(ctx, progress ? t("{0} datées{1}. Deux moitiés chronologiques, sans attribuer l’écart à une cause.", [countLabel(progress.count), progress.excludedCount ? t(" · {0} exclue{1}", [progress.excludedCount, progress.excludedCount > 1 ? "s" : ""]) : ""]) : t("Au moins six mesures datées et deux blocs dont l’ordre peut être établi sont nécessaires."), 70, 1402, 940, 25, C.secondary, 2, 34);
}

function storyTeam(ctx, r, assets) {
  chapterTitle(ctx, t("05 · TON ÉQUIPE, AUJOURD’HUI"), String(r.teamName || t("Équipe")).toUpperCase(), { size: 107 });
  pngLine(ctx, 70, 408, 1010, 408, spectrum(ctx), 2);
  fit(ctx, t("LE JOUEUR DE CE WRAPPED"), 73, 478, 25, C.secondary, 600, 710);
  name(ctx, r.playerName, 64, 628, 728, 126, 60);
  pngImageContain(ctx, assets.mark, 814, 469, 196, 196);
  fit(ctx, r.role || t("Rôle non renseigné"), 75, 689, 38, C.violet, 600, 730);
  paragraph(ctx, t("{0} dans cette sélection · {1}", [countLabel(r.games), r.dateLabel || t("dates indisponibles")]), 75, 756, 930, 29, C.secondary, 2, 39);
  const roster = Array.isArray(r.teammates) ? r.teammates : [];
  const selectedId = r.playerId == null ? "" : String(r.playerId);
  const selected = (member) => selectedId && String(member.id) === selectedId;
  const ordered = [...roster].sort((a, b) => Number(Boolean(selected(b))) - Number(Boolean(selected(a))));
  const displayed = ordered.slice(0, 6);
  fit(ctx, t("EFFECTIF ACTUEL"), 73, 870, 26, C.cyan, 600, 530);
  fit(ctx, displayed.length < roster.length ? t("{0} / {1} profils affichés", [displayed.length, roster.length]) : t("{0} profil{1}", [roster.length, roster.length === 1 ? "" : "s"]), 1007, 870, 24, C.secondary, 500, 420, "right");
  displayed.forEach((member, index) => {
    const y = 901 + index * 75;
    const current = selected(member);
    if (current) pngPanel(ctx, 70, y, 940, 65, { fill: "#10242F", stroke: "#355666", radius: 10 });
    else pngLine(ctx, 74, y + 64, 1007, y + 64, "rgba(198,212,229,.14)");
    fit(ctx, member.role || "—", 92, y + 42, 25, current ? C.cyan : C.violet, 600, 151);
    fit(ctx, member.name || t("Profil sans nom"), 254, y + 42, 31, C.text, current ? 700 : 500, current ? 594 : 725, "left", 26);
    if (current) fit(ctx, t("CE PROFIL"), 986, y + 40, 21, C.cyan, 600, 130, "right");
  });
  if (!displayed.length) {
    fit(ctx, t("Effectif non renseigné"), 73, 987, 38, C.text, 600, 930);
    paragraph(ctx, t("Le profil et les parties disponibles restent dans ce bilan."), 75, 1053, 926, 30, C.secondary, 2, 41);
  }
  paragraph(ctx, t("L’effectif actuel ne permet pas de déduire qui a joué ces parties."), 73, 1415, 934, 25, C.secondary, 2, 32);
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
