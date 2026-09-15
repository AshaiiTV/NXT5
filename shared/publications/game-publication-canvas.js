import { pngFitText, pngWrapText, pngLine, pngPanel, pngImageContain } from '../../src/utils/png-report.js';
import { publicationFormat } from './game-publication.js';

export const PUBLICATION_PNG_WIDTH = 1200;
const P = { bg: '#020611', panel: '#0a1427', border: '#293d52', text: '#f8fafc', muted: '#c6d4e5', cyan: '#67e8f9', blue: '#93c5fd', pink: '#e879f9', green: '#6ee7b7', red: '#fda4af' };
const M = 56;
const FONT = '"NXT5 Export", Arial, sans-serif';
const font = (size, weight = 500) => `${weight} ${size}px ${FONT}`;
const number = (value, signed = false) => value === null || value === undefined ? '—' : publicationFormat(value, signed);
const sideLabel = (side) => side === 'blue' ? 'Côté bleu' : side === 'red' ? 'Côté rouge' : 'Côté inconnu';
const colorFor = (value) => value === null ? P.muted : value < 0 ? P.red : P.green;
function text(ctx, value, x, y, width, size = 28, color = P.text, weight = 500, align = 'left') {
  pngFitText(ctx, value, x, y, width, { font: font(size, weight), min: size, color, align });
}
function lines(ctx, value, width, size = 28, weight = 500, maxLines = Infinity) {
  return pngWrapText(ctx, value, width, { font: font(size, weight), maxLines });
}
function paragraph(ctx, values, x, y, width, size = 28, color = P.text, weight = 500, lineHeight = size * 1.35) {
  for (const [index, line] of values.entries()) text(ctx, line, x, y + index * lineHeight, width, size, color, weight);
  return values.length * lineHeight;
}
function panel(ctx, x, y, width, height) { pngPanel(ctx, x, y, width, height, { fill: P.panel, stroke: P.border, radius: 20 }); }
function dateLabel(value) {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('fr-FR', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Europe/Paris' }).format(date) : 'Date de partie indisponible';
}
/** Same measured layout and drawing operations in the browser and on the worker. */
export async function renderGamePublicationCanvas(snapshot, { createCanvas, loadLogo, includeHints = true }) {
  if (snapshot?.schemaVersion !== 1) throw new Error('Version de publication PNG non prise en charge.');
  const width = PUBLICATION_PNG_WIDTH;
  const contentW = width - M * 2;
  const canvas = createCanvas(width, 1);
  let ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Impossible de créer le contexte du PNG.');
  const titleLines = lines(ctx, `${snapshot.context.teamName} / ${snapshot.context.opponentName}`, contentW, 42, 700);
  const categoryLines = lines(ctx, snapshot.context.categories.map((category) => category.name).join(' · ') || 'Game d’équipe', contentW, 26, 500, 3);
  const summaryLines = includeHints ? lines(ctx, snapshot.reviewHints[0]?.observation || 'Aucune lecture disponible.', contentW - 48, 28, 500) : [];
  const actionLines = includeHints ? lines(ctx, snapshot.reviewHints[0]?.action || 'Ouvrir la game pour consulter les données.', contentW - 48, 28, 500) : [];
  const headerH = 268 + titleLines.length * 54 + categoryLines.length * 35;
  const metricsY = headerH;
  const metricsH = 280;
  const analysisY = metricsY + metricsH + 28;
  const analysisH = includeHints ? 125 + (summaryLines.length + actionLines.length) * 38 : 0;
  const rosterY = includeHints ? analysisY + analysisH + 36 : metricsY + metricsH + 36;
  const sides = [
    { key: 'ALLY', title: snapshot.context.teamName, side: snapshot.context.allySide },
    { key: 'ENEMY', title: snapshot.context.opponentName, side: snapshot.context.enemySide },
  ].sort((a, b) => (a.side === 'blue' ? 0 : a.side === 'red' ? 1 : 2) - (b.side === 'blue' ? 0 : b.side === 'red' ? 1 : 2));
  const columnW = (contentW - 24) / 2;
  for (const side of sides) {
    side.titleLines = lines(ctx, side.title, columnW - 40, 28, 700);
    side.rows = snapshot.participants.filter((row) => row.teamKey === side.key).map((row) => ({ row, nameLines: lines(ctx, row.name, columnW - 40, 28, 600) }));
    side.headingH = 78 + side.titleLines.length * 36;
    side.height = side.headingH + side.rows.reduce((sum, row) => sum + 88 + row.nameLines.length * 36, 0) + 24;
  }
  const rosterH = Math.max(160, ...sides.map((side) => side.height));
  const coverageLines = lines(ctx, `${snapshot.coverage.timeline.label}. ${snapshot.coverage.timeline.detail}.`, contentW, 25, 500);
  const warningLines = lines(ctx, snapshot.coverage.warnings.join(' '), contentW, 25, 500);
  const footerY = rosterY + rosterH + 46;
  const height = Math.ceil(footerY + (coverageLines.length + warningLines.length) * 34 + 100);
  canvas.height = height;
  ctx = canvas.getContext('2d');
  ctx.fillStyle = P.bg;
  ctx.fillRect(0, 0, width, height);
  const gradient = ctx.createLinearGradient(0, 0, width, 0);
  gradient.addColorStop(0, P.cyan); gradient.addColorStop(0.55, P.blue); gradient.addColorStop(1, P.pink);
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, 5);
  const logo = await loadLogo?.();
  if (logo) pngImageContain(ctx, logo, width - M - 220, 34, 220, 70);
  // Do not redraw the wordmark when its asset is absent.
  text(ctx, 'FICHE GAME', M, 79, contentW - 260, 26, P.cyan, 600);
  let y = 150;
  y += paragraph(ctx, titleLines, M, y, contentW, 42, P.text, 700, 54);
  y += paragraph(ctx, categoryLines, M, y + 2, contentW, 26, P.muted, 500, 35);
  text(ctx, snapshot.context.result, M, y + 29, contentW / 2, 38, snapshot.context.result === 'Victoire' ? P.green : snapshot.context.result === 'Défaite' ? P.red : P.muted, 700);
  text(ctx, `${snapshot.context.duration || 'Durée indisponible'}${snapshot.context.duration ? ' min' : ''}`, width - M, y + 29, contentW / 2, 32, P.text, 600, 'right');
  text(ctx, dateLabel(snapshot.playedAt), M, y + 74, contentW, 25, P.muted);
  const facts = snapshot.facts;
  const metrics = [
    { title: 'Kills', value: `${number(facts.kills.ally)} – ${number(facts.kills.enemy)}`, detail: 'Notre équipe / adversaire', color: P.cyan },
    { title: 'Écart d’or final', value: number(facts.gold.diff, true), detail: 'Notre équipe − adversaire · or', color: colorFor(facts.gold.diff) },
    { title: 'Dragons', value: `${number(facts.dragons.ally)} – ${number(facts.dragons.enemy)}`, detail: 'Notre équipe / adversaire', color: P.blue },
    { title: 'Écart de vision', value: number(facts.vision.diff, true), detail: 'Score de vision final', color: colorFor(facts.vision.diff) },
  ];
  metrics.forEach((metric, index) => {
    const x = M + (index % 2) * (columnW + 24);
    const yy = metricsY + Math.floor(index / 2) * 144;
    panel(ctx, x, yy, columnW, 132);
    text(ctx, metric.title, x + 24, yy + 36, columnW - 48, 26, P.muted, 600);
    text(ctx, metric.value, x + 24, yy + 83, columnW - 48, 40, metric.color, 700);
    text(ctx, metric.detail, x + 24, yy + 114, columnW - 48, 23, P.muted);
  });
  if (includeHints) {
    panel(ctx, M, analysisY, contentW, analysisH);
    text(ctx, 'Lecture NXT5', M + 24, analysisY + 42, contentW - 48, 30, P.cyan, 700);
    y = analysisY + 82;
    y += paragraph(ctx, summaryLines, M + 24, y, contentW - 48, 28, P.text, 500, 38);
    text(ctx, 'Piste de review', M + 24, y + 22, contentW - 48, 27, P.pink, 600);
    paragraph(ctx, actionLines, M + 24, y + 63, contentW - 48, 28, P.text, 500, 38);
  }
  sides.forEach((side, index) => {
    const x = M + index * (columnW + 24);
    panel(ctx, x, rosterY, columnW, rosterH);
    const accent = side.side === 'blue' ? P.blue : side.side === 'red' ? P.red : P.muted;
    text(ctx, `${sideLabel(side.side)} · ${side.key === 'ALLY' ? 'Notre équipe' : 'Adversaire'}`, x + 20, rosterY + 40, columnW - 40, 23, accent, 600);
    paragraph(ctx, side.titleLines, x + 20, rosterY + 80, columnW - 40, 28, P.text, 700, 36);
    let rowY = rosterY + side.headingH;
    if (!side.rows.length) text(ctx, 'Participants indisponibles', x + 20, rowY + 20, columnW - 40, 27, P.muted);
    side.rows.forEach(({ row, nameLines }) => {
      pngLine(ctx, x + 20, rowY, x + columnW - 20, rowY, P.border);
      text(ctx, `${row.role || 'Rôle inconnu'} · ${row.champion || 'Champion inconnu'}`, x + 20, rowY + 34, columnW - 40, 25, accent, 600);
      paragraph(ctx, nameLines, x + 20, rowY + 73, columnW - 40, 28, P.text, 600, 36);
      const statsY = rowY + 76 + nameLines.length * 36;
      text(ctx, `${number(row.kills)}/${number(row.deaths)}/${number(row.assists)} KDA`, x + 20, statsY, (columnW - 40) / 2, 25, P.text);
      text(ctx, `${number(row.gold)} or`, x + columnW - 20, statsY, (columnW - 40) / 2, 25, P.muted, 500, 'right');
      rowY += 88 + nameLines.length * 36;
    });
  });
  y = footerY;
  y += paragraph(ctx, coverageLines, M, y, contentW, 25, P.muted, 500, 34);
  y += paragraph(ctx, warningLines, M, y, contentW, 25, P.muted, 500, 34);
  pngLine(ctx, M, height - 66, width - M, height - 66, P.border);
  text(ctx, '— = donnée indisponible', M, height - 30, contentW / 2, 24, P.muted);
  text(ctx, 'Statistiques de game · NXT5', width - M, height - 30, contentW / 2, 24, P.muted, 500, 'right');
  return { canvas, width, height };
}
