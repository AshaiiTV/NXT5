# NXT5 - Instructions de projet

## Charte graphique

Avant toute création ou modification visuelle du site NXT5, lire [charte graphique unique NXT5](/Users/sachadegouzon/Documents/Codex/2026-05-05/utilise-github-pour-examiner-mes-pr/NXT5/docs/charte-graphique.md), puis les composants concernés. Ce document du dépôt principal est la source unique pour les couleurs, la typographie, les logos, les surfaces, les états, la densité et le responsive. Deux fichiers du même dossier le complètent : [règles par page](/Users/sachadegouzon/Documents/Codex/2026-05-05/utilise-github-pour-examiner-mes-pr/NXT5/docs/charte-pages.md) pour la famille de pages concernée, et [journal des versions](/Users/sachadegouzon/Documents/Codex/2026-05-05/utilise-github-pour-examiner-mes-pr/NXT5/docs/charte-journal.md) pour l’historique et les preuves.

- Réutiliser en priorité `src/components/ui/Core.jsx`, `src/components/brand/BrandAssets.jsx`, les tokens et classes de `src/index.css`.
- Conserver le fond bleu nuit, les accents cyan/violet/fuchsia, les textes clairs et les panneaux arrondis. Vérifier la cascade réelle : des styles historiques sont neutralisés par `!important`.
- Adapter les changements au mobile et conserver les états de focus, chargement, erreur et mouvement réduit lorsqu’ils sont concernés.
- Les instructions explicites de l’utilisateur priment sur cette charte. Lorsqu’il demande une évolution de l’identité, la réaliser et mettre à jour le document dans le même travail ; ne pas créer une demande de confirmation supplémentaire pour une décision déjà autorisée.
- La charte du site ne remplace pas le système de mise en page propre à `importer-app`.
- Pour un nouveau checkout destiné au travail visuel, conserver ce fichier avec son lien vers la source unique. Ne pas recopier la charte ni recréer son PDF ; retirer les anciennes copies éventuellement apportées par Git. Toute évolution autorisée se fait dans la source unique.

Pour une modification uniquement documentaire, vérifier les liens et la cohérence du contenu. Pour le code, effectuer les contrôles adaptés au changement et les vérifications exigées par le dépôt (`npm run verify` pour le contrôle complet).

## Vérification des interfaces

- Avant livraison, inspecter les pages réellement rendues dans leur cadre complet : ordinateur, téléphone et largeur de 320 px. Un test sans débordement ne remplace pas la lecture des captures.
- Vérifier les actions concernées au clavier, le retour de focus, les menus et dialogues, les textes longs et les états vide, incomplet, erreur ou accès limité pertinents. Les décors et commandes flottantes ne doivent pas masquer le contenu.
- Pour un changement partagé, couvrir chaque famille de pages touchée et faire relire les corrections par un autre agent. Conserver les captures, scénarios et résultats ; annoncer précisément la couverture et ses limites.
- Employer des données fictives et des API interceptées pour les tests de mutations. Distinguer validation locale et validation de la version publiée.

## Mémoire et vérifications ciblées

Enseignements retenus des [trois Reels analysés le 15 octobre 2026](docs/enseignements-reels-2026-10-15.md) :

- Conserver les décisions durables, leur raison et les preuves utiles dans les guides existants. Rechercher d’abord dans le sommaire ou le graphe, puis lire les sources actuelles pertinentes. Distinguer les faits vérifiés, les hypothèses et le travail restant ; exclure secrets et données privées des notes de reprise.
- Lorsqu’un changement touche un import, une écriture ou un envoi externe, vérifier les scénarios concernés : répétition, interruption, concurrence, délais et révocation des droits pendant le traitement. Adapter les tests au risque réel et préserver quotas, transactions et isolation des données privées.
- Pour l’exploitation, suivre [SECURITY.md](SECURITY.md) et distinguer protections décrites, correctifs locaux et comportement déployé. Choisir cache, index ou infrastructure supplémentaire à partir d’un besoin mesuré.
- Pour un changement de collecte, de traceurs ou de vente, reprendre la [préparation juridique existante](docs/shopify-et-checklist-juridique.md) selon les flux réels. Vérifier également l’accessibilité des parcours modifiés. Une page ou un prompt générés ne constituent pas une preuve de conformité.
