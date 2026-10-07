# Politique de sécurité NXT5

Mise à jour : 7 octobre 2026.

## Périmètre et versions

Cette politique concerne le site [nxt5.org](https://nxt5.org), ses fonctions serveur, son intégration Discord et l’application NXT5 Importer de ce dépôt.

| Composant | Version recevant les correctifs |
| --- | --- |
| Site, fonctions et intégration Discord | Version courante de `main`, à déployer après validation. |
| NXT5 Importer | Dernière version officielle publiée dans [les releases NXT5](https://github.com/AshaiiTV/NXT5/releases). |
| Anciennes versions, forks et déploiements personnels | Pas de maintenance distincte ; mettre à jour vers la version courante. |

La présence d’un correctif sur `main` ne prouve pas sa mise en production. Pour un signalement, préciser l’URL ou la version de l’Importer réellement concernée.

## Signaler une vulnérabilité en privé

Pour signaler une vulnérabilité en privé, écrire à **[sachad.d91@gmail.com](mailto:sachad.d91@gmail.com)**, contact de Sacha Degouzon, éditeur de NXT5. La [page Contact NXT5](https://nxt5.org/contact) rappelle cette adresse et donne aussi accès au serveur Discord officiel : un message privé à l’équipe NXT5 identifiée sur ce serveur reste possible. Le lien d’invitation et les salons communautaires ne constituent pas un canal privé. Si le contact privé est indisponible, demander simplement à joindre l’équipe, sans publier les détails de la faille.

Ne pas ouvrir d’issue publique ni publier de preuve d’exploitation, de données d’équipe ou de compte dans une pull request ou un salon Discord public. L’adresse e-mail sert aussi aux autres demandes privées liées à NXT5 ; aucune clé de chiffrement n’est publiée. Cette politique ne suppose pas que le signalement privé de vulnérabilités GitHub soit activé.

Un rapport utile contient :

- l’URL, la fonction ou la version concernée et la date de l’observation ;
- les étapes minimales de reproduction, avec un compte et une équipe de test dont le déclarant maîtrise les données ;
- le résultat attendu, le résultat observé et l’impact possible ;
- une capture ou un extrait limité, avec les données personnelles, cookies, clés, codes de liaison et jetons masqués.

Ne jamais transmettre un mot de passe, une clé API, une URL de connexion à la base ou un jeton de session actif. En cas d’accès accidentel aux données d’un tiers, arrêter la manipulation et ne pas télécharger davantage de données. Les essais doivent éviter toute perturbation du service, tout envoi réel à des tiers et tout accès sans autorisation. Cette politique ne donne pas d’autorisation générale de tester NXT5 ou ses prestataires.

L’équipe évalue le signalement, échange en privé sur sa reproduction et coordonne le correctif et sa divulgation. Aucun délai de réponse ou de résolution garanti, ni programme de prime, n’est annoncé ici. Le délai affiché sur Contact pour les demandes relatives aux données personnelles ne constitue pas un délai de correction des vulnérabilités.

## Contrôles avant livraison et exploitation

Ces contrôles sont à réaliser et à documenter par le responsable du service. Leur présence dans ce fichier n’atteste pas des réglages actuels des comptes GitHub, Netlify, Neon ou Discord. Conserver une preuve datée indiquant l’environnement, le commit ou la release examinée, le résultat et les actions restantes, sans valeur de secret.

| Sujet | Contrôle et preuve attendue |
| --- | --- |
| Validation du code | Installation depuis les lockfiles, `npm run verify` et audit des dépendances du site ; tests, audit des dépendances et compilation de l’Importer lorsqu’il change. Vérifier les résultats de GitHub Actions pour le commit à livrer. Traiter les alertes Dependabot ; une alerte non corrigée doit avoir une décision et un suivi explicites. |
| Branche et releases | Protéger `main` avec les vérifications requises, interdire les suppressions et les poussées forcées, revoir les droits de contournement et limiter les comptes pouvant publier. Vérifier que la release de l’Importer provient du workflow officiel. |
| Comptes d’exploitation | Activer l’authentification multifacteur sur les comptes privilégiés qui la proposent ; revoir propriétaires, collaborateurs, applications OAuth et jetons GitHub, Netlify, Neon, Discord et fournisseurs utilisés. Retirer les accès inutiles. |
| Secrets et environnements | Garder les secrets côté serveur, hors du dépôt, des logs et des variables `VITE_*`. Vérifier leurs contextes et périmètres Netlify. Les previews utilisent des données et identifiants isolés ; elles ne doivent pas hériter des accès de production. |
| Base et administration | Limiter les droits du compte PostgreSQL utilisé par les fonctions et distinguer l’accès de migration lorsque possible. Vérifier `PLATFORM_ADMIN_USER_ID` et les comptes pouvant administrer la plateforme. Consigner le résultat des migrations du déploiement. |
| Production HTTPS | Vérifier les réponses réellement servies : HTTPS, CSP et autres en-têtes, cookies de session `HttpOnly`, `Secure` et `SameSite`, absence de cache sur les réponses authentifiées. Réévaluer les styles en ligne avant de resserrer la CSP et inventorier les sous-domaines avant d’étendre HSTS. |
| Sauvegarde et reprise | Vérifier dans Neon la fenêtre réelle de restauration et les droits associés. Réaliser une restauration dans un environnement isolé ; noter sa date, le point restaurable et le temps de reprise. Réconcilier ces limites avec les durées annoncées dans la politique de confidentialité. Un retour au déploiement précédent ne restaure pas la base. |
| Surveillance et rétention | Vérifier l’exécution et les erreurs des nettoyages, l’évolution des échecs d’authentification, les quotas et les alertes des fournisseurs. Vérifier séparément les données applicatives, les journaux d’hébergement, les sauvegardes et les publications Discord. |
| Contact de sécurité | Vérifier que l’équipe reste joignable en privé depuis Contact. Réexaminer et renouveler `public/.well-known/security.txt` avant son expiration du 23 mars 2027, après chaque changement de contact ou de domaine. |

Les procédures complémentaires sont décrites dans [les migrations](database/MIGRATIONS.md), [la mesure d’audience](docs/audience-api.md) et [l’exploitation Discord](docs/discord-operations.md).

### Exception temporaire de dépendance de compilation

La [politique d’audit](tools/audit-policy.mjs) accepte uniquement l’avis [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) de `braces`, et ses dépendances transitives affectées par ce seul avis, lorsque tous leurs chemins sont marqués `dev` dans le lockfile. L’exception expire le **5 novembre 2026 à 00:00 UTC**. Les autres avis de sévérité modérée ou supérieure et toute présence de cette chaîne dans les dépendances de production restent bloquants. Cette exception ne signifie pas que l’audit npm complet est sans alerte et ne doit pas être prolongée automatiquement.

Dans le verrou inspecté, Tailwind 3.4.19 introduit `braces@3.0.3` dans les outils de développement et de compilation. [La configuration Tailwind](tailwind.config.js) limite `content` à cinq chemins littéraux sans accolades : `./index.html`, `./src/**/*.js`, `./src/**/*.jsx`, `./src/**/*.ts` et `./src/**/*.tsx`. Aucune donnée utilisateur, variable d’environnement ou réponse réseau ne doit construire ces motifs. Aucun handler serveur n’accepte de motif utilisateur dans cette chaîne. Cette limitation réduit l’exposition ; elle ne corrige pas le paquet concerné.

Le [test de configuration](src/__tests__/tailwind-content-security.test.js) contrôle la syntaxe : une seule exportation d’objet, aucune propriété calculée ou propagation, un unique tableau `content` et exactement les cinq chaînes approuvées. Le [test de la politique d’audit](src/__tests__/audit-policy.test.js) couvre notamment l’échéance et le refus des dépendances de production. Avant l’expiration, mettre à jour la chaîne corrigée et retirer l’exception après vérification du lockfile et des audits. Si une migration Tailwind majeure est choisie, prévoir une recette visuelle selon la charte ; la compatibilité de configuration seule ne garantit pas un rendu identique.

### Journaux serveur

Dans `netlify/functions/**` et les modules serveur partagés, utiliser [logFailure](netlify/functions/_lib/safe-log.ts) pour les erreurs interceptées, avec un contexte fixe et des métadonnées explicitement choisies, non sensibles. Ne jamais journaliser l’erreur brute, son message, sa pile, une requête SQL, ses paramètres ou une réponse de fournisseur. Le filtre conserve uniquement des métadonnées bornées (`name`, `code`, statuts numériques) et rejette les objets imbriqués ; il ne peut pas reconnaître un secret dans une chaîne arbitraire fournie en complément. Les [tests du filtre](src/__tests__/safe-log.test.ts) et [des réponses HTTP](src/__tests__/http-response-security.test.ts) vérifient ces protections.

### Rappels d’inactivité en attente

Le [traitement des rappels](netlify/functions/inactivity-reminders.ts) réserve durablement l’envoi dans `inactivity_reminder_pending` avant l’appel au fournisseur. Un état `sending` après une réponse perdue exige un rapprochement manuel avec le fournisseur ; ne pas supprimer la réservation pour forcer un renvoi. `sent_pending` indique un envoi confirmé dont l’écriture finale reste à reprendre : le traitement suivant finalise son journal sans nouvel e-mail. L’ancienneté seule ne rend pas ces états réessayables. Les [tests serveur](src/__tests__/server-audit2.test.ts) couvrent les interruptions et les reprises.

## Réagir à un incident

1. **Qualifier et contenir.** Noter l’heure, les ressources touchées et les indices utiles dans un espace privé. Limiter les accès concernés et suspendre la fonctionnalité affectée. Préserver les journaux utiles sans recopier les secrets ni les données complètes des utilisateurs.
2. **Révoquer les identifiants exposés.** Révoquer ou renouveler les clés et jetons chez le fournisseur concerné, puis mettre à jour les variables serveur et déployer les fonctions qui les utilisent. Vérifier que l’ancien identifiant ne fonctionne plus. Effacer un secret du dernier commit ne suffit pas : l’historique, les artefacts et les logs peuvent en contenir une copie.
3. **Invalider les accès applicatifs nécessaires.** Pour un compte compromis, réinitialiser le mot de passe et vérifier la révocation de ses sessions en base. Un changement depuis les paramètres conserve la session courante et révoque les autres ; cette session doit également être révoquée si elle est suspecte. Les changements de mot de passe et d’adresse e-mail invalident les liens de récupération existants ; une réinitialisation les consomme tous et révoque toutes les sessions dans la même écriture. Vérifier que ces correctifs sont effectivement déployés ; sur une ancienne version, l’opérateur doit aussi invalider explicitement les liens encore utilisables. En cas d’exposition plus large, étendre la révocation aux autres sessions et jetons concernés. `SESSION_SECRET` est un contrôle de configuration : **sa rotation seule ne révoque pas les sessions**, qui sont des jetons opaques vérifiés en base.
4. **Corriger et reprendre.** Établir la cause, appliquer le correctif, exécuter les contrôles adaptés et vérifier le déploiement réellement servi. Restaurer seulement depuis un point identifié comme sain, dans le respect des migrations ; une sauvegarde peut contenir des sessions ou jetons compromis qu’il faut à nouveau invalider. Contrôler la reprise avant de réactiver les fonctions suspendues.
5. **Suivre l’incident.** Documenter le périmètre, les actions, les vérifications et les mesures de prévention. Déterminer les communications et démarches nécessaires selon les données effectivement concernées, puis informer les personnes appropriées par les canaux autorisés.

### Publication ou jeton Discord compromis

Mettre les connexions d’équipe concernées en pause et utiliser le coupe-circuit `DISCORD_PUBLISHING_ENABLED=false` pour suspendre les publications. Un jeton du bot exposé doit être renouvelé dans Discord ; si nécessaire, un responsable du serveur retire le bot. L’invitation actuelle demande la permission Administrateur : examiner tous les serveurs accessibles au bot dans le périmètre de l’incident.

La pause n’annule pas un envoi déjà engagé et n’efface pas les messages existants. Un retrait des messages exige une action distincte et la vérification de son résultat. Après restauration de Neon, rapprocher la file et les références des messages réellement présents avant reprise, conformément au [guide Discord](docs/discord-operations.md#12-retour-arri%C3%A8re-et-restauration).
