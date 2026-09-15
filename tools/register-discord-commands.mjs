// Run from an environment containing the bot secrets. Never prints a token.
const applicationId = process.env.DISCORD_APPLICATION_ID || '';
const token = process.env.DISCORD_BOT_TOKEN || '';
const guildArg = process.argv.find((value) => value.startsWith('--guild='));
const guildId = guildArg?.slice('--guild='.length);
const global = process.argv.includes('--global');
if (!/^\d{17,20}$/.test(applicationId) || !token || (!global && !/^\d{17,20}$/.test(guildId || '')) || (global && guildArg)) {
  console.error('Configure DISCORD_APPLICATION_ID et DISCORD_BOT_TOKEN, puis précise --guild=IDENTIFIANT pour le pilote ou --global.');
  process.exit(1);
}
const body = [{
  name: 'nxt', description: 'Relier et gérer les publications NXT5 de ce serveur.',
  default_member_permissions: '32', contexts: [0], integration_types: [0],
  options: [
    { type: 1, name: 'connecter', description: 'Relier le serveur à une équipe NXT5.', options: [{ type: 3, name: 'code', description: 'Code temporaire fourni par NXT5.', required: true, min_length: 16, max_length: 24 }] },
    { type: 1, name: 'statut', description: 'Afficher l’état de la connexion.' },
    { type: 1, name: 'pause', description: 'Suspendre les publications.' },
    { type: 1, name: 'reprendre', description: 'Reprendre les publications configurées.' },
    { type: 1, name: 'aide', description: 'Comprendre le fonctionnement du bot.' },
  ],
}];
const url = 'https://discord.com/api/v10/applications/' + applicationId + (global ? '' : '/guilds/' + guildId) + '/commands';
try {
  const response = await fetch(url, { method: 'PUT', headers: { Authorization: 'Bot ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(body), redirect: 'error', signal: AbortSignal.timeout(15_000) });
  if (!response.ok) {
    console.error('Enregistrement refusé par Discord (HTTP ' + response.status + '). Vérifie les identifiants, permissions et limites.');
    process.exitCode = 1;
  } else {
    const result = await response.json();
    console.log('Commandes NXT5 enregistrées : ' + result.map((command) => command.name).join(', ') + (global ? ' (global).' : ' (serveur pilote).'));
  }
} catch {
  console.error('Discord est injoignable. Aucune confirmation d’enregistrement reçue.');
  process.exitCode = 1;
}
