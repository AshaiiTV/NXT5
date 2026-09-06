# Vérifier NXT5 Importer

Les tests unitaires s’exécutent depuis `importer-app` avec `pnpm test`. Ils vérifient notamment la validation des données, les délais réseau, l’annulation, les préférences et les mises à jour. Le workflow de release les exécute avant de construire les applications.

## Test de l’application Electron

Le script `scripts/smoke-electron.mjs` lance le vrai processus principal, le preload isolé et l’interface. Il utilise des réponses NXT5/Riot simulées, un serveur HTTPS LCU sur `127.0.0.1`, un lockfile temporaire et des dialogues natifs simulés. Il ne contacte pas Riot, n’ouvre pas de navigateur externe et ne lit pas votre historique réel : chaque exécution utilise un nouveau dossier de préférences.

Prérequis : Node.js 24 ou plus récent, Electron, le paquet `playwright` complet et `openssl` accessible dans le `PATH`. Aucune dépendance supplémentaire n’est ajoutée au projet. Ce parcours a été vérifié sur macOS Apple Silicon avec Electron 44.2. Sous Linux, une session graphique ou un affichage virtuel est nécessaire ; le packaging Windows doit toujours être vérifié par la CI Windows.

Depuis `importer-app`, si Electron et Playwright sont déjà résolus par Node :

```sh
node scripts/smoke-electron.mjs
```

Pour utiliser des installations externes existantes :

```sh
NXT5_ELECTRON_BINARY="/chemin/vers/Electron.app/Contents/MacOS/Electron" \
NXT5_PLAYWRIGHT_MODULE="/chemin/vers/node_modules/playwright" \
NXT5_SMOKE_OUTPUT_DIR="/chemin/vers/les/preuves" \
node scripts/smoke-electron.mjs
```

`NXT5_ELECTRON_BINARY` désigne l’exécutable Electron. `NXT5_PLAYWRIGHT_MODULE` désigne le dossier du paquet `playwright`. Ces variables sont facultatives si les modules locaux sont disponibles. `NXT5_SMOKE_OUTPUT_DIR` est facultative : sans elle, les preuves sont conservées dans le dossier temporaire du système. Le script crée un sous-dossier unique et ne remplace aucun résultat antérieur.

Le parcours vérifie l’export et son JSON enregistré, l’absence de timeline dupliquée, les CS10/20, les erreurs suivies d’un nouvel essai, les deux annulations, la conversion LCU hors ligne, le rejet des ID/régions incohérents, les paramètres, la persistance, l’historique, les raccourcis clavier et l’absence d’erreurs console. Les JSON produits sont également passés au vrai validateur d’import du site, sans appel à la base de données.

Le dossier annoncé en fin d’exécution contient `results.json`, les exports synthétiques et trois captures : accueil vide, taille minimale et historique de test. L’historique et la connexion LCU visibles sur ces captures sont simulés. Un code de sortie non nul indique une erreur.

Ces tests prouvent le fonctionnement local et la compatibilité du format dans les scénarios simulés. Ils ne valident pas la disponibilité actuelle des services Riot, les données d’une partie réelle, la signature macOS ni le téléchargement d’une release publiée.
