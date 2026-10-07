import { canonicalChampion, championDisplayName } from "../../shared/champions.js";
import { assetProxyUrl } from "./matches.js";
import {
  PNG_THEME, pngFitText, pngWrapText, pngLine, pngPanel, pngLoadImage,
  pngImageCover, pngImageContain, pngNumber, pngPercent, pngNumeric,
} from "./png-report.js";

export const PROFILE_SHOWCASE_SIZE = Object.freeze({ width: 1080, height: 1620 });
const W = PROFILE_SHOWCASE_SIZE.width;
const H = PROFILE_SHOWCASE_SIZE.height;
const C = { ...PNG_THEME, secondary: PNG_THEME.muted, violet: "#C4B5FD" };
const FACE_FOCUS = { Darius: "25% 23%", JarvanIV: "64% 25%", Karma: "64% 26%", Jhin: "48% 24%", Yunara: "58% 26%" };

/** Canvas and downloads deliberately use the same already loaded artwork. */
export async function loadProfileShowcaseAssets(champion = "") {
  const id = canonicalChampion(champion);
  const artUrl = id ? assetProxyUrl(`https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${id}_0.jpg`) : "";
  const [art, logo, mark] = await Promise.all([
    pngLoadImage(artUrl),
    pngLoadImage("/assets/nxt5-wordmark-640.webp"),
    pngLoadImage("/assets/nxt5-loader-favicon-256.webp"),
  ]);
  return { art, logo, mark, artFocus: FACE_FOCUS[id] || "50% 22%" };
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

function shade(ctx, start = 500, end = 1470) {
  const fade = ctx.createLinearGradient(0, start, 0, end);
  fade.addColorStop(0, "rgba(2,6,17,0)");
  fade.addColorStop(.48, "rgba(2,6,17,.75)");
  fade.addColorStop(.73, "rgba(2,6,17,.98)");
  fade.addColorStop(1, C.bg);
  ctx.fillStyle = fade;
  ctx.fillRect(0, start, W, H - start);
}

/** Mirror object-position while keeping the original splash proportions. */
function artwork(ctx, assets, { x = 0, y = 0, width = W, height = H, opacity = 1, focus = "50% 22%", radius = 0 } = {}) {
  if (!assets.art?.width || !assets.art?.height) {
    ctx.save();
    ctx.globalAlpha = opacity * .16;
    pngImageContain(ctx, assets.mark, x + width * .18, y + height * .12, width * .64, height * .6);
    ctx.restore();
    return false;
  }
  const positions = String(focus).match(/([\d.]+)%\s+([\d.]+)%/);
  const fx = positions ? Math.max(0, Math.min(1, Number(positions[1]) / 100)) : .5;
  const fy = positions ? Math.max(0, Math.min(1, Number(positions[2]) / 100)) : .5;
  ctx.save();
  ctx.globalAlpha = opacity;
  if (fx === .5 && fy === .5) {
    pngImageCover(ctx, assets.art, x, y, width, height, radius);
  } else {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    ctx.clip();
    const scale = Math.max(width / assets.art.width, height / assets.art.height);
    const dw = assets.art.width * scale;
    const dh = assets.art.height * scale;
    ctx.drawImage(assets.art, x + (width - dw) * fx, y + (height - dh) * fy, dw, dh);
  }
  ctx.restore();
  return true;
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
  const top = ctx.createLinearGradient(0, 0, 0, 330);
  top.addColorStop(0, "rgba(2,6,17,.9)");
  top.addColorStop(1, "rgba(2,6,17,0)");
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, W, 330);
  pngImageContain(ctx, assets.logo, 70, 72, 194, 62);
  fit(ctx, story ? "WRAPPED" : "COLLECTION JOUEUR", 74, 174, 24, C.secondary, 600, 480);
  fit(ctx, r.contextLabel || "PARTIES SÉLECTIONNÉES", 1006, 99, 26, C.text, 600, 690, "right");
  fit(ctx, r.dateLabel || "Dates indisponibles", 1006, 139, 26, C.secondary, 400, 690, "right");
  if (story) {
    fit(ctx, `${String(chapter + 1).padStart(2, "0")} / 05`, 1006, 185, 28, C.secondary, 400, 220, "right");
    pngLine(ctx, 64, 55, 1016, 55, spectrum(ctx), 4);
  }
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

function front(ctx, r, assets, focus) {
  background(ctx);
  artwork(ctx, assets, { focus });
  shade(ctx, 580, 1460);
  header(ctx, r, assets);
  fit(ctx, "TON PROFIL EN GRAND", 74, 986, 28, C.cyan, 600, 932);
  name(ctx, r.playerName, 62, 1128, 944, 160, 60);
  paragraph(ctx, identity(r) || "Profil joueur", 76, 1183, 930, 29, C.secondary, 1);
  pngLine(ctx, 74, 1223, 1006, 1223, "rgba(198,212,229,.23)");
  const stats = [
    [pngNumber(metric(r, "kda").value, 1), "KDA GLOBAL", metric(r, "kda").count],
    [pngNumber(metric(r, "csPerMin").value, 1), "CS / MIN", metric(r, "csPerMin").count],
    [pngPercent(metric(r, "kp").value), "PARTICIPATION (KP)", metric(r, "kp").count],
  ];
  stats.forEach(([value, label, count], i) => {
    const x = 74 + i * 316;
    fit(ctx, value, x, 1299, 62, C.text, 600, 270, "left", 43);
    fit(ctx, label, x + 2, 1335, 24, C.secondary, 600, 281);
    fit(ctx, coverage(count, r.games), x + 2, 1367, 22, C.secondary, 400, 278);
    if (i) pngLine(ctx, x - 32, 1253, x - 32, 1364, "rgba(198,212,229,.16)");
  });
  pngPanel(ctx, 74, 1394, 932, 84, { fill: "#0B1729", stroke: "rgba(103,232,249,.23)", radius: 10 });
  const results = r.results || {};
  fit(ctx, `${pngNumber(results.wins)} V / ${pngNumber(results.losses)} D${results.unknown ? ` / ${pngNumber(results.unknown)} ?` : ""}`, 101, 1446, 34, C.text, 600, 389, "left", 27);
  fit(ctx, pngPercent(results.rate), 522, 1446, 38, C.text, 700, 208, "left", 30);
  fit(ctx, "de victoires", 984, 1443, 25, C.secondary, 400, 239, "right");
  fit(ctx, "CHAMPION LE PLUS JOUÉ", 74, 1518, 23, C.secondary, 600, 700);
  const signature = r.signature;
  fit(ctx, signature ? `${championDisplayName(signature.champion)} · ${countLabel(signature.games)}` : "Champion indisponible", 74, 1558, 30, C.text, 600, 820, "left", 26);
  pngImageContain(ctx, assets.mark, 934, 1495, 73, 73);
  fit(ctx, rateCoverage(r), 540, 1591, 22, C.secondary, 400, 915, "center");
  frame(ctx);
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

function storyBase(ctx, assets, focus) {
  background(ctx);
  artwork(ctx, assets, { opacity: .13, focus });
}

function storyBilan(ctx, r, assets, focus) {
  artwork(ctx, assets, { opacity: .64, focus });
  shade(ctx, 310, 1440);
  fit(ctx, "TON BILAN, EN GRAND", 70, 315, 28, C.cyan, 600, 940);
  fit(ctx, "Tes parties.", 64, 438, 109, C.text, 700, 945);
  fit(ctx, "Ton histoire.", 64, 558, 109, C.text, 700, 945);
  fit(ctx, pngPercent(r.results?.rate), 55, 1010, 286, C.text, 700, 955, "left", 170);
  fit(ctx, "DE VICTOIRES", 74, 1090, 34, C.secondary, 600, 940);
  pngLine(ctx, 70, 1150, 1010, 1150);
  const blocks = [[pngNumber(r.results?.wins), "VICTOIRES", C.green], [pngNumber(r.results?.losses), "DÉFAITES", C.red], [duration(r.playTime?.seconds), "DE JEU", C.text]];
  blocks.forEach(([value, label, color], i) => {
    const x = 70 + i * 318;
    fit(ctx, value, x, 1275, 95, color, 700, 287, "left", 60);
    fit(ctx, label, x, 1325, 27, C.secondary, 600, 287);
  });
  fit(ctx, `${rateCoverage(r)} · durée : ${coverage(r.playTime?.count, r.games)}`, 70, 1411, 27, C.secondary, 400, 940);
}

function storySignature(ctx, r, assets, focus) {
  artwork(ctx, assets, { opacity: .95, focus });
  shade(ctx, 570, 1410);
  fit(ctx, "TON CHAMPION SIGNATURE", 70, 293, 28, C.cyan, 600, 940);
  const champion = r.signature;
  name(ctx, championDisplayName(champion?.champion) || "À découvrir", 60, 1022, 945, 206, 60);
  fit(ctx, "Le champion le plus joué sur cette sélection.", 73, 1095, 34, C.secondary, 400, 930);
  pngLine(ctx, 70, 1160, 1010, 1160);
  const blocks = [[pngNumber(champion?.games), "PARTIES"], [pngNumber(champion?.wins), "VICTOIRES"], [pngPercent(champion?.rate), "DE VICTOIRES"]];
  blocks.forEach(([value, label], i) => {
    const x = 70 + i * 318;
    fit(ctx, value, x, 1298, 101, i === 2 ? C.cyan : C.text, 700, 290, "left", 56);
    fit(ctx, label, x, 1350, 26, C.secondary, 600, 290);
  });
  fit(ctx, champion ? `${pngNumber(champion.known)} résultats connus sur ${countLabel(champion.games)}` : "Aucune donnée de champion disponible", 70, 1430, 29, C.secondary, 400, 940);
}

function storyHighlight(ctx, r, assets, focus) {
  fit(ctx, "TA PARTIE MARQUANTE", 70, 298, 28, C.cyan, 600, 940);
  fit(ctx, "Une partie.", 65, 414, 100, C.text, 700, 944);
  fit(ctx, "En détail.", 65, 527, 100, C.text, 700, 944);
  const game = r.highlight;
  artwork(ctx, assets, { x: 68, y: 584, width: 944, height: 354, opacity: .75, focus, radius: 24 });
  pngPanel(ctx, 68, 818, 944, 120, { fill: "rgba(2,6,17,.77)", stroke: null, radius: 0 });
  fit(ctx, championDisplayName(game?.champion) || "Partie indisponible", 101, 875, 53, C.text, 700, 872, "left", 36);
  fit(ctx, game?.title || "Statistiques de la sélection", 102, 918, 26, C.secondary, 400, 872);
  const blocks = [[game?.kills, "ÉLIMINATIONS"], [game?.deaths, "MORTS"], [game?.assists, "ASSISTANCES"]];
  blocks.forEach(([value, label], i) => {
    const x = 70 + i * 325;
    fit(ctx, pngNumber(value), x, 1125, 143, C.text, 700, 288, "left", 85);
    fit(ctx, label, x, 1174, 26, C.secondary, 600, 288);
  });
  pngLine(ctx, 68, 1222, 1010, 1222);
  const result = game?.result === "win" ? "VICTOIRE" : game?.result === "loss" ? "DÉFAITE" : "RÉSULTAT INCONNU";
  fit(ctx, result, 68, 1271, 30, game?.result === "win" ? C.green : game?.result === "loss" ? C.red : C.secondary, 600, 405);
  fit(ctx, game ? `${game.dateLabel} · ${duration(game.durationSeconds)}` : "—", 1010, 1271, 28, C.secondary, 400, 500, "right");
  fit(ctx, `${pngNumber(game?.damagePerMin)} dégâts/min`, 70, 1330, 32, C.text, 600, 455);
  fit(ctx, `${pngNumber(game?.csPerMin, 1)} CS/min`, 1010, 1330, 32, C.text, 600, 440, "right");
  paragraph(ctx, game?.selectionReason || "Des statistiques complètes sont nécessaires pour sélectionner une partie.", 70, 1400, 940, 25, C.secondary, 2, 32);
}

function storyProgression(ctx, r) {
  fit(ctx, "TON ÉVOLUTION", 70, 298, 28, C.cyan, 600, 940);
  fit(ctx, "D’un début", 64, 426, 110, C.text, 700, 944);
  fit(ctx, "à la suite.", 64, 550, 110, C.text, 700, 944);
  const progress = r.progression;
  const digits = progress?.key === "visionPerMin" ? 2 : 1;
  fit(ctx, signed(progress?.delta, digits), 55, 867, 248, spectrum(ctx), 700, 950, "left", 140);
  fit(ctx, progress?.label || "ÉVOLUTION INDISPONIBLE", 70, 972, 39, C.secondary, 600, 940);
  const early = progress?.early;
  const recent = progress?.recent;
  fit(ctx, `${early?.count ?? "—"} PREMIÈRES`, 70, 1115, 27, C.secondary, 600, 413);
  fit(ctx, `${recent?.count ?? "—"} DERNIÈRES`, 598, 1115, 27, C.secondary, 600, 412);
  fit(ctx, pngNumber(early?.value, digits), 70, 1230, 100, C.secondary, 700, 412);
  fit(ctx, pngNumber(recent?.value, digits), 598, 1230, 100, C.text, 700, 412);
  const max = Math.max(early?.value || 0, recent?.value || 0, 1);
  [early, recent].forEach((part, i) => {
    const x = i ? 598 : 70;
    ctx.fillStyle = C.border;
    ctx.fillRect(x, 1270, 412, 16);
    if (pngNumeric(part?.value) !== null) {
      ctx.fillStyle = i ? C.cyan : C.blue;
      ctx.fillRect(x, 1270, Math.max(0, part.value) / max * 412, 16);
    }
  });
  pngLine(ctx, 70, 1336, 1010, 1336);
  paragraph(ctx, progress ? `${progress.unit} · ${countLabel(progress.count)} datées${progress.excludedCount ? ` · ${progress.excludedCount} exclue${progress.excludedCount > 1 ? "s" : ""}` : ""}. Comparaison des deux moitiés chronologiques.` : "Au moins six mesures datées et deux blocs dont l’ordre peut être établi sont nécessaires.", 70, 1392, 940, 27, C.secondary, 2, 36);
}

function storyTeam(ctx, r, assets) {
  ctx.save();
  ctx.globalAlpha = .11;
  pngImageContain(ctx, assets.mark, 236, 320, 690, 690);
  ctx.restore();
  fit(ctx, "LE BILAN EN ÉQUIPE", 70, 301, 28, C.cyan, 600, 940);
  fit(ctx, "Avec", 64, 443, 122, C.text, 700, 944);
  name(ctx, r.teamName || "ton équipe", 64, 581, 944, 118, 54);
  name(ctx, r.playerName, 63, 936, 944, 204, 60);
  fit(ctx, r.role || "Profil joueur", 74, 1007, 40, C.violet, 600, 930);
  pngLine(ctx, 70, 1085, 1010, 1085);
  [[pngNumber(r.games), "PARTIES"], [pngPercent(r.results?.rate), "VICTOIRES"], [pngNumber(metric(r, "kda").value, 1), "KDA GLOBAL"]].forEach(([value, label], i) => {
    const x = 70 + i * 318;
    fit(ctx, value, x, 1210, 88, C.text, 700, 289, "left", 52);
    fit(ctx, label, x, 1267, 25, C.secondary, 600, 289);
  });
  paragraph(ctx, `${rateCoverage(r)} · KDA : ${coverage(metric(r, "kda").count, r.games)}.`, 70, 1389, 940, 28, C.secondary, 2, 37);
}

/** Pure drawing: no fetching, persistence, download, or data recomputation. */
export function drawProfileShowcase(canvas, report, { view = "front", chapter = 0, assets = {}, artFocus } = {}) {
  if (!canvas || typeof canvas.getContext !== "function") throw new TypeError("Un canvas est nécessaire pour dessiner le profil.");
  if (!report || typeof report !== "object") throw new TypeError("Un bilan de profil est nécessaire.");
  if (canvas.width !== W) canvas.width = W;
  if (canvas.height !== H) canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Le navigateur ne peut pas dessiner cette carte.");
  const focus = artFocus || assets.artFocus || "50% 22%";
  ctx.save();
  try {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    if (view === "back") back(ctx, report, assets);
    else if (view === "story") {
      const page = Math.max(0, Math.min(4, Math.trunc(Number(chapter) || 0)));
      storyBase(ctx, assets, focus);
      [storyBilan, storySignature, storyHighlight, storyProgression, storyTeam][page](ctx, report, assets, focus);
      header(ctx, report, assets, { story: true, chapter: page });
      footer(ctx, report);
    } else front(ctx, report, assets, focus);
  } finally {
    ctx.restore();
  }
  return canvas;
}
