# NXT5 Importer 0.3.4 — noms de champions, détection du client, logo et ton — 29 septembre 2026

## Problème

Quand Riot ne fournit pas une partie (cas probable des scrims en partie personnalisée), l’Importer la lit dans le client LoL, qui ne donne que le numéro du champion. L’Importer prenait alors le **nom affiché** de Data Dragon (« Wukong », « Dr. Mundo ») au lieu du **nom interne** utilisé par Riot dans `championName` (« MonkeyKing », « DrMundo »).

Sur Data Dragon 16.19.1, 21 champions sur 173 sont concernés. Côté site, `buildChampionPool` (`src/utils/riot.js`) compare les noms en minuscules sans autre normalisation, et la clé des carnets de matchups (`championKey`) ne rapproche pas « Wukong », « Nunu & Willump » ou « Renata Glasc » de leur nom interne. Un même champion pouvait donc apparaître deux fois selon la source de l’import. La page Tendances, qui passe par `championAssetId`, n’était pas touchée.

Hors ligne, les noms devenaient aussi « Champion 157 », sans avertissement, et étaient enregistrés tels quels par le site.

## Correction (`importer-app`)

- `lcuChampionNames` lit `/lol-game-data/assets/v1/champion-summary.json` dans le client et garde l’`alias`, identique au `championName` de Riot (y compris `FiddleSticks`). Le client étant ouvert pour ce parcours, aucun accès Internet n’est nécessaire.
- Data Dragon reste un secours et renvoie désormais `champion.id`.
- Si un champion reste introuvable dans les deux catalogues, l’export échoue (« Catalogue des champions indisponible, réessaie connecté. ») au lieu d’enregistrer « Champion N ». Cette règle vient de l’audit croisé (PR #97).
- Sous Windows, `riotInstallDirectories` lit `RiotClientInstalls.json` et `league_of_legends.live.product_settings.yaml` dans `ProgramData\Riot Games` pour retrouver une installation hors de `C:`. Si ces fichiers sont absents, les chemins habituels restent utilisés.
- `assets/nxt5-logo.png` et `assets/nxt5-wordmark.png` sont retirés : ils n’étaient référencés nulle part et restent disponibles, identiques, dans `public/assets`. Ce retrait était prévu avec la prochaine version de l’Importer (`docs/nettoyage-depot-2026-09-29.md` sur la branche de nettoyage).

## Alignement sur la charte et maintenance

- **Logo** : l’en-tête recomposait « NXT5 » en texte Inter, alors que la charte demande de ne pas reconstituer la signature avec du texte. Il utilise désormais `assets/nxt5-wordmark-320.webp` (15 Ko), copie de `public/assets/nxt5-wordmark-320.webp`, suivi de la mention « IMPORTER ». Le symbole `nxt5-mark.png` propre à l’Importer (trident complet) est conservé. Le « NXT5 » du pied de page reste un texte de mention, pas une signature.
- **Ton** : tous les textes de l’interface et des messages d’erreur passent au tutoiement, comme le site (« Français direct et concret, tutoiement cohérent avec l’accueil »). Le README et le CHANGELOG, destinés aux développeurs, ne changent pas.
- **Electron** : 44.2.0 → 44.4.3 (commit Dependabot repris), dans la même version pour ne publier qu’une seule release.
- **Build** : des surcharges ciblées dans `pnpm-workspace.yaml` corrigent les alertes qui bloquaient `pnpm audit` en CI :
  - `undici@6: ^6.28.1` (GHSA-3wwx-pv8p-q78v, via `electron-builder` → `node-gyp`) ;
  - `brace-expansion` 1/2/5 → 1.1.21, 2.1.7 et 5.0.12 (GHSA-qhr7-859c-m2p7, GHSA-6j4f-fj2g-mc7p et GHSA-q2hr-2g5m-vwhr, via `minimatch`) ;
  - `fast-uri@3: ^3.1.8` (GHSA-hrr3-gc8f-f4qj, via `ajv`).

  Ces paquets servent seulement à construire l’application et ne sont pas embarqués. Retirer les surcharges quand `electron-builder` résoudra lui-même les versions corrigées.
- **Correctifs de l’audit croisé (PR #97)**, déplacés ici pour qu’une seule PR publie la 0.3.4 : une seule équipe gagnante exigée, CS à 10/20 minutes indisponibles si une composante manque, parcours du site à jour après l’export (« Parties → Importer une partie → Choisir mon fichier »).

## Vérifications

- `pnpm test` (depuis `importer-app`) : 38 tests, dont les alias du client, le rejet des entrées sans alias, `champion.id` de Data Dragon, la conversion LCU et la détection d’une installation sur un autre disque. `pnpm audit --audit-level=moderate` : aucune vulnérabilité.
- `node scripts/smoke-electron.mjs` avec Electron 44.4.3 : 23/23 sur la version finale. Les captures d’accueil (fenêtre normale et minimale) montrent le logo officiel net et les textes au tutoiement. Le scénario client LoL vérifie `Annie`, `TwistedFate`, `Leblanc`, `FiddleSticks` et `Kayle` sans jamais appeler Data Dragon. Un second scénario, sans catalogue du client et hors ligne, vérifie que l’export échoue sans ouvrir la fenêtre d’enregistrement. Le JSON obtenu passe le validateur d’import du site.

## Limites

- Aucune vérification avec un vrai client Riot : le format de `champion-summary.json` a été contrôlé sur la copie publiée par Community Dragon, et celui des fichiers d’installation Windows n’a pas été vérifié sur une machine Windows.
- Les parties déjà importées avec un nom affiché sont regroupées côté site par la PR #97 (normalisation à l’import et migration `20260929_canonical_champions.mjs`). La PR #96, qui faisait le même travail, a été fermée à son profit.
