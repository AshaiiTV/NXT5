// The fictitious world of the Discord tutorial captures, shared by render-payloads.cjs (payloads rendered with the server
// code) and capture-site.cjs (intercepted API). Every name that must match the owner's real Discord captures comes from
// names.json (overwritten by sync-names.cjs once public/tuto-discord/real/manifest.json is filled), the game from
// fixtures/game-discord.cjs (the Importer tutorial's game with a full timeline). ownerDiscordName and nxt5AccountName stay
// fictitious: the owner's real ones are masked in the real captures and never written (BRIEF-CAPTURES-DISCORD.md).
//
// The game's name is also its « opponent » column (analytics.ts stores the import label there), which titles the Discord
// message « <team> vs <game> » and labels its delivery: hence the game named « Aurore » in the real session.
//
// Clock: the site runs on a frozen clock. « Valable jusqu’au » of names.json is the link code's expiry as NXT5 prints it
// (fr-FR, Paris time); the code is created 10 minutes before it (team-discord-connection.ts), and every other step of the
// journey is placed around that instant (CLOCK). The game was played on 18 Oct 2026 at 21:05 and imported at 21:48, Paris
// time: the clock must come after the import.
const NAMES = require('./names.json');
const game = require('./fixtures/game-discord.cjs');

const REQUIRED = ['server', 'commandChannel', 'publishChannel', 'ownerDiscordName', 'nxt5AccountName', 'team', 'opponent', 'game', 'publicationTitle', 'botName',
  'linkCommand', 'linkCodeValidUntil'];
const empty = REQUIRED.filter((key) => !String(NAMES[key] || '').trim());
if (empty.length) throw new Error(`names.json : valeurs manquantes ${empty.join(', ')}`);
const LINK_CODE = /^\/nxt connecter code:(\S+)$/.exec(NAMES.linkCommand.trim())?.[1];
if (!LINK_CODE) throw new Error(`names.json : linkCommand inattendu « ${NAMES.linkCommand} » (attendu « /nxt connecter code:… »)`);

/** « 18/10/2026 22:22:37 » (fr-FR toLocaleString, Paris time) → epoch ms. */
function parisTime(text) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(String(text).trim());
  if (!m) throw new Error(`Date inattendue « ${text} » (attendu « JJ/MM/AAAA HH:MM:SS », heure de Paris)`);
  const [, d, mo, y, h, mi, s = '00'] = m;
  const wall = Date.UTC(+y, +mo - 1, +d, +h, +mi, +s);
  // Paris offset at a given instant (CET or CEST), read back through Intl.
  const offset = (t) => {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hourCycle: 'h23', year: 'numeric', month: '2-digit',
      day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(t).map((x) => [x.type, x.value]));
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - t;
  };
  return wall - offset(wall - offset(wall));
}

const MIN = 60000;
const IMPORTED_AT = Date.parse('2026-10-18T19:48:00Z'); // 21:48, Paris time (match created_at)
const CODE_AT = parisTime(NAMES.linkCodeValidUntil) - 10 * MIN;
if (CODE_AT < IMPORTED_AT + 10 * MIN) throw new Error(`names.json : le code (${new Date(CODE_AT).toISOString()}) précède l’import de la partie`);
// Frozen « now » of each step, in the order of the film (invite the bot, /nxt lier, link code…), whatever the capture order.
const CLOCK = {
  arrival: CODE_AT - 9 * MIN, invite: CODE_AT - 8 * MIN, lierRequested: CODE_AT - 6.5 * MIN, lier: CODE_AT - 6 * MIN, code: CODE_AT,
  linked: CODE_AT + 1.5 * MIN, test: CODE_AT + 3.5 * MIN, activation: CODE_AT + 4.5 * MIN, publish: CODE_AT + 6 * MIN, activity: CODE_AT + 7.5 * MIN,
};

// UUID-shaped ids: the server loaders check them (discord-preview.ts), and the preview's game link carries them.
const USER = { id: '3c1e5a7b-2d4f-4b6a-8c9e-0f1a2b3c4d5e', account_name: NAMES.nxt5AccountName, email: 'coach@example.test', email_verified: true,
  name: 'Coach Démo', notif_match: true, notif_report: true, notif_inactivity: true, inactivity_notice: null, is_platform_admin: false, created_at: '2026-01-05T10:00:00Z' };
// Coach Démo is a captain: same rights on the bot as the owner (DiscordWorkspace.jsx), and the sidebar shows « Capitaine »
// instead of the untranslated « Owner » of the owner role (app/helpers.js profileStatusLabel).
const TEAM = { id: '0b6c7d8e-9f10-4a21-b32c-d43e54f65a76', name: NAMES.team, owner_id: '7a8b9c0d-1e2f-4a3b-9c4d-5e6f7a8b9c0d', created_at: '2026-01-05T10:00:00Z' };
const MEMBER = { id: 'b1c2d3e4-f5a6-4b7c-8d9e-0a1b2c3d4e5f', team_id: TEAM.id, user_id: USER.id, role: 'captain', name: USER.name };
const MATCH_ID = '6f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4b';
const CATEGORIES = [{ id: 'cat-scrim', team_id: TEAM.id, name: 'Scrim', color: 'cyan', is_default: true }];
const OPPONENTS = [{ id: 'opp-aurore', team_id: TEAM.id, name: NAMES.opponent }];
const GUILD = { id: '1291847362058123776', name: NAMES.server };
const DISCORD_USER = { id: '1180352947716620288', label: NAMES.ownerDiscordName };
const CHANNELS = [
  { id: '1291847362058123777', name: 'général', canSend: true, canMentionRoles: true },
  { id: '1291847362058123778', name: NAMES.commandChannel, canSend: true, canMentionRoles: true },
  { id: '1291847362058123779', name: 'scrims', canSend: true, canMentionRoles: true },
  { id: '1291847362058123780', name: NAMES.publishChannel, canSend: true, canMentionRoles: true },
];
const COMMAND_CHANNEL = CHANNELS[1];
const PUBLISH_CHANNEL = CHANNELS[3];
const ROUTE_ID = '9b1e4c2a-7d3f-4e8a-9c6b-0d1e2f3a4b5c';
// matches.publication_revision after the import (one enqueue: nxt5_enqueue_discord_match bumps it from 0).
const PUBLICATION_REVISION = 1;

/** The game as stored after the import (matches row + match_participants rows): raw is the whole file, as analytics.ts keeps it. */
function storedMatch() {
  const file = game.buildExportFile();
  const parts = file.match.info.participants;
  return { id: MATCH_ID, team_id: TEAM.id, game_id: game.GAME_ID, opponent: NAMES.game, result: 'Victoire', side: 'blue', duration: '25:00',
    duration_seconds: game.DURATION, game_date: new Date(game.GAME_CREATION).toISOString(), patch: '26.20', category_ids: ['cat-scrim'],
    created_at: new Date(IMPORTED_AT).toISOString(), publication_revision: PUBLICATION_REVISION,
    raw: { ...file.match, timeline: file.timeline, nxt5: file.nxt5, nxt5Label: NAMES.game },
    participants: game.participantsRows(MATCH_ID, TEAM.id).map((row, i) => ({ ...row, raw: parts[i] })) };
}

module.exports = { NAMES, LINK_CODE, CLOCK, MIN, IMPORTED_AT, parisTime, game, USER, TEAM, MEMBER, MATCH_ID, CATEGORIES, OPPONENTS, GUILD, DISCORD_USER,
  CHANNELS, COMMAND_CHANNEL, PUBLISH_CHANNEL, ROUTE_ID, PUBLICATION_REVISION, storedMatch };
