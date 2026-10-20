// Renders the two Discord payloads that capture-site.cjs serves, with the repository's own server code:
// - payload-test: GET team-discord-test, from loadDiscordTestPreview (connection-test message + fictitious demo visual);
// - payload-preview: GET team-discord-preview of the tutorial game, from loadDiscordPreview. The game is the enriched
//   fixtures/game-discord.cjs (timeline with combat events), so the visual reads « Timeline détaillée disponible » and
//   carries no « Événements de combat absents / indisponibles » warning (shared/publications/game-publication.js).
// The two loaders are bundled with esbuild and their database module (_lib/db.ts) is replaced by fixture rows: no database,
// no Discord call. Champion and item icons are fetched from Data Dragon as in production (global fetch, HTTPS_PROXY honoured
// with NODE_USE_ENV_PROXY=1); a missing icon is fatal here, whereas the server would silently leave it out.
//
// Usage: SITE_ROOT=<dir with node_modules and public/> node render-payloads.cjs   (normally started by run-site.sh)
// Writes fixtures/payload-{test,preview}.json (message, revision) and fixtures/payload-{test,preview}.png (visual).
const path = require('node:path');
const fs = require('node:fs');
const world = require('./world.cjs');

const REPO = path.resolve(__dirname, '..', '..', '..', '..', '..');
const SITE_ROOT = path.resolve(process.env.SITE_ROOT || REPO);
const FIXTURES = path.join(__dirname, 'fixtures');
const BUNDLE = path.join(__dirname, '.build', 'render-payloads.bundle.cjs');
const LIB = path.join(REPO, 'netlify', 'functions', '_lib');
// Same scanner as the site capture: no price, offer, subscription, trial or « free » wording in what the bot would post.
const FORBIDDEN = /(?<!\p{L})(pass|abonnements?|gratuite?s?|gratuitement|tarifs?|offres?|essais?|découvertes?|prix|premium|payante?s?)(?!\p{L})|€/iu;

async function bundle() {
  const esbuild = require(path.join(SITE_ROOT, 'node_modules', 'esbuild'));
  const fixtureDb = {
    name: 'fixture-db',
    setup(build) {
      build.onResolve({ filter: /^\.\/db$/ }, (args) => (args.importer.startsWith(LIB) ? { path: 'fixture-db', namespace: 'fixture' } : undefined));
      build.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ loader: 'js', contents: 'export const sql = (query, params) => globalThis.__fixtureSql(query, params);' }));
    },
  };
  await esbuild.build({
    stdin: { contents: `export { loadDiscordPreview } from ${JSON.stringify(path.join(LIB, 'discord-preview'))};\nexport { loadDiscordTestPreview } from ${JSON.stringify(path.join(LIB, 'discord-test'))};`,
      resolveDir: LIB, loader: 'ts' },
    bundle: true, platform: 'node', format: 'cjs', target: 'node22', outfile: BUNDLE, logLevel: 'warning',
    nodePaths: [path.join(SITE_ROOT, 'node_modules')], external: ['@napi-rs/canvas', '@neondatabase/serverless'], plugins: [fixtureDb],
  });
}

// Rows the two loaders read. discord-preview.ts selects one row (match + participants, team, route, categories);
// discord-test.ts reads the latest test and the pending ones (none: the capture serves its own receipt).
function fixtureSql(query) {
  if (/from matches m join teams t/.test(query)) {
    const { TEAM, CATEGORIES, ROUTE_ID, GUILD, PUBLISH_CHANNEL } = world;
    return [{ match: world.storedMatch(), team: { id: TEAM.id, name: TEAM.name, owner_id: TEAM.owner_id },
      route: { id: ROUTE_ID, team_id: TEAM.id, guild_id: GUILD.id, channel_id: PUBLISH_CHANNEL.id, category_ids: [], include_hints: false, mention_role_id: null, enabled: true, automatic: true },
      categories: CATEGORIES.map(({ id, name }) => ({ id, name })) }];
  }
  if (/discord_connection_tests/.test(query)) return [];
  throw new Error(`Requête inattendue : ${query.slice(0, 120)}`);
}

(async () => {
  fs.mkdirSync(path.dirname(BUNDLE), { recursive: true });
  await bundle();
  globalThis.__fixtureSql = async (query) => fixtureSql(query);
  // Icons are optional for the server; for the tutorial a visual without its portraits is a broken capture.
  const fetchIcons = globalThis.fetch;
  const failed = [];
  globalThis.fetch = async (url, init) => {
    const response = await fetchIcons(url, init).catch((error) => { failed.push(`${url} (${error.cause?.code || error.message})`); throw error; });
    if (!response.ok) failed.push(`${url} (${response.status})`);
    return response;
  };
  process.env.PUBLIC_SITE_URL = 'https://nxt5.org';
  // The renderer reads public/ and node_modules/@fontsource/inter from the working directory (publication-render.ts).
  process.chdir(SITE_ROOT);
  const { loadDiscordPreview, loadDiscordTestPreview } = require(BUNDLE);

  const test = await loadDiscordTestPreview(world.TEAM.id);
  const preview = await loadDiscordPreview({ teamId: world.TEAM.id, matchId: world.MATCH_ID, routeId: world.ROUTE_ID });
  if (failed.length) throw new Error(`Icônes Data Dragon indisponibles :\n${failed.join('\n')}`);
  const title = preview.message.embeds[0].title;
  if (title !== world.NAMES.publicationTitle) throw new Error(`Titre du message « ${title} » différent de names.json (« ${world.NAMES.publicationTitle} »)`);
  const warnings = preview.snapshot.coverage.warnings;
  if (warnings.length || !preview.snapshot.coverage.timeline.combatEventsAvailable) throw new Error(`Visuel de partie incomplet : ${JSON.stringify({ warnings, timeline: preview.snapshot.coverage.timeline })}`);
  for (const [name, text] of [['test', JSON.stringify(test.message)], ['preview', JSON.stringify([preview.message, preview.snapshot])]]) {
    const hit = FORBIDDEN.exec(text);
    if (hit) throw new Error(`payload-${name} : mot interdit « ${hit[0]} » dans « ${text.slice(Math.max(0, hit.index - 60), hit.index + 60)} »`);
  }

  const testImage = Buffer.from(test.imageDataUrl.replace(/^data:image\/png;base64,/, ''), 'base64');
  fs.writeFileSync(path.join(FIXTURES, 'payload-test.json'), `${JSON.stringify({ message: test.message }, null, 2)}\n`);
  fs.writeFileSync(path.join(FIXTURES, 'payload-test.png'), testImage);
  fs.writeFileSync(path.join(FIXTURES, 'payload-preview.json'), `${JSON.stringify({ message: preview.message, snapshotRevision: preview.snapshotRevision }, null, 2)}\n`);
  fs.writeFileSync(path.join(FIXTURES, 'payload-preview.png'), preview.image.bytes);
  console.log('payload-test', test.message.embeds[0].title, `${testImage.length} octets`);
  console.log('payload-preview', preview.message.embeds[0].title, '·', preview.message.embeds[0].description.replace(/\n/g, ' · '),
    `· ${preview.image.width}×${preview.image.height} · combats ${preview.snapshot.coverage.timeline.label}`);
})().catch((e) => { console.error(e); process.exit(1); });
