// Authenticate the operator while the bot token remains inside Netlify Functions.
import { createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';

async function main() {
  const { values } = parseArgs({ options: {
    origin: { type: 'string' }, action: { type: 'string' }, application: { type: 'string' },
    'key-file': { type: 'string' }, help: { type: 'boolean' },
  } });
  if (values.help) {
    console.log('node tools/configure-discord.mjs --origin=https://INSTANCE --action=inspect|configure --application=ID --key-file=CHEMIN_PRIVE');
    console.log('La clé opérateur est DISCORD_WORKER_SECRET. Le jeton du bot reste dans Netlify.');
    return;
  }
  let origin;
  try { origin = new URL(values.origin); } catch { throw new Error('Précise une origine HTTPS avec --origin.'); }
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) {
    throw new Error('L’origine doit être une URL HTTPS sans chemin, identifiants, paramètres ni fragment.');
  }
  if (!['inspect', 'configure'].includes(values.action) || !/^\d{17,20}$/.test(values.application || '')) {
    throw new Error('Précise --action=inspect ou --action=configure et --application=IDENTIFIANT.');
  }
  let key;
  try { key = (values['key-file'] ? await readFile(values['key-file'], 'utf8') : process.env.DISCORD_WORKER_SECRET || '').trim(); }
  catch { throw new Error('Le fichier privé de clé opérateur ne peut pas être lu.'); }
  if (key.length < 32) throw new Error('Fournis la clé opérateur privée via --key-file ou DISCORD_WORKER_SECRET.');
  const body = JSON.stringify({ action: values.action, expectedApplicationId: values.application });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac('sha256', key).update(timestamp + '.' + body).digest('hex');
  let response;
  try {
    response = await fetch(new URL('/.netlify/functions/discord-setup', origin), {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(55_000),
      headers: { 'Content-Type': 'application/json', 'x-nxt5-discord-timestamp': timestamp, 'x-nxt5-discord-signature': signature }, body,
    });
  } catch { throw new Error('Réponse du serveur non confirmée. Relance une inspection avant de poursuivre.'); }
  let result;
  try { result = await response.json(); } catch { throw new Error('Le serveur ne renvoie pas une réponse de configuration JSON.'); }
  if (!response.ok) {
    const code = typeof result?.code === 'string' && /^[A-Z0-9_]{1,100}$/.test(result.code) ? result.code : 'DISCORD_SETUP_FAILED';
    throw new Error(`Configuration refusée : HTTP ${response.status}, ${code}.`);
  }
  // The authenticated endpoint deliberately returns public metadata and checks only.
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
