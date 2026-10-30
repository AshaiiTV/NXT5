# NXT5 - Instructions de projet

## Charte graphique

Avant toute création ou modification visuelle du site NXT5, lire [charte graphique unique NXT5](../../../2026-05-05/utilise-github-pour-examiner-mes-pr/NXT5/docs/charte-graphique.md), puis les composants concernés. Ce document du dépôt principal est la source unique pour les couleurs, la typographie, les logos, les surfaces, les états, la densité et le responsive.

- Réutiliser en priorité `src/components/ui/Core.jsx`, `src/components/brand/BrandAssets.jsx`, les tokens et classes de `src/index.css`.
- Conserver le fond bleu nuit, les accents cyan/violet/fuchsia, les textes clairs et les panneaux arrondis. Vérifier la cascade réelle : des styles historiques sont neutralisés par `!important`.
- Adapter les changements au mobile et conserver les états de focus, chargement, erreur et mouvement réduit lorsqu’ils sont concernés.
- Pour une modification des panneaux partagés ou de l’effectif, exécuter `npm run test:layout` (Chromium : `npx playwright install chromium`). Ce contrôle mesure les marges, débordements, chevauchements et le focus de 320 à 1 920 px, dans les deux ordres de chargement CSS. Les marges par défaut de `Surface` appartiennent à la couche `components` de `src/index.css`, après le reset et avant les utilitaires ; ne pas les remettre dans un sélecteur `:where` de priorité nulle.
- Les instructions explicites de l’utilisateur priment sur cette charte. Lorsqu’il demande une évolution de l’identité, la réaliser et mettre à jour le document dans le même travail ; ne pas créer une demande de confirmation supplémentaire pour une décision déjà autorisée.
- La charte du site ne remplace pas le système de mise en page propre à `importer-app`.
- Pour un nouveau checkout destiné au travail visuel, conserver ce fichier avec son lien vers la source unique. Ne pas recopier la charte ni recréer son PDF ; retirer les anciennes copies éventuellement apportées par Git. Toute évolution autorisée se fait dans la source unique.

Pour une modification uniquement documentaire, vérifier les liens et la cohérence du contenu. Pour le code, effectuer les contrôles adaptés au changement et les vérifications exigées par le dépôt (`npm run verify` pour le contrôle complet).

## Publications YouTube

Avant de préparer une publication YouTube NXT5 (sujet, script, titre, miniature, description ou analyse des résultats), lire [le guide YouTube](docs/youtube-playbook.md) et appliquer les enseignements pertinents. Distinguer les conseils de leurs auteurs, les hypothèses NXT5 et les résultats réellement mesurés. Mettre à jour ce guide lorsque l’utilisateur apporte de nouvelles références ou décisions ; ne pas transformer les promesses de viralité en faits.

## Mémoire et vérifications ciblées

Enseignements retenus des [trois Reels analysés le 15 octobre 2026](docs/enseignements-reels-2026-10-15.md) :

- Conserver les décisions durables, leur raison et les preuves utiles dans les guides existants. Rechercher d’abord dans le sommaire ou le graphe, puis lire les sources actuelles pertinentes. Distinguer les faits vérifiés, les hypothèses et le travail restant ; exclure secrets et données privées des notes de reprise.
- Lorsqu’un changement touche un import, une écriture ou un envoi externe, vérifier les scénarios concernés : répétition, interruption, concurrence, délais et révocation des droits pendant le traitement. Adapter les tests au risque réel et préserver quotas, transactions et isolation des données privées.
- Pour l’exploitation, suivre [SECURITY.md](SECURITY.md) et distinguer protections décrites, correctifs locaux et comportement déployé. Choisir cache, index ou infrastructure supplémentaire à partir d’un besoin mesuré.
- Pour un changement de collecte, de traceurs ou de vente, reprendre la [préparation juridique existante](docs/shopify-et-checklist-juridique.md) selon les flux réels. Vérifier également l’accessibilité des parcours modifiés. Une page ou un prompt générés ne constituent pas une preuve de conformité.

## Graphify local

Pour explorer l'architecture, les dépendances ou l'impact d'une modification, consulter le graphe local lorsqu'il existe dans `graphify-out/graph.json`, puis vérifier les fichiers sources cités. Le graphe représente une analyse statique et peut être incomplet ou périmé ; il ne remplace pas les tests ni la lecture du code actuel.

- Installation Windows locale : `$env:USERPROFILE\.codex\tools\graphify\Scripts\graphify.exe` ; compétence Codex : `$graphify`.
- Depuis la racine du dépôt, utiliser PowerShell : `& "$env:USERPROFILE\.codex\tools\graphify\Scripts\graphify.exe" query "nomDuSymbole" --budget 1500` ; `affected "nomDuSymbole" --depth 2` recherche les dépendances inverses.
- Pour créer ou actualiser l'index : même exécutable avec `extract . --code-only --max-workers 4`, puis `cluster-only . --no-label` pour le rapport et la carte. Les exclusions figurent dans `.graphifyignore` ; `graphify-out/` reste hors Git.
- L'installation NXT5 utilise l'extraction locale du code et du SQL, sans fournisseur LLM. Conserver `--code-only` et `--no-label` pour ce flux ; une analyse cloud ou sémantique externe relève d'une demande distincte.
