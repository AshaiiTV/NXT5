# Assistant NXT5

L'assistant est une aide contextuelle en lecture seule. Il explique l'interface, propose une prochaine étape et peut ouvrir une page interne autorisée. Il ne modifie jamais les données et ne produit pas d'analyse sportive à partir des données de l'équipe.

## Architecture

- `src/components/assistant/AssistantPanel.jsx` gère le panneau, l'historique temporaire et les raccourcis contextuels.
- `netlify/functions/assistant-chat.ts` authentifie la requête, vérifie l'accès à la team, limite le débit et appelle Netlify AI Gateway.
- `netlify/functions/_lib/assistant-knowledge.ts` contient la base d'aide, la recherche lexicale, les chemins autorisés et le mode de secours local.
- Les fichiers de ce dossier servent de référence éditoriale lors des évolutions du produit.

## Garanties

- L'historique reste uniquement dans l'état React et disparaît au rechargement.
- Aucune statistique, review, identité de joueur ou donnée brute de match n'est envoyée au modèle.
- Les chemins proposés par le modèle sont filtrés par une liste blanche serveur.
- Si AI Gateway est indisponible, la recherche locale répond avec les mêmes sources.
- Les requêtes exigent une session NXT5 valide et sont limitées à 12 par minute et par utilisateur/IP.

## Mise à jour

Quand une page change, mettre à jour d'abord `assistant-knowledge.ts`, puis le document thématique correspondant. Ajouter un test de recherche si un nouveau terme ou un nouveau chemin devient important.
