// Run from an environment containing the bot secrets. Never prints a token.
import { nxtDiscordCommand } from '../shared/discord-command.js';
const applicationId = process.env.DISCORD_APPLICATION_ID || '';
const token = process.env.DISCORD_BOT_TOKEN || '';
const guildArg = process.argv.find((value) => value.startsWith('--guild='));
const guildId = guildArg?.slice('--guild='.length);
const global = process.argv.includes('--global');
if (!/^\d{17,20}$/.test(applicationId) || !token || (!global && !/^\d{17,20}$/.test(guildId || '')) || (global && guildArg)) {
  console.error('Configure DISCORD_APPLICATION_ID et DISCORD_BOT_TOKEN, puis précise --guild=IDENTIFIANT pour le pilote ou --global.');
  process.exit(1);
}
const body = nxtDiscordCommand();
const url = 'https://discord.com/api/v10/applications/' + applicationId + (global ? '' : '/guilds/' + guildId) + '/commands';
try {
  const response = await fetch(url, { method: 'POST', headers: { Authorization: 'Bot ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(body), redirect: 'error', signal: AbortSignal.timeout(15_000) });
  if (!response.ok) {
    console.error('Enregistrement refusé par Discord (HTTP ' + response.status + '). Vérifie les identifiants, permissions et limites.');
    process.exitCode = 1;
  } else {
    console.log('Commande /nxt enregistrée' + (global ? ' (globale).' : ' (serveur pilote).'));
  }
} catch {
  console.error('Discord est injoignable. Aucune confirmation d’enregistrement reçue.');
  process.exitCode = 1;
}
