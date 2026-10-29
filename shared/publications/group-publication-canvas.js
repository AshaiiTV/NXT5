import { PNG_THEME as P, pngBackground, pngFitText, pngWrapText, pngLine, pngPanel, pngImageContain, pngNumber, pngPercent } from '../../src/utils/png-report.js';

export const GROUP_PUBLICATION_PNG_WIDTH = 960;
// Bound server memory before allocating a full canvas. The caller can explicitly offer a text fallback.
export const GROUP_PUBLICATION_PNG_MAX_HEIGHT = 16000;
const M = 36;
const font = (size, weight = 500) => `${weight} ${size}px "NXT5 Export", Arial, sans-serif`;
const wrap = (ctx, value, width, size, weight = 500) => pngWrapText(ctx, value, width, { font: font(size, weight) });
function text(ctx, value, x, y, width, size = 24, color = P.text, weight = 500, align = 'left') {
  pngFitText(ctx, value, x, y, width, { font: font(size, weight), min: size, color, align });
}
function paragraph(ctx, lines, x, y, width, size, color = P.text, weight = 500) {
  lines.forEach((line, index) => text(ctx, line, x, y + index * (size + 8), width, size, color, weight));
  return lines.length * (size + 8);
}
function dateLabel(value) {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Paris' }).format(date) : 'Date inconnue';
}
function tooLarge() {
  return Object.assign(new Error('Le groupe est trop volumineux pour un seul PNG Discord. Aucune game n’a été omise ; utilise la publication texte proposée.'), { code: 'GROUP_PNG_TOO_LARGE' });
}

/** One complete, factual PNG; never silently drops games to fit an attachment. */
export async function renderGroupPublicationCanvas(snapshot, { createCanvas, loadLogo }) {
  if (snapshot?.schemaVersion !== 1 || snapshot.kind !== 'group' || !Array.isArray(snapshot.games)) throw new Error('Version de publication de groupe PNG non prise en charge.');
  if (snapshot.games.length > 120) throw tooLarge();
  const width = GROUP_PUBLICATION_PNG_WIDTH;
  const contentW = width - M * 2;
  const canvas = createCanvas(width, 1);
  let ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Impossible de créer le contexte du PNG.');
  const { context, facts } = snapshot;
  const title = wrap(ctx, context.groupName, contentW, 38, 700);
  const team = wrap(ctx, context.teamName, contentW, 28, 600);
  const description = context.description ? wrap(ctx, context.description, contentW, 23) : [];
  const firstDate = dateLabel(facts.periodStart);
  const lastDate = dateLabel(facts.periodEnd);
  const periodLabel = facts.datedGames ? `Période de jeu : ${firstDate}${lastDate === firstDate ? '' : ` – ${lastDate}`}` : 'Période de jeu : —';
  const period = wrap(ctx, periodLabel + (facts.datedGames < facts.games ? ` · ${facts.datedGames}/${facts.games} games datées` : ''), contentW, 23);
  const summaryY = 118 + title.length * 46 + team.length * 36 + description.length * 31 + period.length * 31 + (description.length ? 12 : 0);
  const gamesY = summaryY + 210;
  const rows = snapshot.games.map((game, index) => {
    const opponent = wrap(ctx, `vs ${game.context.opponentName}`, contentW - 48, 28, 600);
    const metadata = wrap(ctx, `${dateLabel(game.playedAt)} · ${game.context.duration ? `${game.context.duration} min` : 'Durée : —'}`, contentW - 350, 23);
    return { game, index, opponent, metadata, height: 86 + opponent.length * 36 + metadata.length * 31 + 20 };
  });
  const rowsHeight = rows.reduce((total, row) => total + row.height, 0) || 90;
  const footer = wrap(ctx, 'Kills : notre équipe / adversaires · — : indisponible\nTotaux de kills calculés uniquement avec les cinq joueurs renseignés.', contentW, 21);
  const footerY = gamesY + rowsHeight + 40;
  const height = Math.ceil(footerY + footer.length * 29 + 28);
  if (height > GROUP_PUBLICATION_PNG_MAX_HEIGHT) throw tooLarge();
  canvas.height = height;
  ctx = canvas.getContext('2d');
  pngBackground(ctx, width, height, { variant: 'group' });
  const logo = await loadLogo?.();
  if (logo) pngImageContain(ctx, logo, width - M - 146, 24, 146, 48);
  text(ctx, 'GROUPE DE PARTIES', M, 58, contentW - 180, 24, P.purple, 600);
  let y = 118;
  y += paragraph(ctx, title, M, y, contentW, 38, P.text, 700);
  y += paragraph(ctx, team, M, y, contentW, 28, P.purple, 600);
  if (description.length) y += paragraph(ctx, description, M, y + 4, contentW, 23, P.muted) + 12;
  paragraph(ctx, period, M, y + 4, contentW, 23, P.muted);

  pngPanel(ctx, M, summaryY, contentW, 146, { radius: 24 });
  const metrics = [
    { label: 'Games', value: pngNumber(facts.games), detail: 'dans ce groupe' },
    { label: 'Bilan · victoires / défaites', value: `${facts.wins} V / ${facts.losses} D`, detail: `${facts.unknown} résultat${facts.unknown === 1 ? '' : 's'} inconnu${facts.unknown === 1 ? '' : 's'}` },
    { label: 'Taux de victoire', value: pngPercent(facts.winRate), detail: `sur ${facts.knownResults} résultat${facts.knownResults === 1 ? '' : 's'} connu${facts.knownResults === 1 ? '' : 's'}` },
  ];
  const widths = [208, 344, 336];
  let x = M;
  metrics.forEach((metric, index) => {
    const columnW = widths[index];
    if (index) pngLine(ctx, x, summaryY + 22, x, summaryY + 124);
    text(ctx, metric.label, x + 18, summaryY + 34, columnW - 36, 21, P.muted);
    text(ctx, metric.value, x + 18, summaryY + 88, columnW - 36, index ? 40 : 48, index === 2 ? P.cyan : P.text, 700);
    text(ctx, metric.detail, x + 18, summaryY + 123, columnW - 36, 20, P.muted);
    x += columnW;
  });
  text(ctx, 'LES PARTIES DU GROUPE', M, summaryY + 190, contentW, 22, P.purple, 600);
  let rowY = gamesY;
  if (!rows.length) text(ctx, 'Aucune game dans ce groupe.', M, rowY + 42, contentW, 28, P.muted);
  rows.forEach(({ game, index, opponent, metadata, height: rowHeight }) => {
    pngPanel(ctx, M, rowY, contentW, rowHeight - 12, { radius: 20 });
    text(ctx, `Partie ${index + 1}`, M + 24, rowY + 36, 200, 23, P.purple, 600);
    const resultColor = game.context.result === 'Victoire' ? P.green : game.context.result === 'Défaite' ? P.red : P.muted;
    text(ctx, game.context.result, width - M - 24, rowY + 36, contentW - 258, 26, resultColor, 700, 'right');
    paragraph(ctx, opponent, M + 24, rowY + 78, contentW - 48, 28, P.text, 600);
    const metadataY = rowY + 86 + opponent.length * 36;
    paragraph(ctx, metadata, M + 24, metadataY, contentW - 350, 23, P.muted);
    text(ctx, `Kills : ${pngNumber(game.facts.kills.ally)} / ${pngNumber(game.facts.kills.enemy)}`, width - M - 24, metadataY, 278, 28, P.text, 600, 'right');
    rowY += rowHeight;
  });
  pngLine(ctx, M, rowY + 10, width - M, rowY + 10);
  paragraph(ctx, footer, M, footerY, contentW, 21, P.muted);
  return { canvas, width, height };
}
