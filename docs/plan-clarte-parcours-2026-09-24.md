# Plan de clarté et de prise en main NXT5

Demande autorisée le 24 septembre 2026 : rendre NXT5 plus facile à lire et à utiliser, particulièrement lors d’une première visite. Base : `e18f126` (main, après la correction des premières étapes #66). La [charte unique](../../../2026-05-05/utilise-github-pour-examiner-mes-pr/NXT5/docs/charte-graphique.md) reste la référence graphique.

**État : implémenté et vérifié localement le 24 septembre 2026.** Le [compte rendu de vérification](verification-clarte-parcours-2026-09-24.md) consigne les tests, les contrôles dans le navigateur et leurs limites. La mesure auprès de nouveaux utilisateurs reste une étape après livraison.

## Objectif et public

Un joueur ou un membre du staff qui connaît League of Legends doit pouvoir trouver sa prochaine action sans connaître l’organisation interne de NXT5. Les termes propres à l’analyse sont expliqués lorsqu’ils déterminent une action. Les outils avancés, les permissions et les données restent disponibles.

Parcours de référence : comprendre l’accueil → créer ou rejoindre une équipe → ajouter les joueurs → importer une partie → lire le bilan → préparer un débrief.

## 1. Une intention claire par page

### Changements

- Accueil : annoncer les usages concrets, parler de parties, de joueurs et de travail en équipe ; conserver une seule action principale et un exemple explicitement illustratif.
- Navigation : intitulés « Parties », « Analyses », « Débriefs », « Mon profil » ; conserver « Draft » avec une explication sur les champions. Afficher une courte description des destinations dans le menu ouvert, y compris sur mobile.
- Organiser le menu autour du travail quotidien et de l’analyse/préparation. Rendre le guide directement accessible.
- Équipe : présenter les joueurs, titulaires, remplaçants et encadrement dans des termes compréhensibles. Expliquer la distinction entre profil joueur et compte connecté.
- Harmoniser le guide et les premières étapes avec les intitulés visibles. Conserver les URL, identifiants internes et liens partagés.

### Critères de réussite

- Le visiteur peut expliquer l’utilité de NXT5 depuis le premier écran.
- Chaque destination principale comporte un intitulé et une explication visible ; aucune explication ne dépend uniquement du survol.
- Le guide est accessible depuis le menu ouvert et réduit, au clavier et sur mobile.

## 2. L’essentiel immédiatement visible

### Changements

- Partie : présenter résultat/contexte, résumé et observations du coach avant le détail.
- Distinguer observations automatiques et décisions du staff. Conserver les limites et les données manquantes.
- Réunir le détail dans des sections repliées et nommées : statistiques/5 contre 5, points à approfondir, chronologie. Indiquer ce qu’on y trouve avant l’ouverture.
- Garder les accès débrief, export, catégories et modification disponibles hors des sections repliées.
- Import : mettre le fichier à charger au premier plan. Garder l’obtention de NXT5 Importer et l’aide système accessibles à la demande. Après chargement, choisir son équipe avant d’exposer l’assignation des joueurs ; placer le nom et les catégories près de la confirmation.

### Critères de réussite

- La lecture initiale d’une partie permet d’en retenir le bilan sans parcourir tous les tableaux.
- Chaque détail reste accessible au clavier et conserve son contenu et ses actions.
- Changer de partie referme ses détails ; l’état de la précédente n’est pas présenté comme celui de la suivante.
- Le choix du côté reste distinct du résultat ; aucune valeur indisponible ne devient un zéro.

## 3. Des actions au bon endroit

### Changements

- Conserver les corrections de #66 : liens directs vers le formulaire joueurs, import à la demande et rédaction de débrief contextualisée.
- Après la préparation des joueurs, rendre l’accès à l’import visible près du formulaire. Expliquer le nombre de profils requis et conserver les droits existants.
- À l’import, expliquer précisément ce qui bloque la confirmation : côté, champions, profils distincts, postes adverses ou nom manquant.
- Proposer des retours explicites vers l’équipe et la liste des parties.
- Préserver les actions de changement de fichier, annulation, modification et reprise après erreur ; ne pas ajouter d’action externe automatique.

### Critères de réussite

- Un responsable peut suivre équipe → joueurs → import → bilan sans chercher un bouton dans une autre rubrique.
- Un membre sans droit de gestion reçoit une explication, sans action inutilisable présentée comme disponible.
- La progression reste liée aux données de l’équipe active ; changer d’équipe ne conserve pas une ancienne sélection d’import.
- La confirmation ne contourne aucune validation existante, y compris doublons et postes manquants.

## 4. Une lecture moins fatigante

### Changements

- Réutiliser les composants, Inter, les couleurs, les boutons de 2 px et les surfaces NXT5.
- Porter les labels de formulaire utiles à 14 px et les descriptions de page à 15 px. Conserver 16 px dans les champs mobiles.
- Utiliser titres, espacements et séparateurs pour distinguer l’essentiel, l’aide et le détail ; limiter les petites métadonnées et les blocs concurrents dans le parcours travaillé.
- Écrire des phrases courtes, limiter les abréviations et rapprocher explications, valeurs et actions.
- Vérifier les vraies compositions avec la navigation, sur 360, 390, 768, 1024 et 1440 px.

### Critères de réussite

- Pas de débordement horizontal global sur les écrans vérifiés ; les tableaux larges défilent localement.
- Noms, boutons et descriptions essentiels restent entiers ; les actions tactiles mesurent au moins 44 px.
- Le menu réduit, le tiroir mobile, les sections repliables et les formulaires gardent un focus visible et un ordre de lecture cohérent.
- Le bilan, les erreurs et les prérequis se comprennent sans dépendre exclusivement d’une couleur.

## Exécution et vérification

1. Intégrer en parallèle navigation/accueil, lecture de partie et parcours équipe/import dans un checkout isolé.
2. Mettre à jour les tests existants affectés par les nouveaux libellés et ajouter des vérifications de comportement pour les nouvelles interactions.
3. Exécuter `npm run verify` (types, tests, build).
4. Examiner les composants réels avec des données fictives : aucune équipe, équipe vide, équipe renseignée, membre sans gestion, liste et fiche de partie, import sans fichier puis avec aperçu.
5. Vérifier les largeurs cibles, le menu mobile, les sections de détail et les prérequis de l’import. Consigner les limites : les données fictives ne remplacent pas une observation de nouveaux utilisateurs ni un import réel en production.
6. Actualiser la charte canonique, consigner les résultats et livrer une modification relisible.

## Mesure après livraison

Faire parcourir les étapes de référence à quelques personnes qui découvrent NXT5. Observer les hésitations, erreurs de destination et besoins d’aide ; relever le temps jusqu’au premier bilan utile sans fixer de gain fictif. Ajuster les textes ou la structure sur ces observations. Cette phase nécessite de vrais participants et ne peut pas être déclarée validée par les seuls tests du code.
