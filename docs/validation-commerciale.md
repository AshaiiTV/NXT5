# NXT5 — validation commerciale avant paiement

Préparation de la phase 1 du [plan de financement](plan-financement.md), mise à jour le 9 septembre 2026.

**Tarifs et demandes d’accès : prévisualisation interne réservée à l’administrateur plateforme.** Ces pages et leurs API sont accessibles uniquement avec ce compte. La collecte publique est fermée : les visiteurs et les comptes ordinaires ne peuvent ni consulter ces pages ni envoyer de demande. L’ouverture aux équipes demandera une décision et une modification explicites ultérieures.

Une fonction distincte permet à l’administrateur d’[attribuer manuellement Découverte ou le Pass Équipe à un profil](abonnements-manuels.md) depuis `/admin/abonnements`. Découverte reste non démarrée sans dates, ou dure exactement 14 jours à partir d’un début explicitement choisi ; le serveur calcule sa fin. Les anciens Pass Saison et Structure des profils sont convertis en Pass Équipe avec leurs validités et leur audit conservés. Le titulaire consulte sa formule et son statut dans son compte. Ces attributions ne dépendent pas du formulaire commercial et n’encaissent aucun paiement ; les rôles et accès produit restent inchangés avant lancement.

## Ce qui est intégré

- `/tarifs`, en prévisualisation administrateur, présente deux cartes : **Découverte, 14 jours d’accès complet sans carte bancaire**, puis **Pass Équipe, 9,90 € TTC par mois et par équipe, résiliable à tout moment**, pour continuer à utiliser les outils. Les deux couvrent une équipe de 15 membres maximum avec tous les outils : imports, reviews, exports produit, tendances, compositions, Champion Pool, planning, statistiques, roster et profils joueurs. Le prix reste une hypothèse à valider auprès des premières équipes. Aucun niveau gratuit permanent ni quota commercial de dix imports n’est prévu.
- Le lien « Plusieurs équipes ? Parlons de tes besoins » mène au formulaire d’échange avec le choix Structure. Aucun tarif ni fonction multi-équipe à développer n’est promis. Pass Saison, Pass Structure, annuel et fondateur sont hors de la grille de lancement. Les codes des anciennes demandes commerciales restent conservés ; ils sont distincts du catalogue d’attribution manuelle, limité à Découverte et au Pass Équipe.
- « Demander un accès » sélectionne Découverte ou le Pass Équipe et mène au formulaire de prévisualisation. Seul l’administrateur peut le soumettre ; les demandes sont enregistrées dans Neon après contrôle de ses droits et validation côté serveur. Ce formulaire ne demande aucune carte, ne démarre aucun essai de 14 jours et n’attribue aucun abonnement. Aucun paiement ni nouveau quota commercial n’est activé : les accès actuels restent inchangés. L’attribution manuelle d’un profil se fait séparément dans **Profils et abonnements**.
- Le formulaire préparé pour une ouverture future comprend le contact, l’e-mail, l’équipe ou la structure, le rôle, l’offre ou le besoin, le payeur envisagé et l’intention déclarée. Pour plusieurs équipes, il sert à préciser l’organisation et ses besoins dans le message facultatif, sans assimiler cet échange à l’acceptation d’un tarif. L’accord porte uniquement sur le recontact lié à cette demande, sans newsletter. Pour la recette interne, utiliser des coordonnées fictives et supprimer les demandes de test.
- `/admin/demandes-acces` : consultation paginée, filtre par statut, notes privées, statut de suivi et suppression. L’accès est contrôlé côté serveur avec l’administration plateforme existante.
- La page Confidentialité décrit les données collectées et leur conservation. Le consentement est enregistré avec la version `access-request-2026-09-08` et une date serveur.
- Un aperçu isolé du futur masquage se trouve dans les détails de `/tarifs`, réservés à l’administrateur. Il montre un décor flouté et le message du Pass pour l’outil sélectionné ; son bouton sélectionne le Pass dans le formulaire existant. Aucun paiement ni changement d’accès n’est déclenché. Le [guide des accès Pass](pass-feature-access.md) décrit son fonctionnement : **les outils réels restent entièrement accessibles avant lancement**.

## Installer et vérifier la prévisualisation interne

La publication passe par la fusion de la branche vérifiée dans `main`, puis par le déploiement de production Netlify. Un push sur une branche de travail ne met pas à jour `nxt5.org`.

Après publication, ouvrir `/admin` avec le compte administrateur plateforme : les boutons « Voir les tarifs » et « Demandes d’accès » donnent accès aux nouvelles pages. Leurs URL directes sont `/tarifs` et `/admin/demandes-acces`.

1. Exécuter `npm run verify` avec Node 24.
2. Pour une recette complète, utiliser une base dédiée et `npm run db:migrate` avec sa connexion. Ne jamais utiliser les identifiants de production pour les tests.
3. Démarrer les fonctions avec le serveur Netlify local (`npm run dev`). Vite seul ne fournit ni la vérification de session ni les API nécessaires aux nouvelles pages réservées à l’administrateur.
4. Sans session, puis avec un compte ordinaire, vérifier que les nouvelles pages `/tarifs` et `/admin/demandes-acces` ne sont pas accessibles, y compris par URL directe, et qu’aucun lien vers elles n’est proposé. Vérifier aussi le refus d’un appel direct à `POST access-requests` et aux méthodes `GET`, `POST` et `DELETE` d’`admin-access-requests` : 401 sans session, 403 avec un compte ordinaire. Aucun enregistrement ne doit être créé ou modifié.
5. Avec le compte administrateur configuré, vérifier l’accès aux deux pages et aux deux cartes de lancement. Tester la sélection de Découverte puis du Pass Équipe, ainsi que le lien « Plusieurs équipes ? Parlons de tes besoins ». Vérifier la durée de 14 jours, l’accès complet jusqu’à 15 membres, le prix de 9,90 € TTC/mois/équipe et l’absence d’anciennes cartes ou de tarif pour plusieurs équipes. Vérifier validation des champs, confirmation d’enregistrement de demandes fictives et conservation du choix Structure dans le suivi. Tester filtre, pagination, note, statut et suppression. Aucun de ces parcours ne doit démarrer un essai, un paiement ou une fonction multi-équipe. Vérifier également le rendu mobile.
6. Vérifier un échec serveur : aucune confirmation d’enregistrement, réponses conservées pour réessayer. Avec le compte administrateur, renvoyer la même demande ne doit ni la dupliquer ni réécrire les coordonnées et les notes existantes.
7. Dans les détails de prévisualisation du masquage, sélectionner les différents outils et vérifier le message de 14 jours puis Pass, le tarif et le bouton de sélection du Pass. Vérifier le rendu sur mobile et au clavier. L’aperçu utilise seulement des formes décoratives ; aucune donnée réelle d’équipe n’est masquée sous le flou.
8. Avec un compte sans abonnement, vérifier que les outils réels restent accessibles avant lancement, y compris Champion Pool, planning et plus de dix imports. Aucun minuteur d’essai, limite commerciale, flou ou appel de paiement ne doit apparaître dans l’usage normal. Les autorisations de rôle et de sécurité existantes continuent de s’appliquer.

Au prochain déploiement de production, la commande existante `npm run verify && npm run db:migrate` applique les migrations manquantes avant publication : la migration initiale `database/migrations/20260908_access_requests.sql`, puis `database/migrations/20260908_access_requests_structure.sql`, qui ajoute `structure` aux offres autorisées sans modifier les demandes existantes. Les migrations publiées restent immuables. Les API de demandes attendent désormais le marqueur `pricing-access-requests-structure-20260908-v1` et répondent temporairement 503 s’il manque ; les routes de compte et d’équipe n’attendent pas ce nouveau marqueur.

Aucun secret Stripe ou prestataire de paiement n’est nécessaire. Les connexions Neon et les variables `PLATFORM_ADMIN_USER_ID` / `PLATFORM_ADMIN_EMAIL` déjà utilisées par l’administration gardent leurs règles actuelles.

Validation de la prévisualisation initiale, avant ajout du Pass Structure : après intégration des dernières modifications de `main`, les contrôles TypeScript, tests et build de production ont été exécutés dans un checkout isolé. La recette locale limitait Vitest à deux workers pour éviter les dépassements de délai liés à la charge de la machine ; les 379 tests de la suite puis les 35 tests API, dont cinq nouveaux cas Unicode, ont réussi. Les tests d’API et de migration exécutent les requêtes SQL sur PostgreSQL embarqué PGlite. Ils vérifient le refus des visiteurs et comptes ordinaires, l’autorisation de l’administrateur et l’absence de lecture du formulaire ou de consommation du quota avant autorisation. Les tests de routage utilisent le fournisseur de chargement partagé : Tarifs libère cet écran dès la session administrateur validée, sans attendre les données de l’espace équipe. La CI et Netlify exécutent `npm run verify` avant publication.

Dans Chromium, les trois profils ont été contrôlés avec des réponses de session simulées : connexion requise pour les visiteurs, refus pour les comptes ordinaires, accès aux deux pages pour l’administrateur, aucun aperçu pendant la vérification de session. Les deux pages ont aussi été contrôlées à 360, 390, 768, 1024 et 1440 pixels, sans débordement horizontal ni erreur JavaScript. Aucune base Neon externe n’a été migrée ou utilisée pour cette recette ; le fonctionnement sur l’environnement déployé reste à vérifier lors de la publication.

## Contrat des API

| Fonction | Usage |
| --- | --- |
| `POST /.netlify/functions/access-requests` | Administration uniquement, pour la prévisualisation interne. Champs `contactName`, `email`, `teamName`, `role`, `planCode`, `payer`, `purchaseIntent`, `message`, `consent: true`, `website` (piège anti-robot facultatif). Réponse uniforme `{ "ok": true }` après enregistrement ou si doublon. |
| `GET /.netlify/functions/admin-access-requests` | Administration uniquement. Paramètres `page`, `pageSize` et `status` facultatif ; renvoie demandes, pagination et compteurs globaux. |
| `POST /.netlify/functions/admin-access-requests` | Administration uniquement. `{ "id": "…", "status": "…", "adminNote": "…" }` met à jour le suivi et mémorise l’auteur et la date de dernière modification. |
| `DELETE /.netlify/functions/admin-access-requests` | Administration uniquement. `{ "id": "…" }` supprime la demande et toutes ses notes. |

Toutes ces API exigent la session de l’administrateur plateforme ; le contrôle est réalisé côté serveur, indépendamment de la visibilité des liens. Elles refusent les visiteurs sans session et les comptes ordinaires.

Le champ `planCode` accepte `free`, `team_monthly`, `team_season` et `structure`. Les choix de la nouvelle grille et du formulaire sont `free`, `team_monthly` et le contact `structure` ; `team_season` reste accepté pour compatibilité avec les demandes et API historiques. Le code `free` identifie désormais la proposition d’essai de 14 jours, sans le démarrer. Dans une demande d’accès, le code `structure` identifie un besoin à qualifier sans prix annoncé ; il n’accorde aucun droit produit et n’est pas un code de paiement. L’administration des abonnements de profils accepte uniquement `free` et `team_monthly`. La migration des anciennes attributions Saison et Structure en Pass Équipe ne modifie aucune demande commerciale et ne la convertit pas en abonnement ou essai.

Les soumissions du formulaire sont limitées à 12 Kio, le nom de contact à 80 caractères, l’e-mail à 160, le nom d’équipe à 100 et le message à 2 000. Les notes administrateur sont limitées à 4 000 caractères. Les choix sont contrôlés par liste autorisée, les mutations intersites refusées et les soumissions limitées à cinq par dix minutes et par IP via une empreinte stockée par le limiteur existant.

L’unicité repose sur l’e-mail et le nom normalisé de l’équipe ou de la structure, transmis dans le champ `teamName`. Un nouvel envoi autorisé ne modifie pas la demande initiale ; une soumission anonyme est refusée. L’administrateur peut consigner une correction dans les notes ou supprimer la demande pour permettre une nouvelle soumission. Aucun e-mail n’est envoyé automatiquement.

La fonction Netlify planifiée `access-requests-cleanup` s’exécute à 03:15 UTC chaque jour en production. Elle supprime les demandes créées depuis au moins six mois, notes et coordonnées comprises. Un changement de statut ne repousse pas cette date. Les compteurs portent donc sur les demandes encore conservées. Contrôler l’exécution de cette fonction dans les journaux Netlify après publication.

## Après une future ouverture : conduire les dix échanges

Cette étape commerciale reste à lancer après la décision d’ouvrir la collecte aux équipes. La prévisualisation actuelle et ses demandes fictives ne constituent pas des retours commerciaux ; supprimer ces demandes avant le suivi réel.

Lors de cette étape, présenter NXT5 à dix équipes réelles, sans inventer de contacts ou de retours. Pour chaque échange, partir de leur organisation actuelle, montrer un import et une review, puis présenter les tarifs validés pour cette ouverture.

Questions à poser :

1. Quels outils utilisent-ils pour les games, le planning et les reviews ? Quel problème veulent-ils résoudre en premier ?
2. Après 14 jours d’accès complet sans carte bancaire, le Pass Équipe à 9,90 € TTC par mois pour toute l’équipe leur conviendrait-il ? Quels usages faudrait-il valider pendant l’essai et quelles réserves restent-elles sur le prix ?
3. Qui déciderait et qui paierait : capitaine, manager, équipe ou association ?
4. À quelle date voudraient-ils démarrer ? Qu’est-ce qui les empêcherait d’acheter au lancement ?

Pour un échange concernant plusieurs équipes, préciser leur nombre, les besoins de coordination et de facturation, le responsable de l’organisation et l’accompagnement attendu. Aucun montant n’est annoncé à ce stade. Consigner les besoins dans les notes existantes sans promettre de fonctions disponibles ni de quotas non définis ; une offre éventuelle fera l’objet d’une décision ultérieure.

Consigner dans les notes la date, la formule, le prix accepté, le payeur et les réserves. Un message « oui » dans le formulaire est un indice, pas encore une validation commerciale.

| Statut | Quand l’utiliser |
| --- | --- |
| Nouvelle demande | Formulaire reçu, échange encore à organiser. |
| Offre présentée | L’échange a eu lieu ; décision encore en attente. |
| Intention confirmée après échange | L’équipe a confirmé après échange son intérêt pour le Pass Équipe à 9,90 € TTC/mois et identifié qui paierait. Documenter le montant et la date dans les notes. Un échange sur plusieurs équipes ne valide pas automatiquement cette offre. Ce statut n’active aucun droit. |
| Offre présentée, sans suite | L’échange a eu lieu et l’équipe ne poursuit pas ; noter pourquoi. |

Les compteurs administrateur existants utilisent des équipes ou organisations distinctes d’après leur nom normalisé et peuvent encore inclure des confirmations historiques Saison ou Structure. Les contacts multiples d’une même équipe ou structure ne sont pas additionnés ; deux organisations qui utilisent exactement le même nom seront regroupées et doivent être vérifiées manuellement. La nouvelle grille ne modifie pas ces règles techniques ni les données déjà enregistrées.

Pour évaluer le lancement à 9,90 €, vérifier les notes et ne retenir que les intentions récentes confirmant explicitement ce mensuel, son montant et le payeur. Une ancienne confirmation à un autre prix ou pour une autre formule ne valide pas la nouvelle hypothèse. Les demandes de Découverte et les échanges pour plusieurs équipes restent des signaux d’intérêt, sans compter automatiquement parmi ces trois intentions d’achat.

## Quand passer au paiement

Attendre dix présentations et au moins trois intentions confirmées d’équipes distinctes pour le Pass Équipe à 9,90 € TTC par mois, avec date, montant et payeur documentés. Si ces critères ne sont pas remplis, utiliser les réserves recueillies pour revoir l’offre. Après activation effective des essais et des paiements, mesurer aussi l’usage pendant les 14 jours, les conversions volontaires et les renouvellements : une intention n’est pas encore un revenu récurrent.

L’étape suivante reste celle du [brief d’intégration paiement](brief-integration-paiement-ia.md) : décisions commerciales et fiscales, conditions de vente, essai serveur de 14 jours sans carte, prix mensuel en mode test, facturation, Checkout, webhooks et droits serveur. Le catalogue de cette phase décrit seulement les propositions commerciales : il ne doit jamais être utilisé comme autorisation d’accès ou source de prix transmise au paiement.
