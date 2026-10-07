# Connexions externes — interface et vérifications

Référence des ressources de marque et procédure de vérification de l’interface. Les contrôles avec des API simulées ne valident pas les identifiants OAuth de production.

## Marques et provenance

Les boutons Google et Apple utilisent un style propre à leur authentification, limité à ces actions. Le panneau, les champs, Discord, Riot et les autres actions gardent les composants NXT5. Les deux boutons font 52 px de haut, portent le libellé « Continuer avec… » et conservent les noms accessibles sans annoncer les logos décoratifs une seconde fois.

- **Google** : le [guide officiel](https://developers.google.com/identity/branding-guidelines), mis à jour le 7 juillet 2026, prescrit le G en couleurs, des palettes définies et Google Sans Medium. Le bouton utilise le thème clair (`#FFFFFF`, texte `#1F1F1F`, contour `#747775`), un G de 20 px et un espacement de 12 px avant le logo puis 10 px avant le texte. Le rayon est de 4 px, comme le modèle rectangulaire officiel. `public/assets/auth/google-g.svg` provient de l’[archive officielle](https://developers.google.com/static/identity/images/signin-assets.zip), entrée `Android + Web/SVG/Light/Theme=Light, Show text=No, Shape=Square, Platform=Android+Web.svg`. Seuls les deux tracés du cadre ont été retirés et le canevas ramené aux coordonnées du G ; dessin, masques et couleurs du logo sont conservés.
- **Police Google** : `google-sans-latin-500.woff2` est servi localement, depuis la réponse officielle de [Google Fonts](https://fonts.googleapis.com/css2?family=Google+Sans:wght@500&display=swap), sous-ensemble latin, graisse 500. La [licence SIL OFL officielle](https://github.com/google/fonts/blob/main/ofl/googlesans/OFL.txt) est conservée dans `public/assets/auth/google-sans-OFL.txt`. Aucun appel Google Fonts n’est nécessaire à l’ouverture du formulaire.
- **Apple** : les [Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/sign-in-with-apple/) demandent le logo officiel, un titre autorisé et des couleurs noires ou blanches. Le bouton blanc est adapté au fond sombre NXT5. `public/assets/auth/apple-signin-black.svg` est une copie intacte du fichier `Sign in with Apple - Left Aligned/SVG/Logo - SIWA - Left-aligned - Black - Medium.svg` du [paquet Apple Design Resources](https://devimages-cdn.apple.com/design/resources/download/Logo-Sign-in-with-Apple.dmg), lié depuis [Apple Design Resources](https://developer.apple.com/design/resources/). Le canevas complet mesure 31 × 44 ; son affichage suit la hauteur du bouton, sans recadrage ni padding vertical ajouté. Texte et logo sont noirs, fond blanc, rayon NXT5 de 2 px. La licence d’origine est conservée dans `public/assets/auth/apple-artwork-license.rtf`. L’activation Apple exige la configuration Apple Developer décrite dans le guide de déploiement.
- **Discord et Riot** : boutons textuels explicites, sans logo reconstitué. Riot reste proposé seulement si le serveur le déclare disponible. Aucun ancien symbole NXT5 incomplet n’est utilisé.

## Procédure de vérification

Exécuter les suites ciblées après une modification des connexions externes, puis `npm run verify` avant livraison :

```sh
npm test -- src/__tests__/social-account-ui.test.jsx src/__tests__/social-signup-email.test.ts src/__tests__/social-password-recovery.test.ts src/__tests__/app-loading.test.jsx src/__tests__/pricing-routing.test.jsx
```

Dans un navigateur, contrôler l’inscription, la fin d’inscription et les paramètres à 320, 360, 390, 768, 1024 et 1440 px avec des données fictives : logos lisibles, textes entiers, champs utilisables, absence de débordement et d’erreur JavaScript. Vérifier au clavier le focus lors d’une dissociation, sa restitution après Échap, l’annonce des erreurs et les noms accessibles des marques et des liens ouvrant un nouvel onglet.

Tester séparément les fournisseurs réellement configurés en recette selon [le guide de configuration](social-provider-configuration.md). Consigner le commit, l’environnement et les résultats de la vérification courante ; les tests d’interface seuls ne constituent pas une preuve de fonctionnement OAuth en production.
