# Audit général NXT5 — 6 octobre 2026

## Corrections réalisées après l’audit

Les constats initiaux sont conservés ci-dessous pour la traçabilité. Cette section consigne les corrections locales validées avant leur publication :

- **Accès et identité** : e-mail vérifié exigé par défaut pour les API métier ; parcours de récupération explicitement autorisés ; espace privé non monté avant vérification ; déconnexion accessible aux anciens comptes sans e-mail. Le bot Discord applique la même règle, y compris aux anciennes liaisons et confirmations. La dernière étape de liaison revérifie l’adresse et une déliaison concurrente ne peut pas supprimer une identité remplaçante.
- **Connexion** : vérification de mot de passe coûteuse également pour les identifiants absents et comptes sociaux sans mot de passe ; quota par compte pour le changement de mot de passe.
- **Permissions et transactions** : droits revérifiés sous verrou, écriture et journal d’audit atomiques pour équipes, joueurs, groupes de parties, statut de review, reviews, pool déclaré, compositions, objectifs, notes coaching et disponibilités. Les réglages et publications Discord revérifient également les permissions après les traitements longs. Les tests simulent révocations, rétrogradations et erreurs d’audit sur PostgreSQL local.
- **Riot** : verrou d’équipe persistant avec jeton, fraîcheur des profils de cinq minutes, quota par compte et budget partagé de synchronisation ; plafond ferme de 80 parties ; requêtes amont bornées à 6 s, traitement à 25 s, attente navigateur à 35 s. Les écritures refusent les travailleurs expirés et les profils ou accès modifiés entre-temps. Le budget de 90 appels réservés sur 120 s concerne la synchronisation de profils ; il ne constitue pas un quota global de toutes les fonctions Riot. Une synchronisation collective peut s’interrompre sur ce budget, puis reprendre les profils non encore frais.
- **Historique** : pagination avant projection JSON, réponse inchangée. Comparaison sur la même base : page à l’offset 2 900, médiane **4 709,8 → 170,6 ms** pour la requête de résumés. Voir les [mesures et leurs limites](perf-historique-2026-10-06.md).
- **Planning, après récupération du contexte Drive** : correctif de la [PR #116](https://github.com/AshaiiTV/NXT5/pull/116) repris depuis la même base `99b12dc`, sans fusion globale ni remplacement des protections serveur. Les changements de disponibilités conservent désormais les séances ; l’affichage regroupe les contributions sans en faire un payload de sauvegarde ; la suppression ne retire que la contribution éditée. Les titulaires sont prioritaires et les compteurs reflètent les représentants des cinq postes. Les tests API ont été adaptés aux transactions durcies : 86 tests ciblés / 8 suites réussis, puis relecture indépendante sans défaut supplémentaire établi. Aucun contrôle navigateur supplémentaire du planning n’est revendiqué.
- **Dépendances** : `sharp` retiré de la chaîne projet, optimisation WebP assurée par Canvas déjà présent ; PostCSS selector parser et source-map-js corrigés ; renderer React aligné ; Importer passé à `@electron/get` 5 pour retirer les deux chaînes vulnérables. L’[alerte Tailwind/braces résiduelle](build-dependency-security-2026-10-06.md) reste explicitement documentée : motifs fixes contrôlés, dépendance de compilation, exception précise inchangée qui expire le 5 novembre. Aucun audit « zéro alerte » du développement web n’est revendiqué.
- **Interface et maintenance** : démonstration chargée à la demande, bandeau cookies mobile compact avec acceptation/refus de même importance et personnalisation conservée ; documentation de version et commande de publication corrigées ; scan de développement Vite limité à l’entrée du site. Les changements de navigation réalisés simultanément par le chat d’interface ont été conservés.

La migration [`20261006_riot_sync.sql`](../database/migrations/20261006_riot_sync.sql), enregistrée dans le lanceur, est requise avant l’activation de ces fonctions en production. Aucun secret, compte réel ni message Discord n’a été utilisé pour les reproductions.

**Vérifications finales, après tous les correctifs** : `npm run verify` (`tmp/audit-2026-10-06/verify-after-drive.log`) réussi avec **163 suites / 2 888 tests**, TypeScript, build et 13 pages pré-rendues ; 38 tests Importer (`tmp/audit-2026-10-06/importer-tests-fixed.log`) réussis ; audits production web (`tmp/audit-2026-10-06/npm-audit-production-fixed.json`) et Importer (`tmp/audit-2026-10-06/importer-audit-fixed.json`) sans alerte. L’audit web complet (`tmp/audit-2026-10-06/npm-audit-fixed.json`) conserve cinq paquets de développement affectés par le même avis `braces` ; la politique de publication (`tmp/audit-2026-10-06/audit-after-update.log`) passe avec son exception préexistante, inchangée. `git diff --check` et les 119 références locales examinées étaient valides au moment du contrôle. Les journaux sous `tmp/` sont des preuves locales non versionnées ; ils ne sont pas publiés avec le dépôt.

Le binaire Windows a été construit avec `--publish never` en réutilisant la distribution Electron téléchargée, après deux échecs locaux de renommage `EPERM` dans l’extraction standard. Les builds macOS ne sont pas exécutés depuis ce poste Windows.

Contrôle navigateur local : accueil, cookies mobile, réglages/refus, récupération du compte non vérifié ou sans e-mail, déconnexion et démo. Aucun débordement horizontal observé à 390 px ; le bandeau mesure environ 340 px sur 844 px de hauteur, ses boutons environ 44 px. Ces fixtures ne remplacent pas une vérification des comptes et services de production. Le morceau JavaScript `AppContent` est passé de 286,70 à 221,39 ko (gzip 92,09 à 68,33 ko), mesure incluant les changements d’interface simultanés.

La charte canonique v1.52 du 28 septembre a ensuite été récupérée dans le transfert fourni par l’utilisateur et restaurée à l’emplacement déjà référencé par `AGENTS.md`. Ses 154 888 octets et son SHA-256 `5919823df14369fee8a90b71c980f57bfb2c55385bdea0f13147e06342eec3d8` correspondent au manifeste livré. Elle remplace la référence historique `642cd9e^:docs/charte-graphique.md` utilisée pendant l’audit. Une seule charte active est conservée, sans copie dans le checkout ni PDF recréé. Les guides de reprise et le contexte ont également été récupérés et leurs empreintes vérifiées ; les anciens patches et archives de code ne sont pas appliqués en bloc.

Fichiers de reprise locaux : guide (`tmp/nxt5-drive-transfer-2026-10-06/00-COMMENCER-ICI.txt`), contexte historique (`tmp/nxt5-drive-transfer-2026-10-06/07-CONTEXTE-ET-HISTORIQUE.txt`) et manifeste SHA-256 (`tmp/nxt5-drive-transfer-2026-10-06/99-VERIFICATION-SHA256.txt`). Le transfert est un instantané daté ; ses états de GitHub et des services ne valent pas vérification de production actuelle.

Les dernières revues croisées n’ont pas établi d’autre faille concrète dans les parcours examinés. Les interleavings de permissions sont simulés avec PostgreSQL local ; ils ne constituent pas un essai de contention multi-connexion sur Neon. Restent hors validation : services externes authentifiés, sauvegardes et configuration effective de production. Ces contrôles ont été réalisés avant publication ; la migration Riot doit précéder la mise en service des corrections.

## Verdict initial

NXT5 dispose d’un socle fonctionnel sérieux : le contrôle complet finit avec 152 suites et 2 665 tests réussis, le build pré-rend 13 pages publiques, et le parcours public fonctionne sur les écrans observés. Deux corrections sont prioritaires : faire respecter la validation de l’e-mail côté serveur et débloquer les audits de dépendances des chaînes de publication.

L’audit porte sur le checkout local `main`, commit `99b12dc0768abe60bd466e764ca72b302e1219e4`, avec les modifications locales déjà présentes sur les exports/publications, et sur des lectures anonymes de [nxt5.org](https://nxt5.org/). L’identité exacte du commit déployé n’a pas été établie. Les constats de code ne sont donc pas présentés comme des exploitations démontrées en production.

P1 = à traiter avant la prochaine publication ; P2 = correction importante à planifier ; P3 = amélioration de maintenance ou d’expérience.

## Constats prioritaires

### 1. P1 — La validation de l’e-mail est contournable par appel direct aux API

**Confirmé localement.** L’interface impose `EmailVerificationRequiredModal` dans [AppContent.jsx](../src/AppContent.jsx), mais [auth-login.ts](../netlify/functions/auth-login.ts) crée une session après vérification du mot de passe sans exiger `email_verified`. Le garde [requireAuth](../netlify/functions/_lib/auth.ts) lit ce champ sans le contrôler, puis [teams-create.ts](../netlify/functions/teams-create.ts) autorise la création d’une équipe avec cette session.

Deux reproductions locales exécutent les vrais handlers et le vrai garde d’authentification avec une base simulée et un compte fictif non vérifié : connexion HTTP 200 avec création du cookie de session ; création d’équipe HTTP 200 avec insertion demandée. Aucun compte ni enregistrement de production n’a été créé.

**Impact :** la possession de l’adresse e-mail n’est pas une condition effective d’accès aux opérations métier. Cela facilite les comptes utilisant des adresses non validées et les abus de ressources. Cette preuve ne démontre ni prise de contrôle d’un autre compte ni accès administrateur.

**Correction :** garder une session limitée pour renvoyer le lien, corriger l’adresse et se déconnecter ; exiger un compte vérifié dans un garde commun aux API métier. Vérifier également les comptes sociaux et les changements d’adresse. Critère : les mutations métier répondent 403 pour un compte non vérifié, tandis que le parcours de vérification reste utilisable.

Preuves locales : reproductions (`tmp/audit-2026-10-06/security-repro.test.ts`), résultat : 2/2 (`tmp/audit-2026-10-06/security-repro.log`).

### 2. P1 — Les audits de dépendances bloquent les prochaines publications

**Confirmé par interrogation des registres.** Le projet web remonte 9 paquets affectés : 7 de sévérité haute et 2 modérée, tous marqués comme dépendances de développement dans le lockfile. L’évaluation de la [politique actuelle](../tools/audit-policy.mjs) laisse 5 paquets bloquants : `postcss-nested`, `postcss-selector-parser`, `sharp`, `source-map-js` et `tailwindcss`. L’exception temporaire `braces`, qui expire le 5 novembre 2026, ne couvre pas ces nouvelles causes.

Le [déploiement Netlify](../netlify.toml) exécute cette politique après `verify` : le succès des tests et du build ne suffit donc pas à rendre le prochain déploiement publiable avec ces dépendances.

L’Importer remonte aussi deux alertes dans la chaîne `electron-builder` : `http-cache-semantics` 4.2.0, sévérité haute, et `sprintf-js` 1.1.3, modérée. Son [workflow](../.github/workflows/build-importer.yml) impose `pnpm audit --audit-level=moderate` avant les builds.

**Portée :** `npm audit --omit=dev` renvoie zéro alerte pour le serveur. Les résultats ci-dessus ne prouvent pas que le site public ou les applications distribuées sont exploitables. Le risque de publication bloquée est établi ; l’exposition à chaque vulnérabilité dépend de l’usage réel.

**Correction :** mettre à jour les dépendances transitives et les outils concernés, vérifier la compatibilité puis refaire les audits et les builds. Éviter d’étendre globalement l’exception existante. Les informations de correctifs du registre et de certaines fiches divergent : confirmer la version effectivement disponible avant de choisir une mise à jour.

Preuves : audit web (`tmp/audit-2026-10-06/npm-audit.json`), audit serveur sans dev (`tmp/audit-2026-10-06/npm-audit-production.json`), audit Importer (`tmp/audit-2026-10-06/importer-audit.json`). Fiches consultées : [PostCSS](https://github.com/advisories/GHSA-rj75-hqrm-r3gf), [sharp](https://github.com/advisories/GHSA-wq5f-xc86-pv6w), [source-map-js](https://github.com/advisories/GHSA-68fv-2mgg-jv7q), [http-cache-semantics](https://github.com/advisories/GHSA-ch52-4w7c-c8xp), [sprintf-js](https://github.com/advisories/GHSA-hp3w-g68c-fv3c).

### 3. P2 — La synchronisation des profils n’a pas de budget serveur propre

**Confirmé dans le code, sans test de charge en production.** [players-sync-most-played.ts](../netlify/functions/players-sync-most-played.ts) vérifie les droits staff, puis peut récupérer 80 matchs par profil par défaut, jusqu’à 1 000 selon la configuration, avec 10 appels concurrents. Aucun limiteur NXT5 par compte, équipe ou clé Riot n’est appelé sur cet endpoint. Le délai de refroidissement dans [Teams.jsx](../src/pages/workspace/Teams.jsx) est un état local de l’interface, essentiellement déclenché après une réponse 429.

**Impact :** plusieurs appels simultanés peuvent dupliquer le travail et consommer le quota Riot partagé, au détriment des autres équipes. La limitation fournie par Riot intervient après consommation et n’empêche pas le déclenchement de travaux redondants.

**Correction :** ajouter un budget partagé, un verrou de synchronisation par profil/équipe et une fraîcheur minimale ; retourner 429 ou le statut du travail existant avant de contacter Riot. Tester deux appels concurrents pour le même profil.

### 4. P2 — Les délais navigateur et serveur de la synchronisation sont incohérents

**Confirmé dans le code ; fréquence réelle non mesurée.** [apiFetch](../src/api/client.js) annule par défaut à 20 secondes. L’appel depuis `Teams.jsx`, ligne 436, ne change pas cette limite. [riotFetch](../netlify/functions/_lib/riot.ts), ainsi que les deux lectures Data Dragon, n’imposent pas de délai applicatif ; les helpers appelés par la synchronisation ne transmettent pas de signal d’annulation.

**Impact :** un historique long ou un service Riot lent peut produire une erreur visible côté navigateur alors que le serveur poursuit les appels et les écritures. Une nouvelle tentative peut ensuite doubler le travail.

**Correction :** définir un délai global cohérent, des délais amont et une annulation propagée ; pour les grosses synchronisations, utiliser un travail suivi par identifiant et afficher son avancement. Tester un amont lent et une nouvelle tentative après interruption. Augmenter seulement les 20 secondes ne règle pas la consommation de ressources.

### 5. P2 — Le coût des gros historiques reste à corriger

**Code actuel confirmé ; mesures antérieures explicitement réutilisées.** [useTeamData.js](../src/hooks/useTeamData.js) charge toutes les pages de 100 avant de publier l’état complet. [match-page.ts](../netlify/functions/_lib/match-page.ts) construit une projection JSON coûteuse dans la requête paginée par `OFFSET`. Ces deux fichiers sont inchangés depuis le commit `9fa7103` du banc existant.

Le [rapport du banc historique](perf-historique-2026-09-29.md), dont les mesures finales datent du 30 septembre, relevait 7,3 secondes de temps serveur cumulé à 1 000 parties et 60,7 secondes à 3 000, sur PGlite local. Il attribue l’essentiel du coût aux projections JSON des lignes ensuite écartées par `OFFSET`. **Ces durées ne sont pas des mesures de production ni de nouvelles mesures de cet audit.**

**Correction prioritaire :** sélectionner d’abord la page d’identifiants, puis construire les résumés uniquement sur ces lignes, en conservant ordre, contenu et garantie d’historique complet. Refaire le banc et vérifier le plan sur Neon avant de décider d’autres optimisations. Ne pas rendre des statistiques partielles comme si elles couvraient toutes les parties.

## Interface, produit et maintenabilité

L’accueil explique clairement l’usage collectif, la gratuité actuelle et le besoin d’un ordinateur pour importer. La démo sans compte permet de comprendre le produit avant inscription. La recherche « Jinx défaite » réduit correctement trois parties à une ; la vue Analyses s’ouvre. Accueil, démo, connexion et inscription ont été examinés dans le navigateur, avec un viewport mobile demandé de 390 × 844. Aucun débordement horizontal de document n’a été relevé sur la démo et l’inscription, ni erreur console sur le parcours consulté. Cela ne constitue pas une certification d’accessibilité ni un contrôle exhaustif des espaces connectés.

Améliorations P3 :

- Le bandeau cookies occupe environ la moitié de l’écran mobile observé et masque une partie du contenu. Réduire sa hauteur en conservant les trois choix directement accessibles ; le refus fonctionne et le bandeau disparaît.
- Le bundle `AppContent` atteint 286,70 ko, soit 92,09 ko gzip, et la feuille initiale 151,55 ko, soit 28,67 ko gzip. La démo est importée statiquement dans l’application publique. Étudier son chargement à la demande après une mesure réelle ; aucun score Lighthouse ou Core Web Vitals n’a été mesuré ici.
- Le frontend JavaScript/JSX n’est pas couvert par `tsc` : [tsconfig.json](../tsconfig.json) cible les fonctions TypeScript et désactive `checkJs`. `GameWorkspace.jsx` compte 2 218 lignes. Renforcer progressivement les contrats des données et extraire les responsabilités lors des prochains changements.
- Le [README](../README.md) annonce encore React 18, Importer 0.3.4 et l’ancien audit direct, alors que les manifests indiquent React 19.3.0, Importer 0.3.5 et une politique d’audit dédiée. Le chemin relatif de la charte dans [AGENTS.md](../AGENTS.md) résout vers un fichier absent sur cette machine. Rétablir l’accès à la source unique avant un futur travail visuel, sans la dupliquer.

## Contrôles de l’audit initial, avant corrections

| Contrôle | Résultat |
| --- | --- |
| `npm run verify`, confirmation de l’état initial | Réussi : TypeScript, 152 suites, 2 665 tests, build et 13 pages pré-rendues |
| Première exécution complète | 4 suites en échec : délais PGlite/planning et erreur de nettoyage ; les 25 tests concernés passent seuls, puis toute la suite repasse |
| Tests Importer | 38/38 réussis |
| Reproductions de vérification e-mail | 2/2 confirment le comportement décrit, hors production |
| Audit npm complet | 9 paquets affectés ; 5 restent bloquants selon la politique |
| Audit npm sans dépendances dev | Zéro vulnérabilité signalée |
| Audit pnpm Importer | 1 alerte haute et 1 modérée dans les outils de build |
| Accueil, fonctionnalités, démo, connexion, inscription | HTTP 200 |
| `robots.txt`, `sitemap.xml` | HTTP 200, types texte/XML corrects ; sitemap de 13 URLs |
| URL publique inexistante | HTTP 404 réel |
| `auth-me` et `bootstrap` sans session | HTTP 401, `Cache-Control: no-store` |
| Référencement public | Titres descriptifs, canonical, contenu HTML pré-rendu ; connexion/inscription avec `X-Robots-Tag: noindex, follow` |

Les en-têtes CSP sont présents sur les réponses examinées. Le code inspecté comprend cookies HttpOnly, hachage des tokens de session, contrôles d’origine sur les mutations, requêtes SQL paramétrées, limites de taille JSON, filtrage des destinations du proxy d’images et vérifications d’appartenance aux équipes. L’Importer active isolation de contexte et sandbox, et désactive Node dans le renderer. Ces protections sont des points positifs, pas une garantie d’absence de faille.

Journaux locaux : verify final (`tmp/audit-2026-10-06/verify-confirmation.log`), premier verify (`tmp/audit-2026-10-06/verify-full.log`), relance ciblée (`tmp/audit-2026-10-06/retest.log`), tests Importer (`tmp/audit-2026-10-06/importer-tests.log`), relevé HTTP (`tmp/audit-2026-10-06/production-http.json`). Ces fichiers de travail dans `tmp/` ne sont pas nécessairement conservés avec le dépôt.

## Limites et ordre de traitement consignés lors de l’audit initial

Pas d’essai authentifié sur une équipe de production, d’envoi Discord/e-mail, d’import réel, de paiement, de test de charge, de compilation Electron complète, de contrôle des sauvegardes Neon ou des secrets Netlify. L’indexation et le trafic Search Console ne sont pas mesurés. Les résultats GitHub consultés ne fournissent pas d’attestation exploitable du dernier déploiement.

Ordre alors conseillé : garde serveur de compte vérifié ; remise au vert des audits web et Importer ; budget et suivi des synchronisations Riot ; projection SQL après pagination ; améliorations de chargement public et de documentation. À cette étape initiale, les modifications métier et visuelles restaient à réaliser. Le travail décrit en tête du rapport a depuis corrigé ces constats, avec la réserve explicite sur la dépendance de compilation `braces`.
