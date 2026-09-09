# NXT5 — abonnements manuels des profils

Mise à jour le 9 septembre 2026.

L’administrateur plateforme peut attribuer un abonnement à un compte depuis **Profils et abonnements**, à l’adresse `/admin/abonnements`. L’attribution est enregistrée en base avec sa formule, ses dates et son historique de modifications. Le titulaire retrouve son abonnement personnel dans Paramètres.

Cette attribution appartient au profil utilisateur. Elle ne crée pas de paiement, de facture ou de renouvellement automatique. Les rôles, appartenances aux équipes et quotas produit restent ceux de l’application actuelle ; attribuer ou retirer un abonnement manuel ne les modifie pas. La future facturation en ligne restera rattachée aux équipes, selon le [brief d’intégration paiement](brief-integration-paiement-ia.md).

Le catalogue manuel reprend désormais les deux formules de lancement : **Découverte — 14 jours**, puis **Pass Équipe**, proposé commercialement à 9,90 € TTC/mois/équipe. Une Découverte peut être préparée sans dates, au statut `pending`, ou être démarrée explicitement par l’administrateur pour 14 × 24 heures. La migration ne démarre aucun essai pour les profils existants ; les nouveaux comptes reçoivent également une Découverte sans dates. L’expiration ne rétablit pas un niveau gratuit permanent.

**Les abonnements ne sont pas lancés : aucun accès produit n’est bloqué**, quel que soit le statut personnel. `SUBSCRIPTION_RESTRICTIONS_ENABLED` reste à `false`. Une Découverte de profil datée ne démarre aucun essai d’équipe et un Pass attribué manuellement n’encaisse pas le tarif mensuel.

## Attribuer ou modifier un abonnement

1. Ouvrir `/admin`, puis **Profils et abonnements**, avec le compte administrateur plateforme.
2. Rechercher le compte concerné, le sélectionner et vérifier son identité avant de modifier son abonnement.
3. Choisir **Découverte — 14 jours** ou **Pass Équipe**. Pour Découverte, laisser l’essai non démarré ou choisir explicitement un début : la fin est calculée à 14 × 24 heures. Pour le Pass, définir son début et sa dernière date incluse, ou une validité sans date de fin.
4. Renseigner au besoin la note privée de suivi, puis enregistrer.
5. Vérifier le statut et les dates retournés par le serveur. Le titulaire peut consulter ce résultat dans Paramètres.

| Formule | Code |
| --- | --- |
| Découverte — 14 jours | `free` |
| Pass Équipe | `team_monthly` |

Les codes identifient la formule attribuée au profil. Ils ne constituent pas une preuve de paiement et ne déclenchent aucun droit multi-équipe. Les dates enregistrées déterminent la validité de l’attribution ; aucun prix du catalogue Tarifs n’est encaissé par cette action. Pass Saison et Pass Structure ne peuvent plus être attribués. Leurs anciens noms restent visibles dans l’historique.

La liste des profils est recherchable et paginée. Une note administrative reste privée : elle sert au suivi de l’attribution, pas à un message envoyé au titulaire.

## Validité et retrait

Le serveur calcule le statut à partir des dates et du retrait enregistré. Pour Découverte, l’absence de début et de fin signifie **essai non démarré**, au statut `pending`. Fournir un début démarre ou programme une période exacte de 336 heures ; le serveur calcule sa fin et refuse une fin différente. Pour un Pass, un début omis prend la date courante du serveur ; une fin absente signifie une validité sans date de fin. La fin est exclusive : l’attribution expire dès que cet instant est atteint. Aucune nouvelle période n’est créée automatiquement à l’expiration.

L’interface utilise les jours du fuseau local du navigateur : le début choisi correspond à minuit. Pour le Pass, le champ « Fin incluse » comprend la journée choisie, convertie en une fin API à minuit le lendemain. Découverte n’utilise pas une fin libre : sa durée reste exactement 336 heures, y compris lors d’un changement d’heure. Les instants sont transmis avec leur fuseau puis stockés comme dates horodatées. Le résumé personnel propose « Actualiser l’abonnement » pour relire le statut serveur.

| Statut API | Signification | Formule effective |
| --- | --- | --- |
| `none` | Aucune attribution enregistrée pour ce profil. | `null` |
| `pending` | Découverte préparée sans dates ; essai non démarré. | `null` |
| `active` | Attribution valide à l’instant présent. | Formule attribuée |
| `scheduled` | Début de validité futur. | `null` |
| `expired` | Fin de validité atteinte. | `null` |
| `revoked` | Attribution retirée par l’administrateur. | `null` |

Le retrait est prioritaire sur les dates. Une Découverte sans dates est ensuite non démarrée ; pour une attribution datée, le serveur examine son début futur puis sa fin. `planCode` conserve la formule enregistrée ; `effectivePlanCode` indique celle qui est valide maintenant et vaut `null` hors du statut `active`. Ces valeurs décrivent l’abonnement personnel ; les accès produit ne sont pas activés à partir de ce statut.

Le retrait met fin à l’attribution manuelle et reste tracé dans l’historique. Il ne supprime ni le compte, ni ses équipes, ni ses données. L’expiration et le retrait ne changent pas les rôles ou quotas actuels.

Un profil possède une seule attribution courante. Enregistrer une nouvelle formule remplace la précédente et conserve la modification dans l’audit. Si son début est futur, le statut devient immédiatement `scheduled` et la formule effective est nulle jusqu’à cette date : l’ancien Pass ne continue pas en parallèle. Préparer une Découverte sans dates produit de même un statut `pending`, sans formule effective. Il ne s’agit pas d’une file de renouvellements programmés.

Chaque modification utilise la révision du dossier consulté. Si un autre administrateur a modifié l’attribution entre-temps, le serveur refuse l’écrasement : recharger le dossier, relire son état, puis décider de la modification à effectuer.

## Contrat des API

Les routes ci-dessous sont des Netlify Functions, sous `/.netlify/functions/`.

| Requête | Accès et réponse |
| --- | --- |
| `GET admin-account-subscriptions?q=…&page=1&pageSize=10` | Administrateur uniquement. Renvoie `{ accounts, pagination }`. Chaque compte contient `id`, `name`, `accountName`, `email` et `subscription`. La pagination fournit `page`, `pageSize`, `total`, `totalPages`. |
| `GET admin-account-subscriptions?userId=…` | Administrateur uniquement. Renvoie `{ account, history }` pour le compte choisi. |
| `POST admin-account-subscriptions` | Administrateur uniquement. Attribue ou retire l’abonnement ; renvoie `{ ok: true, account, history }`. |
| `GET account-subscription` | Utilisateur connecté. Renvoie `{ subscription }` pour la session courante uniquement. Aucun choix d’un autre compte n’est accepté. |

Champs du `POST` :

| Champ | Attribution `action: "assign"` | Retrait `action: "revoke"` |
| --- | --- | --- |
| `userId` | UUID du compte existant | UUID du compte existant |
| `expectedRevision` | Révision entière reçue lors de la lecture ; `0` s’il n’existe aucune attribution | Révision entière reçue lors de la lecture |
| `planCode` | `free` ou `team_monthly` uniquement | Absent |
| `startsAt` | Date ISO ou `null`, facultative ; absence = Découverte non démarrée, ou début serveur pour un Pass | Absent |
| `endsAt` | Date ISO ou `null`, facultative ; calcul serveur à +336 h pour une Découverte datée, `null` signifie sans fin pour un Pass | Absent |
| `note` | Note privée facultative, 1 000 caractères maximum | Note privée facultative, 1 000 caractères maximum |

Les dates ISO doivent préciser l’heure et le fuseau (`Z` ou décalage UTC). Pour `free`, omettre les deux dates ou transmettre `null` prépare une Découverte sans démarrer l’essai. Avec un `startsAt`, la fin est calculée à exactement 336 heures : omettre `endsAt` ou transmettre la fin exacte ; une autre fin est refusée. Une fin sans début est également refusée. Pour un Pass à durée définie, la fin doit être postérieure au début. Une note omise lors d’une attribution devient vide ; lors d’un retrait, son omission conserve la note existante.

Le corps JSON est limité à 8 Kio et les champs inconnus sont refusés. La recherche porte sur le nom, l’identifiant de compte et l’e-mail, avec 100 caractères maximum ; `pageSize` accepte de 1 à 100 résultats, 10 par défaut. Un compte absent renvoie `404 ACCOUNT_NOT_FOUND`, une ancienne révision `409 SUBSCRIPTION_CONFLICT` et une saisie invalide `400 INVALID_ACCOUNT_SUBSCRIPTION`.

La représentation administrateur de `subscription` comprend `planCode`, `effectivePlanCode`, `status`, `startsAt`, `endsAt`, `revokedAt`, `note`, `updatedAt` et `revision`. Sans attribution, elle indique `none`, une révision `0`, un `planCode` de présentation `free`, un `effectivePlanCode` nul et des dates nulles. La réponse personnelle expose le même statut sans la note privée.

Le détail administrateur retourne les dix modifications les plus récentes dans `history`, avec `id`, `action` (`assign`, `revoke` ou `migrate`), `actorName`, `planCode`, `startsAt`, `endsAt`, `note` et `createdAt`. Un événement `migrate` contient aussi `previousPlanCode` ; son auteur système s’affiche comme « Migration du catalogue ». Les anciens événements gardent leurs codes Saison ou Structure. Cette limite d’affichage ne supprime pas les événements plus anciens de l’audit.

## Installation et recette

La migration initiale `database/migrations/20260908_account_subscriptions.sql` crée `account_subscriptions` et un index pour son historique dans la table `audit_logs` existante. La migration `database/migrations/20260909_account_subscriptions_catalog.sql` aligne les attributions déjà enregistrées et les contraintes sur le nouveau catalogue. Les API attendent désormais le marqueur `account-subscriptions-catalog-20260909-v1`. Appliquer les migrations manquantes avec le mécanisme existant `npm run db:migrate` ; ne pas modifier les migrations déjà publiées. Aucun secret de paiement supplémentaire n’est nécessaire.

La migration du catalogue :

- convertit `team_season` et `structure` en `team_monthly` pour les profils correspondants ;
- conserve exactement `starts_at`, `ends_at`, `note`, `revoked_at` et `updated_by`, y compris les validités sans fin et les attributions expirées ou retirées ;
- incrémente la révision, actualise `updated_at` et ajoute un événement `account_subscription.migrate` avec les anciennes et nouvelles formules ;
- préserve tous les événements d’audit antérieurs et les demandes commerciales ;
- laisse les Découvertes existantes sans dates : leur statut devient `pending` si elles ne sont pas retirées, sans démarrage rétroactif ou prolongation d’essai ;
- ne crée ni paiement ni droit d’équipe et ne change aucun accès produit.

Une ancienne révision ouverte avant la conversion ne peut pas écraser les attributions migrées : recharger le dossier. Le mécanisme de migrations n’applique chaque fichier qu’une fois ; une nouvelle exécution de `npm run db:migrate` ne renouvelle aucune validité.

Pour la recette, utiliser une base dédiée et les contrôles du dépôt (`npm run verify`). Vérifier les parcours suivants :

- refus des fonctions administrateur sans session ou avec un compte ordinaire ;
- recherche et pagination des profils, puis lecture du compte choisi ;
- attribution des deux formules et refus des anciens codes Saison et Structure ;
- Découverte préparée sans dates, début explicite ou futur, fin calculée à 336 heures et refus des autres durées ;
- nouveaux comptes et Découvertes existantes non démarrés, sans dates créées automatiquement ;
- début atteint, fin exacte atteinte, validité de Pass sans fin et retrait ;
- `effectivePlanCode` nul pour tous les statuts hors `active`, sans retour à un gratuit permanent ;
- conversion des profils Saison et Structure en Pass Équipe avec dates, notes, retraits et ancien historique conservés, audit de migration et révision incrémentée ;
- refus d’un écrasement avec une ancienne révision ;
- conservation de l’auteur, de la note privée et des dates dans l’historique ;
- lecture personnelle limitée à l’utilisateur connecté, sans note ni historique administratif ;
- accès au formulaire au clavier et rendu mobile ;
- conservation des rôles, appartenances, données et accès existants avant lancement, quel que soit le statut d’abonnement.

## Confidentialité et contrôle des accès

Seul l’administrateur plateforme peut rechercher tous les comptes, lire les notes et l’historique administratif, attribuer un abonnement ou le retirer. Les contrôles sont appliqués aux API, indépendamment de la visibilité des boutons.

Un utilisateur connecté peut lire uniquement son propre abonnement depuis Paramètres. Cette réponse personnelle ne contient pas les notes privées ni l’historique administratif. Le fait d’être capitaine, manager ou membre d’une équipe ne donne pas accès aux abonnements des autres profils.

Les attributions et retraits sont audités avec leur auteur et leur date. Conserver cet historique lors de toute évolution vers la facturation en ligne ; ne pas convertir automatiquement une attribution de profil en souscription payante d’équipe.

## Relation avec les demandes d’accès et le paiement

Les demandes d’accès de [la validation commerciale](validation-commerciale.md) restent un parcours séparé. Leur réception ou leur confirmation commerciale n’attribue aucun abonnement. L’administrateur choisit explicitement un compte dans **Profils et abonnements** pour effectuer une attribution.

Seules Découverte et le Pass Équipe sont disponibles pour une attribution manuelle, avec les mêmes libellés tarifaires que dans Tarifs. Le formulaire commercial propose également ces deux offres ; aucun nouveau choix Structure n’est proposé ni accepté. Les codes historiques des demandes et de l’audit restent lisibles. La conversion des anciens profils Structure en Pass Équipe ne met pas en place de facturation centralisée, d’administration de structure ou de droits multi-équipes.

Lors de l’intégration future de Stripe, conserver les abonnements manuels et leur audit. Définir explicitement comment ils coexistent avec les souscriptions d’équipe avant d’en déduire des droits ou des limites produit.
