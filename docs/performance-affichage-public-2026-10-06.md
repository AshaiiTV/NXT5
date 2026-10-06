# Affichage initial des pages publiques — 6 octobre 2026

Suite des [corrections SEO](corrections-seo-2026-10-06.md), à partir de `9a809ed3405ed0516b15ebcf7b408fb85d3f4a3c` (PR 119). Après cette première publication, trois mesures Lighthouse mobiles donnaient un LCP médian de 2,663 s et une performance de 96/100 sur l’accueil, avec un contrôle SEO de 100/100. Le but de ce lot est de supprimer une reconstruction inutile du contenu public initial.

## Cause et correction

Le navigateur recevait déjà un HTML public complet, mais `main.jsx` attendait le routeur puis utilisait `createRoot`, recréant ce contenu. Dans les trois traces de production précédentes, le paragraphe principal était enregistré comme LCP observé 38 à 48 ms après la fin du téléchargement d’`AppRouter`. Ce constat orientait vers le montage client ; il ne démontrait pas, à lui seul, l’ensemble des causes du temps simulé.

Les pages pré-rendues utilisent désormais `hydrateRoot` pour conserver leur DOM et lui attacher les interactions. Le pré-rendu emploie `renderToString` avec le même arbre complet `App`/`AppRouter` : page, conteneur initial du consentement et notifications. Les marqueurs Suspense et les identifiants des champs de la démo correspondent au premier rendu client. Cette correspondance suit le contrat d’[hydratation React](https://react.dev/reference/react-dom/client/hydrateRoot).

- Le HTML indique son chemin initial avec `data-prerender-path`, contrôlé au build. Les paramètres d’invitation et de campagne, ainsi que le chemin réellement demandé d’une 404, sont appliqués après le premier rendu identique.
- Le module de démo est préchargé pour une arrivée directe sur `/demo` uniquement. Les autres pages publiques ne le téléchargent pas pour s’hydrater.
- La police Inter 400 du texte principal est annoncée dès le HTML avec un unique préchargement. Vite résout son URL vers le même fichier versionné que le CSS ; elle n’est téléchargée qu’une fois. Les autres graisses ne sont pas préchargées.
- Les dates fictives de la démo utilisent explicitement le fuseau Europe/Paris et l’indiquent dans leur présentation. Les listes privées gardent l’heure locale. Sans cette distinction, des serveurs et navigateurs de fuseaux différents produisaient du texte incompatible.
- En cas d’échec de téléchargement du routeur ou de la démo, l’écran d’erreur existant propose de recharger la page si la récupération automatique ne suffit pas. Ce repli remplace volontairement le snapshot ; il n’essaie pas d’hydrater un arbre devenu différent.
- Les shells sans HTML pré-rendu, notamment l’authentification et les espaces privés, conservent leur rendu client. Les permissions serveur et la vérification d’e-mail restent inchangées.

## Validation

- `npm run verify` réussi : TypeScript, **169 suites et 2 955 tests**, build de production et validation des treize pages publiques.
- Build distinct avec `CONTEXT=deploy-preview` réussi : treize pages non indexables, sitemap vide, canonical de production conservées.
- Audit des dépendances réussi, sans ajout de dépendance. L’exception de compilation `braces` préexistante reste inchangée.
- Chrome 154 : treize pages publiques et une véritable URL inconnue dans deux fuseaux (Paris et Los Angeles), soit **28 cas**. Les nœuds H1 sont conservés, ainsi que le paragraphe principal et le champ de recherche lorsqu’ils existent ; aucun remplacement ni erreur d’hydratation. Le filtre de démo reste fonctionnel.
- **16 parcours mobiles** à 390 px : démarrage public et privé, connexion, invitations réellement générées par le produit, 404, retour navigateur, session et consentement. Une seule requête de session par contexte, aucune lecture des données métier avant vérification d’e-mail, aucune exception ni erreur d’hydratation.
- Échec réel des téléchargements `AppRouter` et `DemoPage` simulé dans Chrome, récupération automatique volontairement indisponible : écran d’erreur visible, aucun rejet de promesse non géré et rechargement réussi après rétablissement du réseau.
- Les nouveaux tests persistants vérifient le rendu sans navigateur, les états initiaux, les paramètres d’URL, les marqueurs de démo, les fuseaux, les téléchargements différés et les chemins de récupération.

Les fixtures de navigateur utilisent exclusivement des identités fictives et des API locales. Les preuves sont conservées hors Git dans `tmp/seo-lcp-2026-10-06/` (`verify-final.log`, `preview-build.log`, `qa-hydration.json`, `qa-chunk-failure.json` et mesures Lighthouse). Le contrôle des parcours est dans `tmp/seo-fixes-2026-10-06/qa-hydration-routing.json`.

## Mesures locales comparées

Même machine, Chrome 154 et Lighthouse 12.8.2, profil mobile avec réseau simulé et CPU ×4, cache navigateur neuf, serveurs identiques avec ressources précompressées. Trois passages alternés de la base et de la version hydratée ont d’abord été réalisés ; trois passages supplémentaires évaluent le préchargement de la police. Aucun test ou build n’a été lancé pendant les mesures retenues.

| Médiane, accueil | Base PR 119 | Hydratation | Hydratation et police préchargée |
| --- | ---: | ---: | ---: |
| Performance | 86/100 | 88/100 | 90/100 |
| FCP | 2,551 s | 2,627 s | 2,477 s |
| LCP | 3,485 s | 3,301 s | 3,154 s |
| TBT | 133 ms | 62,5 ms | 70 ms |

Sur les trois derniers passages, le LCP varie de 3,153 à 3,820 s et le score de 83 à 90 : une exécution est plus lente. Le préchargement est conservé pour la baisse du FCP sur les trois essais et du LCP médian, sans attribuer une garantie à une mesure isolée. Le CLS reste inférieur à 0,001 avec la police préchargée ; aucun avertissement Lighthouse ni téléchargement doublé de cette police n’a été constaté. Ces scores locaux ne sont pas comparables directement aux 96/100 de l’origine de production.

Les fichiers retenus sont `lighthouse-final-before-*.json`, `lighthouse-final-after-*.json` et `lighthouse-font-after-*.json`. Un lancement antérieur a été interrompu à cause d’un chevauchement avec un test de navigateur ; il ne fait pas partie des résultats. La validation complète a précédé le seul ajout du préchargement de police ; le build avec cet ajout et ses artefacts ont ensuite été vérifiés.

## Limites de visibilité

Search Console n’est pas accessible dans cette session : aucun navigateur ni onglet connecté n’est exposé, et aucun connecteur Search Console n’est disponible. Aucune donnée de propriété, d’indexation, de canonical retenue, de sitemap ou de requête n’a été consultée. Un accès authentifié ou un export est nécessaire ; cette limite ne permet pas de conclure que le site est absent de Google.

Les mesures Lighthouse sont des essais de laboratoire. Elles ne certifient pas les Core Web Vitals des visiteurs, l’INP ni les positions dans les résultats de recherche.
