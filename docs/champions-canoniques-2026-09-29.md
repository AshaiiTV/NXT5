# Noms de champions canoniques côté site — 29 septembre 2026

Complément de [NXT5 Importer 0.3.4](importer-champions-2026-09-29.md). Les versions 0.3.3 et antérieures de l’Importer enregistraient, pour les parties lues dans le client LoL, le nom affiché des champions (« Wukong », « Dr. Mundo », « Kai'Sa »). Les imports Riot portent le nom interne de match-v5 (« MonkeyKing », « DrMundo », « Kaisa »). 22 champions étaient concernés, y compris « Fiddlesticks » / « FiddleSticks ». Le champion pool, groupé en SQL sur le nom exact, et les carnets de matchups séparaient donc un même champion selon la source.

## Changements

- `shared/champions.js` : `canonicalChampionName` renvoie le nom Riot quelle que soit l’orthographe reçue, et `championGroupKey` fournit la clé en minuscules sans ponctuation. La table reprend les alias déjà présents dans `champion-pool-manual.ts`, complétés par ceux qui différaient.
- **Import** (`persistAnalyzedMatch`) : `match_participants.champion` reçoit le nom Riot, même si le fichier vient d’un Importer ancien encore installé. Le JSON brut n’est pas modifié.
- **Changement de côté** (`match-side.ts`) : la comparaison avec le JSON d’origine passe par `championGroupKey`. Sans cela, une ancienne partie (« Dr. Mundo » dans le brut, « DrMundo » en base) aurait été refusée.
- **Champion pool manuel** et **carnets de matchups** (serveur et navigateur) utilisent le module partagé. « Wukong » et « MonkeyKing » donnent désormais la même clé de carnet.
- **Migration `20260929_canonical_champion_names.sql`**, appliquée automatiquement au déploiement de production (`npm run db:migrate`) :
  - renomme les 22 noms affichés dans `match_participants` ;
  - renomme les clés de carnets `wukong`, `nunuwillump` et `renataglasc`, sauf si un carnet existe déjà sous la clé Riot ;
  - applique immédiatement au champion pool le résultat d’un recalcul. Deux lignes automatiques sont fusionnées (parties, victoires, défaites, KDA et CS/min pondérés, winrate et verdict recalculés). Une ligne automatique masquée par une ligne manuelle est retirée, et une ligne manuelle prend le nom Riot. Deux lignes manuelles pour un même champion sont laissées telles quelles, pour ne perdre aucune note.
  - La migration est rejouable sans effet, et aucun nouveau marqueur n’est exigé par les fonctions : le code fonctionne avant comme après.

## Vérifications

- `src/__tests__/canonical-champion-names.test.ts` : normalisation, puis migration sur PGlite (renommages, fusion exacte des statistiques, lignes manuelles, conflit de carnet, seconde exécution sans changement).
- `match-import-atomic.test.ts` : un import « Dr. Mundo » et un import « DrMundo » donnent une seule ligne de pool (2 parties). Une partie avec un nom affiché peut changer de côté. Ces deux tests échouent si l’on retire la normalisation ou la comparaison par clé.
- `npm run verify` : typecheck, 2243 tests et build. Les tests qui appliquent toutes les migrations passent avec la nouvelle.

## Limites

- Les KDA et CS/min fusionnés partent de valeurs déjà arrondies (écart maximal 0,005). Le prochain recalcul de l’équipe les rend exacts.
- Les noms « Champion 157 », écrits hors ligne par un ancien Importer, ne sont pas corrigés : la base ne relie pas ce libellé à un champion sans relire le JSON brut.
- Les snapshots de publications Discord déjà envoyés restent inchangés.
