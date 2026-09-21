// Shared by the operator endpoint and the explicit command-registration tool.
export const DISCORD_INSTALL_PERMISSIONS = '117760';
export const DISCORD_INSTALL_SCOPES = ['bot', 'applications.commands'];

export function nxtDiscordCommand() {
  return {
    type: 1, name: 'nxt', description: 'Relier et gérer les publications NXT5 de ce serveur.',
    default_member_permissions: '32', contexts: [0], integration_types: [0],
    options: [
      { type: 1, name: 'connecter', description: 'Relier le serveur à une équipe NXT5.', options: [{ type: 3, name: 'code', description: 'Code temporaire fourni par NXT5.', required: true, min_length: 16, max_length: 24 }] },
      { type: 1, name: 'statut', description: 'Afficher l’état de la connexion.' },
      { type: 1, name: 'pause', description: 'Suspendre les publications.' },
      { type: 1, name: 'reprendre', description: 'Reprendre les publications configurées.' },
      { type: 1, name: 'aide', description: 'Comprendre le fonctionnement du bot.' },
    ],
  };
}
