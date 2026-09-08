# NXT5 — validation commerciale avant paiement

Préparation de la phase 1 du [plan de financement](plan-financement.md), 8 septembre 2026.

## Ce qui est intégré

- `/tarifs` : Découverte à 0 €, Pass Équipe à 29 € TTC par mois et Pass Saison à 169 € TTC pour six mois. Les prix et limites sont présentés comme des offres envisagées. L’annuel, le fondateur et Structure attendent la validation du besoin.
- « Demander un accès » sélectionne une formule et mène au formulaire. Les demandes sont enregistrées dans Neon après validation côté serveur ; aucune carte, activation d’abonnement ou modification des accès existants.
- Le formulaire recueille le contact, l’e-mail, l’équipe, le rôle, l’offre, le payeur envisagé et l’intention déclarée. Le message est facultatif. L’accord porte uniquement sur le recontact lié à cette demande, sans newsletter.
- `/admin/demandes-acces` : consultation paginée, filtre par statut, notes privées, statut de suivi et suppression. L’accès est contrôlé côté serveur avec l’administration plateforme existante.
- La page Confidentialité décrit les données collectées et leur conservation. Le consentement est enregistré avec la version `access-request-2026-09-08` et une date serveur.

## Installer et vérifier avant publication

Le code est préparé localement ; sa présence dans ce checkout ne signifie pas que le site en ligne a changé.

1. Exécuter `npm run verify` avec Node 24.
2. Pour une recette complète, utiliser une base dédiée et `npm run db:migrate` avec sa connexion. Ne jamais utiliser les identifiants de production pour les tests.
3. Démarrer les fonctions avec le serveur Netlify local (`npm run dev`). Une prévisualisation Vite seule permet de voir la page mais ne fournit pas les API d’enregistrement.
4. Vérifier `/tarifs` déconnecté puis connecté, la sélection du Pass Saison, la validation des champs et la confirmation d’enregistrement.
5. Vérifier le suivi avec le compte administrateur configuré, et son refus avec un compte ordinaire. Tester filtre, pagination, note, statut et suppression d’une demande de recette.
6. Vérifier un échec serveur : aucune confirmation d’enregistrement, réponses conservées pour réessayer. Renvoyer la même demande ne doit ni la dupliquer ni réécrire les coordonnées et les notes existantes.

Au prochain déploiement de production, la commande existante `npm run verify && npm run db:migrate` applique la migration additive `database/migrations/20260908_access_requests.sql` avant publication. Les migrations publiées restent immuables. Les nouvelles API attendent le marqueur `pricing-access-requests-20260908-v1` et répondent temporairement 503 s’il manque ; les routes de compte et d’équipe n’attendent pas ce nouveau marqueur.

Aucun secret Stripe ou prestataire de paiement n’est nécessaire. Les connexions Neon et les variables `PLATFORM_ADMIN_USER_ID` / `PLATFORM_ADMIN_EMAIL` déjà utilisées par l’administration gardent leurs règles actuelles.

Validation locale réalisée : `npm run verify` réussit avec 301 tests, le contrôle TypeScript et le build de production. Les pages Tarifs et Demandes d’accès ont été contrôlées dans Chromium à 360, 390, 768, 1024 et 1440 pixels, sans débordement horizontal ni erreur JavaScript. Les tests d’API et de migration exécutent les requêtes SQL sur PostgreSQL embarqué PGlite. Les essais de formulaire et de suivi dans le navigateur utilisent des réponses HTTP simulées, notamment l’échec puis la nouvelle tentative. Aucune base Neon externe n’a été migrée ou utilisée pour cette recette ; le fonctionnement sur l’environnement déployé reste à vérifier lors de la publication.

Avant le push, le contenu de la branche a également été vérifié dans un instantané isolé, sans les autres modifications locales en cours : 293 tests, TypeScript et build réussis. La différence de nombre de tests correspond aux travaux locaux hors de cette phase.

## Contrat des API

| Fonction | Usage |
| --- | --- |
| `POST /.netlify/functions/access-requests` | Demande publique. Champs `contactName`, `email`, `teamName`, `role`, `planCode`, `payer`, `purchaseIntent`, `message`, `consent: true`, `website` (piège anti-robot facultatif). Réponse uniforme `{ "ok": true }` après enregistrement ou si doublon. |
| `GET /.netlify/functions/admin-access-requests` | Administration uniquement. Paramètres `page`, `pageSize` et `status` facultatif ; renvoie demandes, pagination et compteurs globaux. |
| `POST /.netlify/functions/admin-access-requests` | Administration uniquement. `{ "id": "…", "status": "…", "adminNote": "…" }` met à jour le suivi et mémorise l’auteur et la date de dernière modification. |
| `DELETE /.netlify/functions/admin-access-requests` | Administration uniquement. `{ "id": "…" }` supprime la demande et toutes ses notes. |

Les entrées publiques sont limitées à 12 Kio, le nom de contact à 80 caractères, l’e-mail à 160, le nom d’équipe à 100 et le message à 2 000. Les notes administrateur sont limitées à 4 000 caractères. Les choix sont contrôlés par liste autorisée, les mutations intersites refusées et les soumissions limitées à cinq par dix minutes et par IP via une empreinte stockée par le limiteur existant.

L’unicité repose sur l’e-mail et le nom normalisé de l’équipe. Un renvoi anonyme ne peut pas modifier la demande initiale. Pour changer ses informations, le contact utilise le canal privé de Contact ; l’administrateur peut consigner la correction dans les notes ou supprimer la demande pour permettre une nouvelle soumission. Aucun e-mail n’est envoyé automatiquement.

La fonction Netlify planifiée `access-requests-cleanup` s’exécute à 03:15 UTC chaque jour en production. Elle supprime les demandes créées depuis au moins six mois, notes et coordonnées comprises. Un changement de statut ne repousse pas cette date. Les compteurs portent donc sur les demandes encore conservées. Contrôler l’exécution de cette fonction dans les journaux Netlify après publication.

## Conduire les dix échanges

Présenter NXT5 à dix équipes réelles, sans inventer de contacts ou de retours. Pour chaque échange, partir de leur organisation actuelle, montrer un import et une review, puis ouvrir la page Tarifs.

Questions à poser :

1. Quels outils utilisent-ils pour les games, le planning et les reviews ? Quel problème veulent-ils résoudre en premier ?
2. Le Pass Équipe à 29 € TTC par mois ou le Pass Saison à 169 € TTC leur conviendrait-il ? Quelle réserve sur le prix ou la durée ?
3. Qui déciderait et qui paierait : capitaine, manager, équipe ou association ?
4. À quelle date voudraient-ils démarrer ? Qu’est-ce qui les empêcherait d’acheter au lancement ?

Consigner dans les notes la date, la formule, le prix accepté, le payeur et les réserves. Un message « oui » dans le formulaire est un indice, pas encore une validation commerciale.

| Statut | Quand l’utiliser |
| --- | --- |
| Nouvelle demande | Formulaire reçu, échange encore à organiser. |
| Offre présentée | L’échange a eu lieu ; décision encore en attente. |
| Intention confirmée après échange | L’équipe a confirmé son intérêt pour la formule et le prix, et identifié qui paierait. Ce statut n’active aucun droit. |
| Offre présentée, sans suite | L’échange a eu lieu et l’équipe ne poursuit pas ; noter pourquoi. |

Les objectifs utilisent des équipes distinctes d’après leur nom normalisé. Les contacts multiples d’une même équipe ne sont pas additionnés ; deux équipes qui utilisent exactement le même nom seront regroupées et doivent être vérifiées manuellement. Seules les confirmations d’offres payantes alimentent l’objectif des trois intentions d’achat.

## Quand passer au paiement

Attendre dix présentations et au moins trois intentions confirmées d’équipes distinctes pour une offre payante, avec formule, prix et payeur documentés. Si ces critères ne sont pas remplis, utiliser les réserves recueillies pour revoir l’offre.

L’étape suivante reste celle du [brief d’intégration paiement](brief-integration-paiement-ia.md) : décisions commerciales et fiscales, conditions de vente, produits en mode test, facturation, Checkout, webhooks et droits serveur. Le catalogue de cette phase décrit seulement les propositions commerciales : il ne doit jamais être utilisé comme autorisation d’accès ou source de prix transmise au paiement.
