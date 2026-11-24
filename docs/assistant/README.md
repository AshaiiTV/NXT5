# Assistant NXT5

L'assistant est une aide contextuelle en lecture seule. Il explique l'interface, propose une prochaine étape et peut ouvrir une page interne autorisée. Il ne modifie jamais les données et ne produit pas d'analyse sportive à partir des données de l'équipe.

## Architecture

- `src/components/assistant/AssistantPanel.jsx` gère le panneau, l'historique temporaire et les raccourcis contextuels.
- `netlify/functions/assistant-chat.ts` authentifie la requête, vérifie l'accès à la team, limite le débit et appelle Netlify AI Gateway.
- `netlify/functions/_lib/assistant-knowledge.ts` contient la base d'aide, la recherche lexicale, les chemins autorisés et le mode de secours local.
- Les fichiers de ce dossier servent de référence éditoriale lors des évolutions du produit.

Les parcours actuels sont décrits dans [Navigation et équipe](navigation-team.md), [Parties et débriefs](imports-stats-reviews.md), [Analyses, draft, salle de draft, planning et scrims](strategy-draft-planning.md), [Discord, compte et soutien](discord-compte-soutien.md), [Nexus Rising](nexus-rising.md) et [Permissions et dépannage](permissions-troubleshooting.md).

`AssistantPanel.jsx` choisit les questions proposées selon la rubrique du guide correspondant à la page. La Salle de draft (`/draft/salle`) n’a pas de rubrique dans le guide : le panneau envoie alors la rubrique `draft-room` de l’assistant.

## Garanties

- L'historique reste uniquement dans l'état React et disparaît au rechargement.
- Aucune statistique, review, identité de joueur ou donnée brute de match n'est envoyée au modèle. Le modèle reçoit le résumé, les étapes, les suggestions et les FAQ des sources retenues.
- Les appels facturés au modèle sont plafonnés chaque jour ; au-delà, la recherche locale répond (voir [le plafond de l’assistant](../assistant-plafond-2026-09-29.md)).
- Les chemins proposés par le modèle sont filtrés par une liste blanche serveur.
- Si AI Gateway est indisponible, la recherche locale répond avec les mêmes sources.
- Les requêtes exigent une session NXT5 valide et sont limitées à 12 par minute et par utilisateur/IP.

## Mise à jour

Quand une page change, mettre à jour d'abord `assistant-knowledge.ts`, puis les traductions anglaises et espagnoles de `assistant-knowledge-locales.ts` (mêmes identifiants, même nombre d’étapes et de FAQ), puis le document thématique correspondant. Si le parcours concerne Discord, actualiser aussi `shared/discord-help.js`. Vérifier chaque libellé dans le code de `main` : une branche ou un document de préparation ne prouve pas qu’une fonction est disponible. Ajouter un test de recherche si un nouveau terme ou un nouveau chemin devient important.

Dernière révision : 24 novembre 2026 (salle de draft, bot Discord à cinq commandes, compte et connexions associées, collecte réservée aux customs, soutien facultatif).
