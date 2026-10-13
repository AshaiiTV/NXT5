# Finition du verre violet — 13 octobre 2026

La connexion ne reprenait pas la sculpture de l’accueil. Cette passe replace le 5 en verre au cœur des entrées du site et affine les composants partagés de l’espace connecté. Elle réutilise `glass-poster.webp`, `atmosphere.webp`, les rôles et la géométrie existante ; aucun nouveau logo ni asset généré n’est ajouté.

- Connexion et inscription : composition dédiée, vraie scène 3D chargée à la demande sur ordinateur, poster immédiat et compact sur téléphone, formulaire sur une surface stable. Les préférences de mouvement réduit et de performance conservent le poster. Le moteur s’arrête lorsque sa pose est stable, hors écran ou quand le document est masqué. Échec et perte de contexte reviennent au poster. Le lien de récupération conserve désormais la destination de retour.
- Accueil connecté : scène statique avec l’identité de l’équipe, cinq rôles, roster et raccourcis affinés. Les actions et données existantes restent inchangées.
- En-têtes partagés : sculpture dans une zone réservée, séparée des textes et des actions. Les en-têtes possédant déjà une identité propre gardent leur composition. Navigation, boutons et onglets reçoivent des arêtes plus nettes et des ombres plus discrètes.
- Fonctionnalités, soutien et guides : sculptures de tailles adaptées, chapitres éditoriaux et surfaces de lecture. Sur téléphone, Fonctionnalités conserve le 5 dès l’introduction.

La [charte unique](../../../2026-05-05/utilise-github-pour-examiner-mes-pr/NXT5/docs/charte-graphique.md) est consolidée en version 1.59 dans son emplacement canonique. Aucune copie ni PDF n’est créé. Les règles métier, les couleurs de résultat, les API, les droits et l’Importer restent inchangés.

## Vérification

`npm run verify` : 214 suites / 3 977 tests réussis, typage, 3 611 messages couverts en anglais et espagnol, compilation et 13 pages prérendues. Un nouveau build valide les dernières retouches CSS. `git diff --check` est propre. Une revue indépendante couvre le cycle de vie du moteur, les formulaires et la cascade des composants partagés.

La QA locale utilise les composants réels et des réponses API fictives, sans opération sur les comptes de production. Six pages publiques sont mesurées à 320, 360, 390, 768, 1024 et 1440 px ; neuf vues connectées à 320, 390, 768, 1024 et 1440 px, après affichage de leur contenu. Aucun débordement global relevé. Les portraits distants passant par le proxy Netlify ne sont pas servis par cette fixture : ces absences ne certifient pas le proxy de production et ne concernent pas les assets de marque réutilisés.

Contrôles ciblés : nom des champs, hauteur et police mobile, affichage du mot de passe, erreur de connexion simulée, destination conservée lors de la récupération, et captures des compositions ordinateur/téléphone. Les preuves locales et le serveur de fixtures sont sous `artifacts/visual-polish/`, exclus du commit et du build. Ces contrôles ne remplacent pas un test utilisateur réel ni la validation de chaque état privé possible.
