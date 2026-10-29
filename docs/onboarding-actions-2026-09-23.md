# Démarrage NXT5 — correction du 23 septembre 2026

Après création d’une équipe vide, le bouton « Continuer : Roster » renvoyait vers la page déjà affichée. Le formulaire était uniquement dans Gestion équipe, sans accès depuis l’état vide. Les autres étapes ne tenaient pas compte des droits ou des prérequis, et le décompte incluait le staff.

## Comportement corrigé

- Quand une équipe existe, créer ou rejoindre une autre équipe reste accessible dans le menu du sélecteur d’équipe ; cette action ne figure plus dans l’en-tête du roster. Sans équipe, les formulaires restent affichés directement.
- Roster ouvre le formulaire à `/gestion-equipe?section=roster`, également accessible depuis le roster vide. Le premier champ reçoit le focus ; après ajout, le poste titulaire manquant suivant est présélectionné.
- Première game ouvre l’import quand cinq profils joueurs distincts sont disponibles, sinon l’ajout de profils. Une game déjà importée se consulte depuis cette étape.
- Tendances propose l’import jusqu’à trois games, puis l’analyse. Review ouvre directement la rédaction sur la dernière game, ou la review déjà existante.
- Les étapes indisponibles expliquent le prérequis ou le rôle du staff. Le roster suit cinq postes titulaires distincts, séparément des prérequis actuels de l’import.
- Le guide disparaît lorsque les quatre étapes sont terminées. Sa fermeture est mémorisée par compte et équipe ; un accès permet de le reprendre sur l’accueil Équipe.
- Le guide est absent des formulaires ciblés. Modifier un profil déplace le défilement et le focus vers l’éditeur, puis rend le focus au déclencheur à la fermeture.

## Vérifications

TypeScript et build de production réussis. La première exécution complète comptait 1 770 tests réussis. Sur l’état final, 1 773 tests ont été exécutés : 1 764 réussis et neuf dépassements du délai de cinq secondes dans les suites SQL préexistantes `migrations` et `review-backfill`. Les deux suites ont ensuite été relancées seules avec un seul worker : leurs 24 tests réussissent, sans modification de test ni de délai. Le build final réussit.

Les trois commandes de `npm run verify` ont été exécutées directement avec le runtime Node disponible (`tsc --noEmit`, `vitest run`, `vite build`), npm n’étant pas fourni dans ce runtime. Les logs se trouvent dans les artefacts locaux de la tâche.

Douze scénarios Chromium sur la vraie application locale, avec API simulée et données synthétiques : création d’équipe, ajout de cinq profils, import JSON avec prévisualisation et assignation, rédaction de review, seuil de Tendances, masquage/reprise et isolation compte/équipe, navigation clavier et retour de focus après édition. Aucune erreur JavaScript. Guide et formulaires vérifiés à 360, 390, 768, 1024 et 1440 px : aucun débordement global, contrôles de 44 px minimum et champs mobiles de 16 px.

Les API de production, Riot et la persistance réelle ne sont pas couverts par ces essais navigateur. Les permissions serveur restent inchangées.

## Référence graphique

La [charte canonique](../../../2026-05-05/utilise-github-pour-examiner-mes-pr/NXT5/docs/charte-graphique.md) a été actualisée en version 1.39 dans le dépôt principal de l’espace de travail. Conformément à la consigne de source unique, ce checkout retire son ancienne copie Markdown, son PDF et son générateur de PDF ; `AGENTS.md` et les anciens rapports pointent vers la source canonique. Aucun symbole de marque incomplet n’est réintroduit.
