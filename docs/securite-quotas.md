# Quotas de sécurité

Les compteurs sont réservés atomiquement dans PostgreSQL avant l'action protégée. Une panne du stockage interdit l'action ; les clés des budgets par compte ou destinataire sont hachées SHA-256 et ne contiennent pas l'adresse e-mail en clair.

| Action | Budgets |
| --- | --- |
| Connexion | 5 tentatives/minute/IP et 10 tentatives/15 minutes/compte, partagées entre son adresse e-mail et son nom de compte. Les identifiants inconnus sont également limités. |
| Demande de récupération | 5 requêtes/minute/IP, 1 envoi/5 minutes/destinataire et 5 envois/heure/destinataire, même en changeant d'IP. Une adresse inconnue ou un destinataire déjà limité reçoit la même réponse `200 { ok: true }`. |
| Rejoindre une équipe | 10 tentatives/15 minutes/compte et 30 tentatives/15 minutes/IP, y compris les codes invalides ou malformés. |
| Créer une invitation | 10 créations/heure/compte, 30/heure/IP et 10/heure/équipe. Le budget d’équipe est réservé seulement après vérification des droits du staff. |
| Assistant IA payant | 24 appels/minute/IP, 12 appels/minute/compte, 100 appels/jour/compte et 1 000 appels/jour pour l'ensemble du site par défaut. |

Les fenêtres sont fixes et commencent à la première réservation, pas à minuit. Les tentatives qui échouent après réservation restent comptées. Les quotas d'authentification ne sont pas réinitialisés lors d'une connexion réussie. Les limites par IP s'ajoutent aux budgets partagés ; les changements d'IP ne réinitialisent pas ces derniers.

## Invitations d’équipe

Les nouvelles invitations utilisent 128 bits aléatoires, au format `NXT5-` suivi de 32 caractères hexadécimaux, et expirent après une heure. Les codes temporaires plus courts déjà émis restent utilisables jusqu’à leur expiration, avec les mêmes limites de tentatives. La saisie accepte un code complet ou un lien HTTP(S) contenant un seul paramètre `invite` ou `code` ; elle refuse les valeurs ambiguës et ne tronque jamais un code long. L’adresse IP utilisée pour ces budgets vient du contexte Netlify, pas des en-têtes fournis par le visiteur.

## Configuration de l'assistant

Définir les variables suivantes dans les variables d'environnement des fonctions Netlify si les valeurs par défaut doivent changer :

- `NXT5_ASSISTANT_ACCOUNT_DAILY_LIMIT` : entier strictement positif, défaut `100`.
- `NXT5_ASSISTANT_GLOBAL_DAILY_LIMIT` : entier strictement positif, défaut `1000`.
- `NXT5_ASSISTANT_DISABLE_AI=1` : désactive tous les appels payants et conserve les réponses documentaires locales.

Un quota épuisé, une valeur invalide ou un stockage indisponible entraîne une réponse documentaire locale sans appel au fournisseur. Une requête réserve une seule tentative réseau, sans nouvelle tentative automatique du SDK. Le plafond global borne le nombre de tentatives API, pas directement une dépense en euros ; le prix dépend du modèle et des jetons utilisés. Les réponses locales ne consomment aucun quota lorsque l'IA est désactivée.

La taille réelle du corps JSON de l'assistant est limitée à 20 000 octets, même sans en-tête `Content-Length`.
