import { PNG_THEME as P, pngFitText, pngWrapText, pngLine, pngPanel, pngImageContain, pngImageCover, pngNumber, pngPercent } from '../../src/utils/png-report.js';

export const PUBLICATION_PNG_WIDTH = 1440;
const M = 48;
const FONT = '"NXT5 Export", Arial, sans-serif';
const font = (size, weight = 500) => `${weight} ${size}px ${FONT}`;
const sideLabel = (side) => side === 'blue' ? 'Côté bleu' : side === 'red' ? 'Côté rouge' : 'Côté inconnu';
const colorFor = (value) => value === null || value === 0 ? P.muted : value < 0 ? P.red : P.green;
const signed = (value) => value === null || value === undefined ? '—' : `${value > 0 ? '+' : ''}${pngNumber(value)}`;
const SPELL_NAMES = { 1: 'Purge', 3: 'Fatigue', 4: 'Saut éclair', 6: 'Fantôme', 7: 'Soin', 11: 'Châtiment', 12: 'Téléportation', 13: 'Clarté', 14: 'Embrasement', 21: 'Barrière', 32: 'Marquage' };
const spellName = (id) => id === 0 ? 'Aucun' : SPELL_NAMES[id] || 'Indisponible';
function text(ctx, value, x, y, width, size = 24, color = P.text, weight = 500, align = 'left') {
  pngFitText(ctx, value, x, y, width, { font: font(size, weight), min: size, color, align });
}
function lines(ctx, value, width, size = 24, weight = 500) {
  return pngWrapText(ctx, value, width, { font: font(size, weight) });
}
function paragraph(ctx, values, x, y, width, size = 24, color = P.text, weight = 500, lineHeight = size + 6) {
  for (const [index, line] of values.entries()) text(ctx, line, x, y + index * lineHeight, width, size, color, weight);
  return values.length * lineHeight;
}
function panel(ctx, x, y, width, height) { pngPanel(ctx, x, y, width, height, { fill: P.panel, stroke: P.border, radius: 20 }); }
function dateLabel(value) {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('fr-FR', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Europe/Paris' }).format(date) : 'Date de partie indisponible';
}
/** Shared factual layout. includeHints is accepted for stored v1 payloads; hints are text-message only. */
export async function renderGamePublicationCanvas(snapshot, { createCanvas, loadLogo, loadAssets = undefined, includeHints: _includeHints = false }) {
  if (snapshot?.schemaVersion !== 1) throw new Error('Version de publication PNG non prise en charge.');
  const width = PUBLICATION_PNG_WIDTH;
  const contentW = width - M * 2;
  const innerW = contentW - 48;
  const canvas = createCanvas(width, 1);
  let ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Impossible de créer le contexte du PNG.');
  const titleLines = lines(ctx, `${snapshot.context.teamName} / ${snapshot.context.opponentName}`, contentW, 40, 700);
  const categoryLines = lines(ctx, snapshot.context.categories.map((category) => category.name).join(' · ') || 'Game d’équipe', contentW, 24);
  const metadataLines = lines(ctx, `${dateLabel(snapshot.playedAt)} · ${snapshot.context.gameId || 'Identifiant indisponible'}`, contentW, 22);
  const metricsY = 151 + titleLines.length * 50 + categoryLines.length * 32 + metadataLines.length * 29;
  const metricsH = 142;
  const objectivesY = metricsY + metricsH + 26;
  const objectiveColumnW = innerW / 2 - 20;
  const sides = [
    { key: 'ALLY', title: snapshot.context.teamName, side: snapshot.context.allySide },
    { key: 'ENEMY', title: snapshot.context.opponentName, side: snapshot.context.enemySide },
  ].sort((a, b) => (a.side === 'blue' ? 0 : a.side === 'red' ? 1 : 2) - (b.side === 'blue' ? 0 : b.side === 'red' ? 1 : 2));
  const columns = [
    { key: 'identity', label: 'Joueur / champion', width: 344 },
    { key: 'kda', label: 'K / D / A', width: 170 },
    { key: 'cs', label: 'CS', width: 88 },
    { key: 'participation', label: 'Participation', width: 158 },
    { key: 'gold', label: 'Or', width: 160 },
    { key: 'damage', label: 'Dégâts champions', width: 174 },
    { key: 'vision', label: 'Vision', width: 102 },
  ];
  let columnX = M + 24;
  for (const column of columns) { column.x = columnX; columnX += column.width; }
  for (const side of sides) {
    side.objectiveTitle = lines(ctx, side.title, objectiveColumnW, 24, 700);
    side.titleLines = lines(ctx, side.title, innerW - 400, 28, 700);
    side.rows = snapshot.participants.filter((row) => row.teamKey === side.key).map((row) => {
      const name = lines(ctx, row.name, 254, 22, 700);
      const champion = lines(ctx, `${row.role || 'Rôle inconnu'} · ${row.champion || 'Champion inconnu'}`, 254, 20, 600);
      const spells = lines(ctx, `Sorts : ${(row.spells || [null, null]).map(spellName).join(' · ')}`, innerW - 360, 20);
      return { row, name, champion, spells, height: Math.max(138, name.length * 28 + champion.length * 26 + 44, 88 + spells.length * 26) };
    });
    side.headingH = 95 + side.titleLines.length * 36;
    side.height = side.headingH + Math.max(82, side.rows.reduce((sum, row) => sum + row.height, 0)) + 12;
  }
  const objectivesH = 166 + Math.max(...sides.map((side) => side.objectiveTitle.length)) * 31;
  const rosterY = objectivesY + objectivesH + 26;
  const rosterH = sides.reduce((sum, side) => sum + side.height + 24, 0);
  const coverageLines = lines(ctx, `${snapshot.coverage.timeline.label} · ${snapshot.coverage.timeline.detail}.`, contentW, 20);
  const warningLines = snapshot.coverage.warnings.length ? lines(ctx, snapshot.coverage.warnings.join(' '), contentW, 20) : [];
  const footerY = rosterY + rosterH + 8;
  const height = Math.ceil(footerY + (coverageLines.length + warningLines.length) * 28 + 116);
  canvas.height = height;
  ctx = canvas.getContext('2d');
  ctx.fillStyle = P.bg;
  ctx.fillRect(0, 0, width, height);
  const gradient = ctx.createLinearGradient(0, 0, width, 0);
  gradient.addColorStop(0, P.cyan); gradient.addColorStop(0.55, P.blue); gradient.addColorStop(1, P.pink);
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, 5);
  const [logo, assets] = await Promise.all([loadLogo?.(), loadAssets?.(snapshot)]);
  if (logo) pngImageContain(ctx, logo, width - M - 220, 28, 220, 70);
  // Assets are supplied by the browser adapter; the native renderer never retrieves snapshot URLs.
  const asset = (type, id) => assets?.[type]?.get?.(id);
  text(ctx, 'GAME', M, 75, contentW - 260, 24, P.cyan, 600);
  let y = 138;
  y += paragraph(ctx, titleLines, M, y, contentW, 40, P.text, 700, 50);
  y += paragraph(ctx, categoryLines, M, y + 2, contentW, 24, P.muted, 500, 32);
  paragraph(ctx, metadataLines, M, y + 7, contentW, 22, P.muted, 500, 29);
  const facts = snapshot.facts;
  const metrics = [
    { title: 'Résultat', value: snapshot.context.result === 'Résultat inconnu' ? 'Inconnu' : snapshot.context.result, detail: sideLabel(snapshot.context.allySide), color: snapshot.context.result === 'Victoire' ? P.green : snapshot.context.result === 'Défaite' ? P.red : P.muted },
    { title: 'Durée · min:s', value: snapshot.context.duration || '—', detail: snapshot.context.patch ? `Patch ${snapshot.context.patch}` : 'Patch —', color: P.text },
    { title: 'Kills équipe / adversaires', value: `${pngNumber(facts.kills.ally)} / ${pngNumber(facts.kills.enemy)}`, detail: 'Kills', color: P.cyan },
    { title: 'Écart d’or final', value: signed(facts.gold.diff), detail: 'Équipe − adversaires · or', color: colorFor(facts.gold.diff) },
  ];
  panel(ctx, M, metricsY, contentW, metricsH);
  metrics.forEach((metric, index) => {
    const x = M + index * contentW / 4 + 24;
    const w = contentW / 4 - 48;
    if (index) pngLine(ctx, x - 24, metricsY + 20, x - 24, metricsY + metricsH - 20);
    text(ctx, metric.title, x, metricsY + 34, w, 20, P.muted, 600);
    text(ctx, metric.value, x, metricsY + 86, w, 42, metric.color, 700);
    text(ctx, metric.detail, x, metricsY + 122, w, 20, P.muted);
  });
  panel(ctx, M, objectivesY, contentW, objectivesH);
  const objectiveFields = [['Dragons', 'dragons'], ['Grubs', 'grubs'], ['Hérauts', 'heralds'], ['Nashors', 'barons'], ['Tours', 'towers']];
  sides.forEach((side, index) => {
    const x = M + 24 + index * (innerW / 2 + 20);
    const accent = side.side === 'blue' ? P.blue : side.side === 'red' ? P.red : P.muted;
    paragraph(ctx, side.objectiveTitle, x, objectivesY + 37, objectiveColumnW, 24, P.text, 700, 31);
    const yy = objectivesY + 45 + Math.max(...sides.map((entry) => entry.objectiveTitle.length)) * 31;
    text(ctx, `${sideLabel(side.side)} · ${side.key === 'ALLY' ? 'Notre équipe' : 'Adversaires'}`, x, yy, objectiveColumnW, 20, accent, 600);
    objectiveFields.forEach(([label, key], fieldIndex) => {
      const xx = x + fieldIndex * objectiveColumnW / 5;
      text(ctx, label, xx, yy + 36, objectiveColumnW / 5 - 8, 20, P.muted);
      text(ctx, pngNumber(facts[key][side.key === 'ALLY' ? 'ally' : 'enemy']), xx, yy + 82, objectiveColumnW / 5 - 8, 36, P.text, 700);
    });
  });
  let teamY = rosterY;
  sides.forEach((side) => {
    panel(ctx, M, teamY, contentW, side.height);
    const accent = side.side === 'blue' ? P.blue : side.side === 'red' ? P.red : P.muted;
    paragraph(ctx, side.titleLines, M + 24, teamY + 40, innerW - 400, 28, P.text, 700, 36);
    text(ctx, `${sideLabel(side.side)} · ${side.key === 'ALLY' ? 'Notre équipe' : 'Adversaires'}`, width - M - 24, teamY + 39, 380, 22, accent, 600, 'right');
    const labelsY = teamY + side.headingH - 24;
    for (const column of columns) {
      const labelLines = lines(ctx, column.label, column.width - 12, 20, 600);
      paragraph(ctx, labelLines, column.x, labelsY - (labelLines.length - 1) * 25, column.width - 12, 20, P.muted, 600, 25);
    }
    let rowY = teamY + side.headingH;
    if (!side.rows.length) text(ctx, 'Participants indisponibles', M + 24, rowY + 40, innerW, 24, P.muted);
    side.rows.forEach(({ row, name, champion, spells, height: rowH }) => {
      pngLine(ctx, M + 24, rowY - 10, width - M - 24, rowY - 10);
      const portrait = asset('champions', row.champion);
      if (portrait) pngImageCover(ctx, portrait, M + 24, rowY + 10, 64, 64, 8);
      else text(ctx, row.role || '—', M + 24, rowY + 42, 70, 22, accent, 700);
      paragraph(ctx, name, M + 104, rowY + 27, 254, 22, P.text, 700, 28);
      paragraph(ctx, champion, M + 104, rowY + 29 + name.length * 28, 254, 20, accent, 600, 26);
      const values = { kda: [row.kills, row.deaths, row.assists].map((value) => pngNumber(value)).join(' / '), cs: pngNumber(row.cs), participation: pngPercent(row.participation), gold: pngNumber(row.gold), damage: pngNumber(row.damage), vision: pngNumber(row.vision) };
      for (const column of columns.slice(1)) text(ctx, values[column.key], column.x, rowY + 38, column.width - 12, column.key === 'kda' ? 28 : 32, P.text, 700);
      paragraph(ctx, spells, columns[1].x, rowY + 77, innerW - 360, 20, P.muted, 500, 26);
      const build = [...(row.items || []), row.trinket].filter((id) => id > 0);
      const images = build.map((id) => asset('items', id));
      const buildY = rowY + 78 + spells.length * 26;
      if (build.length && images.every(Boolean)) {
        text(ctx, 'Build final', columns[1].x, buildY + 6, 140, 20, P.muted);
        images.forEach((image, itemIndex) => pngImageCover(ctx, image, columns[1].x + 148 + itemIndex * 36, buildY - 19, 30, 30, 5));
      } else {
        const known = (row.items || []).filter((id) => id !== null).length === 6 && row.trinket !== null;
        const buildLabel = !known && !build.length ? 'Build final : données indisponibles' : known && !build.length ? 'Build final : aucun objet' : 'Build final : détail disponible dans NXT5';
        text(ctx, buildLabel, columns[1].x, buildY + 4, innerW - 360, 20, P.muted);
      }
      rowY += rowH;
    });
    teamY += side.height + 24;
  });
  y = footerY;
  y += paragraph(ctx, coverageLines, M, y, contentW, 20, P.muted, 500, 28);
  paragraph(ctx, warningLines, M, y, contentW, 20, P.muted, 500, 28);
  pngLine(ctx, M, height - 84, width - M, height - 84);
  text(ctx, 'K / D / A : kills / morts / assists · CS : sbires et monstres · Vision : score', M, height - 48, contentW, 20, P.muted);
  text(ctx, 'Participation : (kills + assists) / kills de l’équipe · — = donnée indisponible', M, height - 18, contentW, 20, P.muted);
  return { canvas, width, height };
}
