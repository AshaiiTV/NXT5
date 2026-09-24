import { PNG_THEME as P, pngBackground, pngFitText, pngWrapText, pngLine, pngPanel, pngImageContain, pngNumber, pngPercent } from '../../src/utils/png-report.js';

export const DISCORD_PUBLICATION_PNG_WIDTH = 960;
const M = 36;
const FONT = '"NXT5 Export", Arial, sans-serif';
const font = (size, weight = 500) => `${weight} ${size}px ${FONT}`;
const known = (value) => typeof value === 'number' && Number.isFinite(value);
const tone = (value) => !known(value) || value === 0 ? P.muted : value > 0 ? P.green : P.red;
const signed = (value) => known(value) ? `${value > 0 ? '+' : ''}${pngNumber(value)}` : '—';
const sideName = (side) => side === 'blue' ? 'Côté bleu' : side === 'red' ? 'Côté rouge' : 'Côté inconnu';
function text(ctx, value, x, y, width, size = 28, color = P.text, weight = 500, align = 'left') {
  pngFitText(ctx, value, x, y, width, { font: font(size, weight), min: size, color, align });
}
const wrap = (ctx, value, width, size, weight = 500) => pngWrapText(ctx, value, width, { font: font(size, weight) });
function paragraph(ctx, lines, x, y, width, size, color = P.text, weight = 500) {
  lines.forEach((line, i) => text(ctx, line, x, y + i * (size + 8), width, size, color, weight));
  return lines.length * (size + 8);
}
function dateLabel(value) {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Paris' }).format(date) : 'Date inconnue';
}

/** A channel-sized summary, sharing the full export's facts, fonts and drawing primitives. */
export async function renderDiscordPublicationCanvas(snapshot, { createCanvas, loadLogo }) {
  if (snapshot?.schemaVersion !== 1) throw new Error('Version de publication PNG non prise en charge.');
  const width = DISCORD_PUBLICATION_PNG_WIDTH;
  const contentW = width - M * 2;
  const canvas = createCanvas(width, 1);
  let ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Impossible de créer le contexte du PNG.');
  const { context, facts } = snapshot;
  const title = wrap(ctx, context.teamName, contentW, 38, 700);
  const opponent = wrap(ctx, `vs ${context.opponentName}`, contentW, 30);
  // Categories and administrative IDs remain in NXT5; keep only the first two labels here.
  const categories = context.categories.slice(0, 2).map((category) => category.name).join(' · ');
  const categoryLines = categories ? wrap(ctx, categories + (context.categories.length > 2 ? ` · +${context.categories.length - 2}` : ''), contentW, 24) : [];
  const metadata = wrap(ctx, [dateLabel(snapshot.playedAt), context.duration ? `${context.duration} min` : 'Durée inconnue', context.patch ? `Patch ${context.patch}` : null].filter(Boolean).join(' · '), contentW, 24);
  const heroY = 198 + title.length * 46 + opponent.length * 38 + categoryLines.length * 32 + metadata.length * 32;
  const objectivesY = heroY + 138;
  const rosterY = objectivesY + 140;
  const rows = snapshot.participants.filter((row) => row.teamKey === 'ALLY').map((row) => {
    const narrowName = wrap(ctx, row.name, 246, 26, 600);
    // A long identity gets the full row above its numbers, rather than a tall,
    // narrow stack that makes the entire Discord attachment difficult to scan.
    const wideName = narrowName.length > 2;
    const name = wideName ? wrap(ctx, row.name, contentW - 78, 26, 600) : narrowName;
    const champion = wrap(ctx, row.champion || 'Champion inconnu', 246, 24);
    return { row, name, champion, wideName, height: Math.max(90, name.length * 34 + champion.length * 32 + 22) };
  });
  const rowsH = rows.length ? rows.reduce((sum, row) => sum + row.height, 0) : 82;
  const warning = snapshot.coverage.participants.ally !== 5 || snapshot.coverage.participants.enemy !== 5
    ? 'Données partielles · totaux incomplets non affichés'
    : snapshot.coverage.warnings.some((value) => /dupliqués|incohérents/.test(value)) ? 'Données incohérentes · comparaisons indisponibles' : null;
  const footnote = wrap(ctx, [warning, 'K/D/A : kills / morts / assists · Dégâts aux champions', 'Part. : participation aux kills · — : indisponible'].filter(Boolean).join('\n'), contentW, 22);
  const footerY = rosterY + 88 + rowsH + 28;
  const height = Math.ceil(footerY + footnote.length * 30 + 34);
  canvas.height = height;
  ctx = canvas.getContext('2d');
  pngBackground(ctx, width, height);
  const logo = await loadLogo?.();
  if (logo) pngImageContain(ctx, logo, width - M - 146, 24, 146, 48);
  text(ctx, 'RÉSUMÉ DE GAME', M, 58, contentW - 180, 24, P.cyan, 600);
  const resultColor = context.result === 'Victoire' ? P.green : context.result === 'Défaite' ? P.red : P.muted;
  text(ctx, context.result, M, 123, contentW - 220, 42, resultColor, 700);
  text(ctx, sideName(context.allySide), width - M, 121, 220, 24, context.allySide === 'blue' ? P.blue : context.allySide === 'red' ? P.red : P.muted, 500, 'right');
  let y = 178;
  y += paragraph(ctx, title, M, y, contentW, 38, P.text, 700);
  y += paragraph(ctx, opponent, M, y, contentW, 30, P.muted);
  y += paragraph(ctx, categoryLines, M, y + 4, contentW, 24, P.purple);
  paragraph(ctx, metadata, M, y + 6, contentW, 24, P.muted);

  // All comparisons explicitly use our team / opponents, independent of map side.
  pngPanel(ctx, M, heroY, contentW, 120, { fill: '#091322', stroke: P.border, radius: 16 });
  const middle = width / 2;
  pngLine(ctx, middle, heroY + 20, middle, heroY + 100);
  text(ctx, 'Kills · nous / adversaires', M + 22, heroY + 34, contentW / 2 - 44, 24, P.muted);
  const scoreSeparator = known(facts.kills.ally) && known(facts.kills.enemy) ? ' — ' : ' / ';
  text(ctx, [facts.kills.ally, facts.kills.enemy].map((value) => pngNumber(value)).join(scoreSeparator), M + 22, heroY + 94, contentW / 2 - 44, 50, P.text, 700);
  text(ctx, 'Écart d’or final · pour nous', middle + 24, heroY + 34, contentW / 2 - 48, 24, P.muted);
  text(ctx, signed(facts.gold.diff), middle + 24, heroY + 94, contentW / 2 - 48, 50, tone(facts.gold.diff), 700);

  text(ctx, 'OBJECTIFS · NOUS / ADVERSAIRES', M, objectivesY + 26, contentW, 22, P.muted, 600);
  [['Tours', 'towers'], ['Dragons', 'dragons'], ['Nashors', 'barons']].forEach(([label, key], index) => {
    const columnW = contentW / 3;
    const x = M + columnW * index;
    text(ctx, label, x, objectivesY + 64, columnW - 20, 26, P.muted);
    text(ctx, `${pngNumber(facts[key]?.ally)} / ${pngNumber(facts[key]?.enemy)}`, x, objectivesY + 105, columnW - 20, 36, P.text, 600);
  });
  pngLine(ctx, M, rosterY, width - M, rosterY);
  text(ctx, 'NOTRE ÉQUIPE', M, rosterY + 36, 382, 24, P.cyan, 600);
  const columns = [
    { x: 550, width: 172, title: 'K / D / A' },
    { x: 744, width: 174, title: 'Dégâts' },
    { x: 924, width: 156, title: 'Part. kills' },
  ];
  columns.forEach((column) => text(ctx, column.title, column.x, rosterY + 73, column.width, 24, P.muted, 500, 'right'));
  text(ctx, 'Joueur · champion', M, rosterY + 73, 320, 24, P.muted);
  let rowY = rosterY + 88;
  if (!rows.length) text(ctx, 'Participants indisponibles', M, rowY + 44, contentW, 28, P.muted);
  rows.forEach(({ row, name, champion, wideName, height: rowH }) => {
    pngLine(ctx, M, rowY, width - M, rowY, '#1a2b40');
    const cy = wideName ? rowY + 32 + name.length * 34 : rowY + rowH / 2 + 9;
    text(ctx, row.role || '—', M, cy, 68, 22, P.cyan, 600);
    paragraph(ctx, name, M + 78, rowY + 32, wideName ? contentW - 78 : 246, 26, P.text, 600);
    paragraph(ctx, champion, M + 78, rowY + 32 + name.length * 34, 246, 24, P.muted);
    text(ctx, [row.kills, row.deaths, row.assists].map((value) => pngNumber(value)).join(' / '), columns[0].x, cy, columns[0].width, 28, P.text, 600, 'right');
    text(ctx, pngNumber(row.damage), columns[1].x, cy, columns[1].width, 30, P.text, 600, 'right');
    text(ctx, pngPercent(row.participation), columns[2].x, cy, columns[2].width, 30, P.text, 600, 'right');
    rowY += rowH;
  });
  pngLine(ctx, M, rowY, width - M, rowY);
  paragraph(ctx, footnote, M, footerY, contentW, 22, P.muted);
  return { canvas, width, height };
}
