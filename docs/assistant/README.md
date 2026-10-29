# Assistant NXT5

L'assistant est une aide contextuelle en lecture seule. Il explique l'interface, propose une prochaine étape et peut ouvrir une page interne autorisée. Il ne modifie jamais les données et ne produit pas d'analyse sportive à partir des données de l'équipe.

## Architecture

- `src/components/assistant/AssistantPanel.jsx` gère le panneau, l'historique temporaire et les raccourcis contextuels.
- `netlify/functions/assistant-chat.ts` authentifie la requête, vérifie l'accès à l’équipe, limite le débit et les appels au modèle, puis appelle Netlify AI Gateway.
- `netlify/functions/_lib/assistant-knowledge.ts` contient la base d'aide, la recherche lexicale, les chemins autorisés et le mode de secours local.
- Les fichiers de ce dossier servent de référence éditoriale lors des évolutions du produit.

## Garanties

- L'historique reste uniquement dans l'état React et disparaît au rechargement.
- Le contexte envoyé automatiquement au modèle comprend uniquement le chemin autorisé de la page, le type d’élément sélectionné et les extraits de documentation. Aucune statistique, review, identité de joueur ou donnée brute de match n’est ajoutée à ce contexte. La question saisie et les six derniers messages au maximum sont transmis au modèle pour répondre.
- Les chemins proposés par le modèle sont filtrés par une liste blanche serveur.
- Si AI Gateway est indisponible ou si le budget quotidien est épuisé ou impossible à vérifier, la recherche locale répond avec les mêmes sources sans nouvel appel au modèle.
- Les requêtes exigent une session NXT5 valide et sont limitées à 12 par minute et par utilisateur/IP.

## Configuration

Les appels au modèle sont limités par défaut à 50 par compte et 1 000 pour toute la plateforme, par période de 24 heures. `NXT5_ASSISTANT_DAILY_USER_LIMIT` et `NXT5_ASSISTANT_DAILY_TOTAL_LIMIT` permettent d’ajuster ces plafonds avec des entiers strictement positifs ; une valeur invalide conserve le plafond par défaut. La limite de 12 requêtes par minute reste applicable à l’aide locale.

`NXT5_ASSISTANT_DISABLE_AI=1` force l’aide documentaire locale. `NXT5_ASSISTANT_MODEL` sélectionne le modèle, avec `gpt-5.4-mini` par défaut dans le code. Ces variables sont réservées au serveur.

## Mise à jour

Quand une page change, mettre à jour d'abord `assistant-knowledge.ts`, puis le document thématique correspondant. Ajouter un test de recherche si un nouveau terme ou un nouveau chemin devient important.
