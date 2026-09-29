# NXT5 Importer 0.3.4 — noms de champions et détection du client — 29 septembre 2026

## Problème

Quand Riot ne fournit pas une partie (cas probable des scrims en partie personnalisée), l’Importer la lit dans le client LoL, qui ne donne que le numéro du champion. L’Importer prenait alors le **nom affiché** de Data Dragon (« Wukong », « Dr. Mundo ») au lieu du **nom interne** utilisé par Riot dans `championName` (« MonkeyKing », « DrMundo »).

Sur Data Dragon 16.19.1, 21 champions sur 173 sont concernés. Côté site, `buildChampionPool` (`src/utils/riot.js`) compare les noms en minuscules sans autre normalisation, et la clé des carnets de matchups (`championKey`) ne rapproche pas « Wukong », « Nunu & Willump » ou « Renata Glasc » de leur nom interne. Un même champion pouvait donc apparaître deux fois selon la source de l’import. La page Tendances, qui passe par `championAssetId`, n’était pas touchée.

Hors ligne, les noms devenaient aussi « Champion 157 », sans avertissement, et étaient enregistrés tels quels par le site.

## Correction (`importer-app`)

- `lcuChampionNames` lit `/lol-game-data/assets/v1/champion-summary.json` dans le client et garde l’`alias`, identique au `championName` de Riot (y compris `FiddleSticks`). Le client étant ouvert pour ce parcours, aucun accès Internet n’est nécessaire.
- Data Dragon reste un secours et renvoie désormais `champion.id`.
- Un champion introuvable garde le nom « Champion N », et l’export affiche un avertissement invitant à réexporter la partie. Seuls les avertissements du client local sont relayés, jamais ceux d’une réponse distante.
- Sous Windows, `riotInstallDirectories` lit `RiotClientInstalls.json` et `league_of_legends.live.product_settings.yaml` dans `ProgramData\Riot Games` pour retrouver une installation hors de `C:`. Si ces fichiers sont absents, les chemins habituels restent utilisés.
- `assets/nxt5-logo.png` et `assets/nxt5-wordmark.png` sont retirés : ils n’étaient référencés nulle part et restent disponibles, identiques, dans `public/assets`. Ce retrait était prévu avec la prochaine version de l’Importer (`docs/nettoyage-depot-2026-09-29.md` sur la branche de nettoyage).

## Vérifications

- `pnpm test` (depuis `importer-app`) : 36 tests, dont les alias du client, le rejet des entrées sans alias, `champion.id` de Data Dragon, la conversion LCU, le relais des avertissements et la détection d’une installation sur un autre disque.
- `node scripts/smoke-electron.mjs` avec Electron 44.2.0 : 22/22. Le scénario client LoL vérifie `Annie`, `TwistedFate`, `Leblanc`, `FiddleSticks`, puis « Champion 10 » avec son avertissement lorsque le champion est absent du catalogue et que Data Dragon est hors ligne. Le JSON obtenu passe le validateur d’import du site.

## Limites

- Aucune vérification avec un vrai client Riot : le format de `champion-summary.json` a été contrôlé sur la copie publiée par Community Dragon, et celui des fichiers d’installation Windows n’a pas été vérifié sur une machine Windows.
- Les parties déjà importées avec un nom affiché restent en base sous ce nom. Les regrouper demanderait de normaliser la clé du champion pool et des carnets côté site.
