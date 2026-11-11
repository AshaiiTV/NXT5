# Vérification des cadrages

Données et comptes entièrement fictifs. Le harness ne charge pas de session privée.

- `npx vite --host 127.0.0.1` puis `/tools/framing-qa/index.html?view=controls`.
- Vues : `controls`, `profile`, `account-settings`, `planning`.
- Ajouter `&reset-last` pour charger les composants avant le reset global.
- `npm run test:framing` vérifie les hauteurs des champs/boutons, les alignements de rangée, les gouttières, les séparateurs, les retours à la ligne, le focus et les menus de 320 à 1920 px, dans les deux ordres de CSS. Résultats dans `artifacts/ui-framing/geometry.json`.
- `npm run test:layout` vérifie aussi les marges de l’effectif et le centrage des flèches des profils.

Le compte présente ses états d’erreur si les fonctions locales ne sont pas disponibles. Pour inspecter son état chargé sans backend, simuler `auth-social-status` avec `{ "hasPassword": true, "providers": [] }` dans le navigateur de test. Aucune connexion réelle ni écriture serveur n’est nécessaire aux contrôles de géométrie.
