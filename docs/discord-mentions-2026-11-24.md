# Bot Discord : mentions limitées aux rôles mentionnables (24/11/2026)

## Décision

Le bot garde la permission **Administrateur** (choix confirmé le 24/11/2026). Cette permission lui permet de mentionner n'importe quel rôle, même ceux que le serveur n'autorise pas à mentionner (par exemple un rôle d'administration). NXT5 se limite donc lui-même.

## Changements

- **Réglages** (`team-discord-routes.ts`) : un rôle n'est accepté comme mention que s'il est marqué « Autoriser tout le monde à @mentionner ce rôle » dans Discord, quelle que soit la permission du bot dans le salon.
- **Interface** (`DiscordSettings.jsx`) : les rôles non mentionnables sont grisés dans la liste.
- **Publication** (`discord-worker.ts`, `isDiscordRoleMentionable`) : avant chaque nouveau message, le bot relit les rôles du serveur. Si le rôle a cessé d'être mentionnable, ou si la vérification échoue, le message part sans mention.
- Traductions EN/ES du message d'erreur corrigées (l'ancienne traduction parlait de « show »).

## Vérifications

- Tests : réglage refusé même quand le bot peut mentionner tous les rôles ; publication sans mention quand le rôle n'est plus mentionnable.
- `npm run verify`.
