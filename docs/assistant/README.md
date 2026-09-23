# Assistant NXT5

L'assistant est une aide contextuelle en lecture seule. Il explique l'interface, propose une prochaine étape et peut ouvrir une page interne autorisée. Il ne modifie jamais les données et ne produit pas d'analyse sportive à partir des données de l'équipe.

## Architecture

- `src/components/assistant/AssistantPanel.jsx` gère le panneau, l'historique temporaire et les raccourcis contextuels.
- `src/components/assistant/route-suggestions.js` choisit les questions selon la page et la rubrique active (import, profil, Tendances, Discord, paramètres).
- `netlify/functions/assistant-chat.ts` authentifie la requête, vérifie l'accès à la team, limite le débit et appelle Netlify AI Gateway.
- `netlify/functions/_lib/assistant-knowledge.ts` contient la base d'aide, la recherche lexicale, les chemins autorisés et le mode de secours local.
- Les fichiers de ce dossier servent de référence éditoriale lors des évolutions du produit.

## Garanties

- L'historique reste uniquement dans l'état React et disparaît au rechargement.
- Aucune statistique, review, identité de joueur ou donnée brute de match n'est extraite automatiquement de l’équipe pour le modèle ; seuls le type d’entité et la page sont retenus du contexte sélectionné.
- Les chemins proposés par le modèle sont filtrés par une liste blanche serveur.
- Si AI Gateway est indisponible, la recherche locale répond avec les mêmes sources.
- Le modèle reçoit les résumés, étapes et réponses FAQ des sources retenues. Le secours local répond depuis la source la plus pertinente, avec les mêmes liens internes autorisés.
- Les requêtes exigent une session NXT5 valide et sont limitées à 12 par minute et par utilisateur/IP.

## Mise à jour

Révision du 23 septembre 2026, confrontée aux fonctionnalités intégrées sur `main` : démarrage, Games et Importer, reviews automatiques, cinq rubriques Tendances et sept détails Draft, navigation Profil, exports PNG, Discord, connexions associées et soutien facultatif.

- [Navigation, équipe et profils](navigation-team.md)
- [Games, statistiques et reviews](imports-stats-reviews.md)
- [Tendances, pools, compositions et planning](strategy-draft-planning.md)
- [Discord, connexions et soutien](discord-account-support.md)
- [Permissions et dépannage](permissions-troubleshooting.md)

Quand une page change, mettre à jour d'abord `assistant-knowledge.ts`, puis le document thématique et les raccourcis concernés. Si le parcours concerne Discord, actualiser aussi le guide privé et les fiches dans `shared/discord-help.js`, ainsi que les messages de liaison ou d’aide concernés du bot. Vérifier les libellés dans le code intégré : une branche préparatoire ne prouve pas qu’une fonction est disponible. Les fournisseurs de connexion restent conditionnés à leur activation ; les tarifs administratifs ne sont pas une souscription publique et le soutien ne modifie pas les accès.

Ajouter un test de recherche et de réponse de secours pour les nouveaux termes, y compris depuis une autre page. Tester les chemins autorisés et conserver le refus des routes administratives et externes. `assistant-chat.test.ts` vérifie la transmission des FAQ, le secours local et l’absence des identifiants d’équipe ou de profil dans le contexte envoyé au modèle. Les questions libres et l’historique saisis par l’utilisateur sont transmis au modèle : ne pas y coller de données privées.
