# Lecture des pages — 7 octobre 2026

Cette passe prolonge la simplification de la fiche de partie livrée par la PR #125. Elle part de `d47efa8`, dans le checkout isolé `site-reading-pass`, branche `codex/global-reading-pass`.

L’objectif est de rendre le début de lecture évident : constat, action utile, puis compléments. Les comparaisons et formulaires qui nécessitent plusieurs informations simultanées gardent leurs contrôles. Aucun calcul métier, droit, tarif, texte légal ou contrat API n’est modifié.

La charte canonique indiquée dans `AGENTS.md` reste la référence unique. Ce rapport décrit le travail et ses contrôles ; il ne remplace pas cette charte.

## Couverture

| Famille | Résultat |
| --- | --- |
| Accueil connecté | Audité et conservé : démarrage ou reprise, avec une action dominante. Les évolutions réalisées dans d’autres branches ne font pas partie de cette passe. |
| Parties, groupes et import | Fiche récemment simplifiée conservée. Import déjà guidé : fichier, équipe, joueurs, confirmation. Gestion contextuelle, erreurs et progression conservées. |
| Débriefs | Notes de l’équipe avant l’analyse automatique V3. Bibliothèque avec recherche et filtres à ouvrir ; retour du focus sur le débrief choisi. Édition directement accessible, duplication et suppression en complément. Résultats regroupés sans trois cartes supplémentaires. |
| Profil — synthèse | Piste et prochaine action sur un axe vertical. Sources et indicateurs conservés. Champions, pool, historique et suivi gardent leurs parcours existants. |
| Analyses — synthèse | Piste, vérification des parties sources, puis objectifs. Introduction répétée supprimée ; bilan associé aux filtres. Évolution, comparaison, champions, objectifs et analyses de draft restent structurés par leur tâche. |
| Draft — compositions | Choix des champions avant les compteurs et le lexique. Aide répétée dans les emplacements vides condensée. Pool et zones de dépôt conservés. |
| Équipe et gestion | Joueurs, ajout, invitations et accès avant identité détaillée. Copies OP.GG dans un complément. Formulaire d’identité toujours monté. |
| Planning | Grille et notes avant les aides ; rappel d’enregistrement répété retiré. Erreurs, réessai et protection des notes conservés. |
| Paramètres | Sections verticales, largeur de lecture limitée, titres et badges redondants retirés. Création du premier mot de passe et erreurs de sécurité restent visibles. |
| Discord | Audité et conservé : compte personnel puis installation guidée, compléments déjà séparés. |
| Démo et aperçus publics | Chiffre principal, limite d’interprétation, question puis bouton de débrief. Vision, morts et joueurs dans un détail. Le composant commun améliore aussi accueil, fonctionnalités et guides publics. |
| Guide connecté | Introduction mobile pleine largeur, doublon d’accès à l’assistant retiré, aide à la lecture d’une partie synchronisée. |
| Administration — aperçu et fréquentation | Graphique principal visible ; repères et analyses complémentaires accessibles à la demande. Filtres, données principales, erreurs et reprise restent visibles. |
| Autres pages publiques et administratives | Accès, récupération, tarifs, soutien, contact, juridique, gestion d’équipes, publications/statistiques du bot, ventes, abonnements, exports et intégrations audités ; parcours existants conservés. |

`importer-app` n’est pas concerné par cette passe du site.

## Comportements conservés

- `ReadingDetails`, dans les composants communs, utilise `details` / `summary` natifs : Entrée/Espace, focus cyan, contenu conservé dans le DOM. Aucun démontage de formulaire lors d’un repli.
- Seul le marqueur V3 existant distingue l’analyse automatique des notes. Le texte historique libre et V2 reste présenté ensemble. Les règles de génération, de sauvegarde et de préservation des notes restent inchangées.
- La bibliothèque de débriefs reste ouverte pendant les changements de filtres, y compris après un résultat vide. Elle se ferme lors du choix explicite d’un débrief et donne le focus à son titre.
- Le champ de notes du composeur possède maintenant son propre libellé, au lieu de partager un `label` englobant les boutons d’insertion.
- Les droits de lecture/édition, confirmations de suppression, brouillons, liens sources et avertissements d’échantillon restent applicables.

## Vérification

Le contrôle complet `npm run verify` passe : TypeScript, 169 suites / 2 969 tests et compilation avec pré-rendu de 13 pages publiques. Les tests ajoutés couvrent les notes prioritaires et le texte historique, le filtre de bibliothèque après résultat vide, la démo et la conservation des compléments de fréquentation.

Vérifications dans un navigateur réel, sur des données fictives, avec les composants et le cadre de navigation du dépôt :

| Périmètre | Contrôles |
| --- | --- |
| Débriefs | Cinq états × cinq largeurs : notes et analyse, aucune note, historique, bibliothèque vide et lecture seule. Recherche, sélection/focus, édition, fermeture/reprise du brouillon et détails au clavier. |
| Équipe, gestion, planning, paramètres | Quatre vues × cinq largeurs. Saisie conservée après repli ; champ requis dans un formulaire séparé sans bloquer l’ajout de joueur ; erreur planning, erreur sécurité, absence de mot de passe et permissions réduites. |
| Profil, analyses, compositions | Trois vues × trois scénarios × cinq largeurs, puis dix recontrôles des compositions. Sources et retour du focus, clavier, suivi et objectifs, saisies préservées pendant l’ouverture des aides. Le cas « peu de parties » est équivalent au cas standard pour les compositions ; un état sans champion a été vérifié séparément. |
| Public et administration | Sept vues × six largeurs, de 360 à 2030 px. Démo → débrief → source, compléments au clavier, erreur/réessai admin et mouvement réduit. |

Les cinq largeurs de base sont 360, 390, 768, 1024 et 1440 px. Aucun débordement horizontal global n’a été observé dans ces cas. Les tableaux larges conservent leur défilement interne. Le texte courant reste à 16 px.

Les harnesses, mesures et captures sont conservés localement sous `.netlify/*reading-qa/` et ne font pas partie de la publication. Les tests ne certifient pas chaque combinaison de données privées en production. Une compilation ou une PR ne vaut pas publication sur `nxt5.org`.
