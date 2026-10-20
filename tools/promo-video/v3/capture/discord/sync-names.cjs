// Copies the names of the owner's real Discord captures into names.json, the single source of every name the site captures
// must share with them (server, channels, team and game, publication title, link code and its « Valable jusqu’au », bot).
// The owner's Discord name and NXT5 account name are never read: they stay fictitious in names.json (masked for real).
// Source: public/tuto-discord/real/manifest.json (BRIEF-CAPTURES-DISCORD.md), field `names`. Empty values keep the current
// ones; nothing happens while the manifest does not exist. run-site.sh calls it before every capture.
//
// Usage: node sync-names.cjs [manifest.json]
const path = require('node:path');
const fs = require('node:fs');

const V3 = path.resolve(__dirname, '..', '..');
const MANIFEST = path.resolve(process.argv[2] || path.join(V3, 'public', 'tuto-discord', 'real', 'manifest.json'));
const NAMES = path.join(__dirname, 'names.json');
const KEYS = ['server', 'category', 'commandChannel', 'publishChannel', 'team', 'opponent', 'game', 'publicationTitle', 'botName', 'botAvatar',
  'linkCommand', 'linkCodeValidUntil'];

if (!fs.existsSync(MANIFEST)) {
  console.log(`names.json inchangé : pas de manifeste (${path.relative(V3, MANIFEST)}).`);
  process.exit(0);
}
const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
const original = fs.readFileSync(NAMES, 'utf8');
const current = JSON.parse(original);
const next = { ...current };
const changes = [];
for (const key of KEYS) {
  const value = String(manifest.names?.[key] ?? '').trim();
  // The template ships « /nxt connecter code: » without a code: not a value yet.
  if (!value || (key === 'linkCommand' && /code:$/.test(value))) continue;
  if (value !== current[key]) changes.push(`${key} : « ${current[key]} » → « ${value} »`);
  next[key] = value;
}
if (!changes.length) {
  console.log('names.json déjà aligné sur le manifeste.');
  process.exit(0);
}
next.source = `Manifeste des captures Discord réelles (${path.relative(V3, MANIFEST)}${manifest.capturedAt ? `, ${manifest.capturedAt}` : ''}).`;
fs.writeFileSync(NAMES, `${JSON.stringify(next, null, 2)}\n`);
// world.cjs validates the result (link command shape, date format, clock after the game import): on error, keep the
// previous names and stop here rather than mid-capture.
try { require('./world.cjs'); } catch (error) {
  fs.writeFileSync(NAMES, original);
  console.error(`Manifeste refusé, names.json conservé : ${error.message}`);
  process.exit(1);
}
console.log(`names.json mis à jour depuis le manifeste :\n  ${changes.join('\n  ')}`);
