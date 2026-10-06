# Corrections de l’audit SEO du 6 octobre 2026

Les défauts techniques et les améliorations des contenus établis par l’[audit SEO](audit-seo-2026-10-06.md) sont traités dans ce lot, à partir de `b3f4d67f5d2f5e7fb213d6532e2062dcff6f1609`. Les accès Search Console, les données de terrain et le choix de nouveaux sujets éditoriaux restent des travaux distincts : aucune amélioration de classement n’est déduite des tests locaux.

## Changements

- L’alias exact `nxt5.netlify.app`, en HTTP et HTTPS, redirige en 301 forcée vers le même chemin sur `https://nxt5.org`. Les règles précèdent les fichiers et routes internes ; les paramètres sont transmis par Netlify et les domaines des aperçus ne correspondent pas à ces règles.
- `AppRouter.jsx` conserve session, navigation, métadonnées, consentement et notifications. L’espace privé `AppContent.jsx` se charge à la demande ; les gardes administrateur et e-mail restent en place. La démonstration conserve son chargement différé.
- Le wordmark du header déclare ses dimensions d’affichage avec `sizes` et utilise un chargement immédiat. Le navigateur peut sélectionner une variante proportionnée à l’écran.
- Le build lit les titres et descriptions réellement émis dans les HTML publics, privés et 404. Les tests font volontairement disparaître, doubler ou altérer les balises pour vérifier que la construction refuse ces artefacts incorrects.
- `Organization.sameAs` et les liens sociaux visibles utilisent la même configuration publique, pendant le build et dans le navigateur.
- Le guide d’import décrit les cinq étapes réelles, les permissions, les quatre problèmes courants et une capture du véritable formulaire avec cinq profils fictifs. Le guide de débrief déroule un exemple complet du fait à la vérification d’une consigne, sans prétendre mesurer un progrès sportif.
- Les guides affichent leur responsabilité éditoriale et leur révision du jour. Le footer et les liens contextuels facilitent leur découverte ; Réseaux renvoie vers Contact pour éviter la répétition des démarches détaillées.

La [charte unique](../../../2026-05-05/utilise-github-pour-examiner-mes-pr/NXT5/docs/charte-graphique.md) est mise à jour en version 1.53 dans son emplacement canonique, sans copie dans ce dépôt. La palette, les composants partagés et les accès informatifs sont conservés.

## Chargement comparé

Mesures sur les deux builds locaux servis dans les mêmes conditions : version de base avant corrections et version corrigée. Chrome 154, contextes neufs, écran 390 × 844 px et densités 1,75 puis 2. Les chiffres JavaScript ci-dessous sont les sommes des fichiers effectivement demandés ; les tailles Brotli sont calculées avec la qualité 11, pas relevées sur le CDN de production.

| Ressources demandées | Avant | Après | Économie |
| --- | ---: | ---: | ---: |
| JS accueil et fonctionnalités, octets bruts | 509 417 | 473 519 | 35 898 (7,0 %) |
| JS accueil et fonctionnalités, octets Brotli Q11 | 136 599 | 127 545 | 9 054 (6,6 %) |
| CSS accueil et fonctionnalités, octets bruts | 166 685 | 161 437 | 5 248 |
| CSS accueil et fonctionnalités, octets Brotli Q11 | 27 019 | 26 019 | 1 000 |
| JS démonstration, octets bruts | 582 470 | 546 977 | 35 493 |
| JS démonstration, octets Brotli Q11 | 162 401 | 153 630 | 8 771 |
| Wordmark sélectionné, octets du WebP | 34 362 (640 px) | 15 244 (320 px) | 19 118 |

Le logo occupe 120 × 37,66 px dans ces essais. Aucun fichier `AppContent` ni appel `bootstrap` n’est demandé sur l’accueil, Fonctionnalités ou la démo. Les composants métier partagés nécessaires à la démo restent chargés dans celle-ci ; il ne s’agit pas de supprimer leurs fonctionnalités. Les images externes de la démo sont neutralisées dans cette fixture : ces relevés ne mesurent pas son rendu complet ni ses performances de terrain.

### Lighthouse mobile comparé sur l’accueil

Trois passages alternés par version, Lighthouse 12.8.2, Chrome 154, profil mobile par défaut avec CPU ×4 et réseau simulé, ressources précompressées avant toute requête. Les réponses d’authentification et de consentement sont locales et fictives, identiques entre versions. Aucune erreur ou alerte Lighthouse pendant ces six mesures.

| Mesure médiane | Avant | Après |
| --- | ---: | ---: |
| Performance | 86/100 | 87/100 |
| FCP | 2,553 s | 2,552 s |
| LCP | 3,537 s | 3,465 s |
| TBT | 110 ms | 112 ms |
| CLS | 0,0040 | 0,0040 |
| Volume transféré total | 451 517 octets | 422 416 octets |

La baisse de poids est établie ; le gain de LCP de 72 ms reste modeste et le seuil de 2,5 s n’est pas atteint dans ce profil local. Ces scores ne sont pas directement comparables aux 91/100 mesurés sur la production pendant l’audit, car l’origine et les réponses serveur diffèrent. L’affichage réel doit encore être mesuré après publication et dans les données de terrain.

Une première série utilisait une compression Brotli synchrone à chaque requête. Elle a été écartée de cette comparaison : sa latence serveur variable faussait la simulation Lighthouse, tandis que le LCP observé restait pratiquement identique (2 330 → 2 337 ms en médiane). Ses fichiers sont conservés avec la série corrigée, nommée `lighthouse-precompressed-*.json`, pour rendre cette limite explicite.

## Validation

- `npm run verify` réussi : contrôle TypeScript, **166 suites et 2 918 tests**, build de production et validation de ses treize pages pré-rendues.
- Build distinct avec `CONTEXT=deploy-preview` réussi : treize pages en `noindex`, sitemap vide, en-tête global d’exclusion et canonical de production conservées.
- `node tools/audit-dependencies.mjs` réussi. L’exception préexistante de compilation pour `braces` reste limitée au 5 novembre 2026 ; aucune nouvelle dépendance n’est ajoutée par ce lot.
- Revue indépendante du déplacement du routeur, puis navigateur réel : passage public → connexion → retour et public → vérification d’e-mail → retour, un seul contrôle de session, aucun chargement de données métier avant vérification, métadonnées et consentement conservés. Refus, réouverture des préférences et acceptation testés avec API locale fictive.
- Deux guides, Réseaux et accueil contrôlés à 320, 360, 390, 768, 1 024 et 1 440 px : **24 configurations**, sans débordement, un H1, aucune erreur JavaScript ou CSP. Captures mobile et bureau inspectées ; détails activés au clavier avec focus visible ; agrandissement de la capture dans un nouvel onglet sans `opener`.

Les preuves locales restent hors Git sous `tmp/seo-fixes-2026-10-06/`, notamment `verify.log`, `preview-build.log`, `dependency-audit.log`, `qa-routing.json` et `guides-qa/report.json`. Les tests persistants du dépôt couvrent le chargement des modules, les contenus initiaux et les mutations d’artefacts SEO.

Le comportement des règles de domaine, des splats et des paramètres suit la [documentation Netlify sur les redirections](https://docs.netlify.com/manage/routing/redirects/redirect-options/). Leur vérification en production complète les contrôles d’artefacts, sans assimiler le serveur local à Netlify.

## Suivi hors de ce lot

La lecture de Search Console reste nécessaire pour connaître les pages indexées, les canonical retenues, les requêtes, impressions et clics. Les données CrUX/INP réelles et les backlinks n’ont pas été obtenus. Les nouveaux guides éventuels sur la draft, l’organisation des entraînements ou Discord doivent répondre aux demandes observées ; aucun volume de recherche n’est inventé.
