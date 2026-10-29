# Calendrier des publications NXT5

Le compte propriétaire configuré par `PLATFORM_ADMIN_EMAIL` et/ou `PLATFORM_ADMIN_USER_ID` dispose d’un lien **Calendrier** en bas de la barre latérale. La page `/calendrier` fonctionne indépendamment d’une équipe et de son abonnement. Les autres comptes ne voient pas ce lien et ne peuvent pas lire les données.

`GET /.netlify/functions/social-calendar` vérifie la session et l’identité du propriétaire avant toute lecture. Il récupère les données du Site privé NXT5 Publications et ne transmet au navigateur que les champs du calendrier. Les réponses ne sont pas mises en cache. Aucun cookie NXT5 n’est envoyé au Site et aucun accès de service n’est transmis au navigateur.

La valeur `NXT5_CALENDAR_SITE_TOKEN` se configure comme secret Netlify, contexte production et portée Functions. Sa destination est fixe : `https://nxt5-publications.ashaii.chatgpt.site/api/calendar`. Ne jamais la mettre dans les fichiers du dépôt, les variables Vite, les URL ou les logs.

Une tâche cloud liée au Site met à jour Instagram depuis la connexion Metricool de son propriétaire, chaque heure. Elle utilise le guide protégé `/api/sync-guide` du Site et vérifie la lecture des données après écriture. Cette exécution ne dépend ni de Codex Desktop ni de l’ordinateur du propriétaire. La page NXT5 recharge les données toutes les 60 secondes lorsqu’elle est visible.

Les réseaux gardent leur date de dernière confirmation : Metricool fournit ses statuts réels ; YouTube conserve les confirmations disponibles ; TikTok et LinkedIn restent en suivi manuel tant qu’aucune source automatique n’est reliée. Un créneau passé ne suffit pas à confirmer une publication. En cas d’échec, les derniers contenus sont conservés avec une erreur de source et un état périmé visible.

Vérification : `npm run verify`, puis contrôle du cadre complet sur ordinateur, téléphone et 320 px. Les scénarios locaux emploient des données fictives et des API interceptées, notamment pour l’accès refusé, l’état vide et l’indisponibilité de la source.
