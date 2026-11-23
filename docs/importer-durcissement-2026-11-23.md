# NXT5 Importer 0.4.9 — durcissement de la collecte (2026-11-23)

Suite d’une relecture en lecture seule de `importer-app`. Branche `claude/importer-fixes-20261123`.

## Corrections

| Sujet | Changement | Fichiers |
| --- | --- | --- |
| Collecte hors custom | Seules les parties `gameData.isCustomGame === true` sont observées. Le serveur ignore (`skipped`) toute partie reçue par jeton d’équipe dont `gameType` n’est pas `CUSTOM_GAME` ou dont `queueId` est renseigné et différent de 0. L’import manuel par fichier n’est pas concerné. | `importer-app/src/collector.js`, `netlify/functions/_lib/team-import.ts` |
| Région | L’identifiant de partie utilise `/riotclient/region-locale` du client connecté (mis en cache par lockfile) ; le réglage de région n’est qu’un secours. | `importer-app/src/collector.js`, `importer-app/src/main.js` |
| Jeton en clair | `collector.json` stocke `link.tokenEncrypted` (Electron `safeStorage`, base64) quand le chiffrement est disponible ; un ancien jeton en clair est migré au chargement ; sinon repli en clair. Le chiffrement est injecté (`cipher`) pour tester sans Electron. | `importer-app/src/collector.js`, `importer-app/src/main.js` |
| Adresse du site | `NXT5_SITE_URL` n’est lu que si `!app.isPackaged`. | `importer-app/src/main.js` |
| Fuses Electron | `electronFuses` (electron-builder 26.18, clé vérifiée dans `app-builder-lib/scheme.json`) : `runAsNode`, `NODE_OPTIONS` et `--inspect` désactivés, intégrité de l’asar et chargement depuis l’asar uniquement. `resetAdHocDarwinSignature` protège les builds macOS non signés. L’application ne dépend d’aucun fichier hors asar. | `importer-app/package.json` |
| Fichiers de parties | Un fichier n’est conservé que pour une partie encore envoyable (statut différent de `sent`) : supprimé après envoi (y compris `pending`, NXT5 garde la copie), à l’éviction des 50 dernières parties, et les orphelins sont nettoyés au chargement. Les échecs gardent leur fichier pour le bouton « Réessayer ». | `importer-app/src/collector.js` |
| Envoi concurrent | `flush()` garde la promesse en cours ; un envoi manuel l’attend puis envoie ce qui reste. | `importer-app/src/collector.js` |
| Écriture d’état | L’état en mémoire n’est remplacé qu’après l’écriture du fichier ; `atomicWrite` réessaie le renommage sur `EPERM`/`EBUSY`/`EACCES` (antivirus Windows). | `importer-app/src/collector.js`, `importer-app/src/core.js` |

Tests : `importer-app/test/collector.test.mjs` (custom uniquement, région du client, chiffrement et migration, nettoyage des fichiers, envoi concurrent, écriture avant mise à jour) et `src/__tests__/team-import-server.test.ts` (refus des parties hors custom).

## Points d’attention

- macOS : le trousseau lie l’accès à la signature de l’application. Tant que l’app n’est pas signée avec un certificat Developer ID, une mise à jour peut redemander l’accès au trousseau ; si le déchiffrement échoue, la liaison est perdue et il faut coller un nouveau code.

## Suite à prévoir

- Signature de code Windows (Authenticode) et signature + notarisation Apple : nécessite des certificats payants, écartée faute de budget (23/11/2026).
- Fait : la release « latest » publie `SHA256SUMS.txt`, les empreintes SHA-256 des exécutables de chaque build, avec la commande de vérification Windows et macOS dans sa description.
