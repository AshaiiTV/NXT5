# Vérification du dashboard Statistiques du bot

Vérification locale le 22 septembre 2026, Chromium 151.0.7922.34.

Les captures présentent **des données synthétiques réservées au test**. Elles ne représentent pas l’usage réel du bot. Le navigateur ouvre la vraie application et son cadre d’administration sur `http://127.0.0.1:4179/admin/bot-discord`. Les deux API de session et de statistiques sont interceptées localement. Toute requête externe ou API inattendue fait échouer la vérification. Aucun accès à la production ni écriture de données distantes n’a été effectué.

La vérification automatique et l’inspection visuelle couvrent les largeurs 360, 390, 768, 1024 et 1440 px : titre et navigation, contrôles, cartes de chiffres, graphique, serveurs et salons, pagination, activité récente, données quotidiennes, états chargement, erreur, stockage absent, rapport vide et accès refusé. Aucun débordement horizontal global ni erreur JavaScript n’a été observé. Le tableau quotidien conserve son défilement local.

Les boutons, champs, menus et résumés de détails visibles du dashboard mesurent au moins 44 px de haut. Le focus clavier mesure 2 px. Les touches Entrée ouvrent les détails et activent la pagination ; les flèches parcourent les journées du graphique. La recherche traite les accents et combine les mots ; le changement de période met à jour l’URL. Un refus 403 à l’actualisation efface les données administrateur déjà affichées. Le navigateur a été exécuté avec mouvement réduit.

Les 14 tests de `src/__tests__/bot-analytics.test.jsx` couvrent également les réponses obsolètes lors de changements de période, les requêtes annulées, les refus 401, l’actualisation transitoirement indisponible, les réponses malformées, l’équipe seulement présente dans l’historique, et la distinction entre commandes non conservées et journée enregistrée à zéro.

## Reproduction

Avec les dépendances du projet installées, lancer Vite dans un premier terminal :

```sh
npx vite --host 127.0.0.1 --port 4179 --strictPort
```

Puis lancer le script avec Playwright et Chromium disponibles :

```sh
node artifacts/bot-analytics/qa.mjs
```

Si Playwright est installé dans un runtime séparé, fournir le chemin de son module ESM dans `PLAYWRIGHT_MODULE`. Aucun paquet ni navigateur n’est installé automatiquement par ce script.

`qa-results.json` contient les mesures et les requêtes locales observées. Les fichiers `dashboard-*` montrent la page entière, `overview-*` le premier écran et `server-*` un serveur ouvert. Les fichiers `state-*` montrent les états alternatifs. Le script peut régénérer les cinq largeurs, même lorsqu’un sous-ensemble des captures est conservé dans Git.

Limites : cette vérification valide l’interface avec un contrat API simulé, dans Chromium. Les calculs et restrictions d’accès serveur sont couverts séparément par les tests backend ; l’usage réel et le rendu des autres moteurs de navigateur n’ont pas été audités ici.
