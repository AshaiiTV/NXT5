# Référencement et présentation publique de NXT5

Ce chantier prépare une présentation plus précise pour les équipes et coachs League of Legends. L’[audit daté](audit-seo-2026-09-24.md) conserve les preuves de l’état initial et le plan d’acquisition. Une branche ou une prévisualisation ne change pas le domaine public ; la publication et les résultats Search Console doivent être vérifiés séparément.

## Contenu et identité

L’accueil garde son accroche et explique le rôle de NXT5 dans le travail d’une équipe. `/fonctionnalites` détaille l’analyse, les débriefs, la préparation des champions, le planning et le partage Discord. Ces descriptions correspondent aux capacités de cette version ; elles n’annoncent ni clients professionnels, ni bénéfices sportifs mesurés, ni offre commerciale activée.

La [charte unique](../../../2026-05-05/utilise-github-pour-examiner-mes-pr/NXT5/docs/charte-graphique.md) reste la référence. Ne pas en créer de copie. La carte `public/og-nxt5.png` utilise le wordmark officiel, l’emblème complet et Inter locale. Pour la régénérer :

```sh
node tools/generate-social-card.mjs
```

## Construction du HTML public

`npm run build` exécute Vite puis `tools/prerender.mjs`. Les pages publiques déclarées dans `src/seo/metadata.js` (treize au 29 septembre 2026) sont produites depuis les mêmes composants React que l’application : accueil, fonctionnalités, démonstration, deux guides, contact, réseaux, soutien, mentions légales, confidentialité, cookies, conditions et règlement. Leur texte, leurs liens et leurs styles sont disponibles avant JavaScript. Aucune donnée de compte ou d’équipe n’est lue pour ce rendu.

Le navigateur hydrate ce contenu quand l’application publique est prête : les nœuds déjà affichés sont conservés au lieu d’être recréés. Le pré-rendu utilise `renderToString` avec le même arbre complet `App`/`AppRouter`, incluant les conteneurs initiaux du consentement et des notifications. L’attribut `data-prerender-path` fournit le chemin initial ; les paramètres de l’URL et le chemin demandé d’une 404 sont appliqués après hydratation. Les routes de travail privées et les shells vides gardent leur rendu client et l’écran de chargement partagé. Les pages publiques Réseaux et Soutien restent publiques pour les comptes connectés.

La démo initiale est préchargée uniquement sur `/demo` afin de retrouver le même arbre Suspense et les mêmes identifiants accessibles. Ses horaires fictifs sont affichés explicitement à l’heure de Paris, indépendamment du fuseau du serveur ou du navigateur ; les parties privées gardent l’heure locale. Si un téléchargement de module échoue et que la récupération automatique ne recharge pas la page, l’écran d’erreur existant fournit une action de rechargement au lieu de laisser une interface inerte.

Le HTML précharge uniquement Inter 400, utilisée par le texte principal. Sa référence source dans `index.html` est transformée par Vite vers le même fichier versionné que celui du CSS ; conserver `as="font"`, le type WOFF2 et `crossorigin` pour réutiliser la même requête.

`src/AppRouter.jsx` porte la session, la navigation, les métadonnées et le consentement, puis charge `AppContent.jsx` à la demande sur les routes privées autorisées. La démonstration conserve son propre chargement différé. Les contrôles administrateur et de vérification d’e-mail restent applicables ; la séparation des fichiers ne modifie pas les permissions serveur. Le wordmark du header déclare sa largeur d’affichage afin que le navigateur choisisse la bonne variante responsive.

`src/seo/metadata.js` centralise les titres, descriptions, canonical, aperçus sociaux et données structurées. Les paramètres d’URL ne sont jamais ajoutés aux canonical. L’origine de référence est `https://nxt5.org` ; une valeur `PUBLIC_SITE_URL` différente fait échouer la construction plutôt que publier une mauvaise canonical. La balise de vérification Google existante est conservée.

Le JSON-LD décrit le projet NXT5, le site et les pages avec leur fil d’Ariane. Il ne contient pas de prix, d’avis, de note ou d’affiliation commerciale. La politique de sécurité CSP reste stricte, sans JavaScript inline exécutable.

Les profils `Organization.sameAs` utilisent la même configuration `VITE_SOCIAL_*` que les liens visibles, au build et dans le navigateur. Les guides montrent les étapes réelles d’import et de débrief, avec responsabilité éditoriale, date de révision, capture d’interface et exemples explicitement fictifs. Le footer comporte une navigation de découverte distincte des accès informatifs ; Réseaux renvoie vers Contact pour les motifs de support détaillés.

## Routage et indexation

- Les fichiers HTML publics utilisent les Pretty URLs de Netlify, sans extension dans les liens et canonical.
- L’alias de production exact `nxt5.netlify.app` redirige en 301 forcée vers `https://nxt5.org`, en conservant chemin et paramètres. Les deux règles HTTP/HTTPS précèdent les règles de fichiers et d’application. Elles ne ciblent ni les Deploy Previews ni les domaines de branches.
- Le build crée un véritable `robots.txt` texte et un `sitemap.xml` contenant toutes les URL publiques de `PUBLIC_METADATA`.
- Les pages d’authentification, les liens à jeton et les routes de travail sont dirigés vers `app-shell.html`, marqué `noindex`. Leur protection effective reste l’authentification serveur ; `noindex` n’est pas un contrôle d’accès.
- Les routes absentes reçoivent une réponse 404 avec la vraie page « Page introuvable ». Les fichiers statiques et Netlify Functions conservent leur routage.
- `_redirects` et `_headers` sont générés dans `dist`. Ne pas réintroduire un fallback global `/* /index.html 200` dans `public/_redirects` ou `netlify.toml`.
- Les pages privées restent explorables afin que les moteurs puissent lire leur directive `noindex`. Les fonctions/API sont exclues dans robots.txt.

Pour ajouter une page publique, enregistrer ses métadonnées, son rendu dans `src/seo/render.jsx`, sa route dans l’application et ses liens de navigation. Vérifier l’autorisation explicite du chemin dans `src/app/audience-paths.js` si sa fréquentation doit être mesurée ; le consentement existant reste obligatoire. Ne pas ajouter des URLs comportant des identifiants privés à cette liste.

## Prévisualisations

Sur Netlify, tout contexte défini autre que `production` reçoit un `noindex` global dans le HTML et les en-têtes, avec sitemap vide. Les canonical continuent de désigner la production.

Pour une prévisualisation manuelle, utiliser :

```sh
npm run build:preview
```

Cette commande force `CONTEXT=deploy-preview`. Un build local ordinaire sans `CONTEXT` prépare la production : ne pas le publier sur un domaine de démonstration. `vite preview` seul ne simule pas les règles HTTP Netlify ; la présence des règles dans `dist` et leur comportement après déploiement sont deux vérifications distinctes.

## Validation et mise en ligne

La commande du dépôt reste `npm run verify` : TypeScript, tests et build. La construction vérifie automatiquement les artefacts finaux avec `tools/verify-seo.mjs` : contenu HTML, titres/descriptions distincts, canonical, JSON-LD, règles d’indexation, ressources présentes, image 1200 × 630, sitemap, robots et règles des routes privées/404. Les titres et descriptions sont extraits du `<head>` réellement émis, puis comparés aux valeurs attendues ; une balise absente, doublonnée ou incorrecte fait échouer le build, y compris dans les shells privés et 404. Les tests de mutation vérifient ce refus, sans se limiter au registre des métadonnées.

Contrôler aussi dans le navigateur l’accueil et les fonctionnalités à 360, 390, 768, 1024 et 1440 px, les questions au clavier, les liens après navigation interne et les démarrages public/privé. Vérifier le HTML et les styles sans JavaScript. Les tests locaux ne certifient pas les Core Web Vitals réels.

Après publication sur Netlify : vérifier les codes et types MIME de `/`, `/fonctionnalites`, `/robots.txt`, `/sitemap.xml`, d’une route privée et d’une URL absente ; préserver les redirections du domaine www et de HTTP vers HTTPS. Soumettre le sitemap dans la propriété Search Console autorisée, inspecter l’accueil et `/fonctionnalites`, puis suivre les impressions, clics et inscriptions selon le plan de l’audit. Aucun accès Search Console, aucune soumission ni amélioration de classement ne sont prétendus par ce chantier local.

## Vérification locale du 24 septembre 2026

- `npm run verify` réussi : TypeScript, 110 suites / 1 930 tests, build et contrôle des artefacts SEO.
- `npm audit --audit-level=moderate` réussi : aucune vulnérabilité signalée au moment de la vérification.
- Build de prévisualisation réel vérifié séparément : dix pages `noindex`, en-tête global, sitemap vide, canonical de production conservées.
- Lecture HTTP sans exécution JavaScript : dix pages complètes, ressources CSS/images accessibles, graphes JSON-LD corrects et carte 1 200 × 630. Le serveur local émule les règles de Netlify ; ce n’est pas un déploiement.
- Navigateur Chromium sur le build final avec sa CSP : accueil et fonctionnalités à 360, 390, 768, 1024 et 1440 px, sans débordement ni erreur de console. Captures de bureau et mobile inspectées ; FAQ au clavier avec focus visible ; métadonnées public → connexion → retour public sans doublons.
- Téléchargement du module de l’application volontairement retardé : le contenu de Fonctionnalités, Réseaux et Soutien reste affiché ; `/equipes` présente le chargement partagé puis la connexion anonyme attendue. Les réponses d’authentification et de consentement sont simulées localement ; aucun compte réel n’est utilisé.

Les performances Google, l’indexation réelle et le comportement après déploiement restent à mesurer sur le domaine public.
