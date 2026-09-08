# Brief complet à donner à une IA — intégration de la monétisation NXT5

Copier tout le contenu de ce document dans une nouvelle tâche de développement ouverte à la racine du dépôt NXT5.

---

Ce brief prépare une étape de développement ultérieure. L’état actuel est décrit dans [la validation commerciale](validation-commerciale.md) : Tarifs, son formulaire et le suivi des demandes restent réservés à l’administrateur plateforme. La prévisualisation comprend Découverte, Pass Équipe, Pass Saison et Pass Structure. L’ajout du Pass Structure couvre sa présentation et le recueil de besoins ; il n’ouvre ni collecte publique, ni paiement, ni outils multi-équipes. L’ouverture publique et Stripe décrits ci-dessous relèvent de la future mission de monétisation.

## Mission

Intègre de bout en bout la monétisation de NXT5 dans le projet existant. Tu dois livrer une implémentation fonctionnelle, testée et documentée en mode Stripe Test. Ne te limite pas à créer des maquettes : le paiement, les webhooks, les droits, les limites côté serveur, les pages publiques, la facturation et les tests doivent fonctionner ensemble.

NXT5 est une application React 18 + Vite + Tailwind, hébergée sur Netlify, avec des Netlify Functions TypeScript, une base Neon PostgreSQL et une authentification maison par cookie HttpOnly et sessions en base.

Lis d’abord entièrement les fichiers d’instructions du dépôt, puis inspecte l’architecture, les helpers d’authentification, les conventions des fonctions Netlify, le routage, les composants d’interface et les tests existants. Préserve le style visuel et le ton direct déjà utilisés. Ne réécris pas l’application et n’introduis pas un second système d’authentification.

## Résultat attendu

À la fin du travail :

1. un visiteur peut consulter les tarifs ;
2. un utilisateur connecté autorisé peut acheter une offre pour son équipe ;
3. Stripe Checkout encaisse le paiement ;
4. un webhook signé met à jour la base ;
5. les droits de l’équipe sont calculés côté serveur ;
6. les limites de l’offre gratuite sont appliquées sur les endpoints concernés ;
7. le payeur peut gérer l’abonnement et télécharger ses factures via Stripe Customer Portal ;
8. l’application gère correctement renouvellement, résiliation, échec de paiement et expiration ;
9. les pages et e-mails utilisent un français sobre, sans faux argument marketing ;
10. les tests et le build de production passent.

## Contraintes de travail

- Travaille sur une branche dédiée, par exemple `feat/billing`.
- N’effectue aucun paiement réel et n’utilise que Stripe Test pendant le développement.
- Ne pousse pas et ne déploie pas sans demande explicite.
- Ne stocke jamais de numéro de carte, CVC ou payload Stripe complet en base.
- Ne fais jamais confiance au prix, au plan, au rôle ou au statut transmis par le navigateur.
- Tous les contrôles d’autorisation et de quota doivent exister côté serveur.
- Le webhook Stripe est la source de vérité pour l’activation d’une offre.
- Une redirection Checkout réussie ne doit jamais activer un plan à elle seule.
- Toutes les mutations de facturation doivent produire une entrée d’audit exploitable.
- Les migrations doivent être idempotentes et compatibles avec la base existante.
- Préserve les données et changements existants qui ne concernent pas cette mission.
- Utilise les composants d’interface existants avant d’en créer de nouveaux.
- Évite les gros fichiers supplémentaires lorsque le code peut être séparé clairement.

## Modèle commercial à intégrer

La facturation appartient à l’équipe, pas au compte individuel. Le capitaine ou le manager paie pour tous les membres.

### Offre `free`

- gratuite ;
- une équipe créée par compte ;
- 10 membres maximum dans l’équipe ;
- 5 games importées au total ;
- 3 reviews maximum ;
- 1 composition maximum ;
- statistiques essentielles ;
- pas d’historique supprimé automatiquement lors d’un downgrade.

### Offre `team_monthly`

- 29 € TTC par mois ;
- renouvellement automatique ;
- une équipe ;
- 15 membres maximum ;
- imports, reviews, compositions, planning, champion pools et historique sans quota produit artificiel ;
- export des données ;
- résiliation à tout moment avec accès jusqu’à la fin de la période payée.

### Offre `team_yearly`

- 290 € TTC par an ;
- renouvellement automatique ;
- mêmes droits que `team_monthly`.

### Offre `team_season`

- 169 € TTC ;
- paiement unique ;
- accès pendant six mois à compter du paiement confirmé ;
- aucun renouvellement automatique ;
- mêmes droits fonctionnels que `team_monthly` pendant la période active.

### Offre `founder_monthly`

- 19 € TTC par mois ;
- offre non affichée publiquement ;
- attribuable seulement via un Price Stripe configuré et une autorisation explicite côté serveur ;
- mêmes droits que `team_monthly` ;
- ne jamais accepter un simple `plan_code=founder_monthly` venant du client.

### Proposition `structure` — Pass Structure sur devis

- à partir de 79 € TTC par mois, avec périmètre et prix final à définir sur devis ;
- besoins envisagés : plusieurs équipes sous une même organisation, facturation centralisée, administrateur de structure, vue multi-équipe et accompagnement à l’installation ;
- aucun nombre d’équipes ou de membres, quota d’usage ou niveau d’accompagnement fixé sans validation du besoin.

La carte du Pass Structure, son option dans le formulaire et son suivi administrateur sont déjà intégrés à la prévisualisation commerciale interne. Conserve ce recueil de besoins et sa distinction avec les offres achetables. Une intention Structure ne peut être confirmée manuellement qu’après acceptation du périmètre, du devis et du payeur ; la confirmation compte pour une organisation et n’active aucun droit. Le code `structure` appartient au catalogue des propositions et aux demandes d’accès ; à ce stade, il ne doit pas devenir un Price Stripe, un plan de facturation ou une autorisation produit.

Le paiement Structure, la facturation centralisée et les outils d’administration multi-équipes restent à développer dans une étape ultérieure, après validation du Pass Équipe et de prospects réels. Ne construis pas ces fonctions dans la présente mission de paiement des offres équipe ; n’associe pas automatiquement une demande Structure à une souscription ou à des droits multi-équipes.

## Comptes et autorisations

Respecte les rôles actuels de `team_members`.

- `captain` : voir la facturation, acheter, changer de formule, ouvrir le portail et résilier ;
- `manager` : voir la facturation, acheter et ouvrir le portail ;
- `coach`, `assistant`, `analyst`, `board` : voir uniquement le nom de l’offre et son statut, sans facture ni information de paiement ;
- `player`, `viewer`, `member` : aucun accès à la facturation ;
- administrateur plateforme : consulter les statuts et identifiants techniques nécessaires au support, mais aucune donnée de carte.

Pour chaque endpoint, récupère le rôle depuis PostgreSQL. N’accepte jamais le rôle envoyé dans le body.

Une personne peut appartenir à plusieurs équipes, chacune avec son propre statut de facturation. Changer d’équipe active doit recalculer les droits affichés.

Quitter une équipe ne résilie pas son offre. Supprimer une équipe ayant un accès payant actif doit être bloqué avec un message demandant de résilier d’abord. Le transfert de propriété ne doit pas exposer les factures à l’ancien ou au nouveau propriétaire sans vérification.

## Dépendances et configuration Stripe

Ajoute le SDK officiel `stripe` aux dépendances de production et verrouille une version compatible avec le runtime Node utilisé par Netlify. Centralise l’initialisation dans `netlify/functions/_lib/stripe.ts`.

Variables serveur :

```text
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_TEAM_MONTHLY=
STRIPE_PRICE_TEAM_YEARLY=
STRIPE_PRICE_TEAM_SEASON=
STRIPE_PRICE_FOUNDER_MONTHLY=
STRIPE_PORTAL_CONFIGURATION_ID=
PUBLIC_SITE_URL=
```

Ne préfixe aucune clé secrète avec `VITE_`. Aucun secret Stripe ne doit arriver dans le bundle navigateur.

Ajoute une validation centralisée de la configuration :

- erreur serveur claire si une clé obligatoire manque ;
- liste blanche serveur reliant chaque `plan_code` public au Price ID attendu ;
- `founder_monthly` absent de la liste publique ;
- URL de retour construite uniquement à partir de `PUBLIC_SITE_URL`, pas d’une origine arbitraire envoyée par le navigateur.

Documente dans le README la création des produits et Prices Stripe, la configuration du portail, l’URL du webhook Netlify et les variables à renseigner.

## Schéma PostgreSQL

Ajoute le schéma à `database/schema.sql` et une migration runtime idempotente dans les helpers existants. Utilise les types PostgreSQL simples et des contraintes explicites.

### Table `billing_customers`

```sql
id uuid primary key default gen_random_uuid()
team_id uuid not null unique references teams(id) on delete restrict
stripe_customer_id text not null unique
billing_email text
legal_name text
billing_address jsonb not null default '{}'::jsonb
country_code text
tax_id_display text
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

`tax_id_display` est uniquement une valeur destinée à l’affichage si elle est nécessaire. Ne stocke pas un secret fiscal non requis. La donnée de référence reste chez Stripe.

### Table `billing_subscriptions`

```sql
id uuid primary key default gen_random_uuid()
team_id uuid not null unique references teams(id) on delete restrict
billing_customer_id uuid not null references billing_customers(id) on delete restrict
stripe_subscription_id text unique
stripe_price_id text not null
plan_code text not null
status text not null
current_period_start timestamptz
current_period_end timestamptz
cancel_at_period_end boolean not null default false
canceled_at timestamptz
latest_invoice_id text
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

Contrainte `plan_code` : `team_monthly`, `team_yearly`, `founder_monthly`.

Contrainte `status` compatible avec les statuts utiles de Stripe : `incomplete`, `incomplete_expired`, `trialing`, `active`, `past_due`, `canceled`, `unpaid`, `paused`.

### Table `billing_orders`

Cette table représente notamment le Pass Saison à paiement unique.

```sql
id uuid primary key default gen_random_uuid()
team_id uuid not null references teams(id) on delete restrict
billing_customer_id uuid not null references billing_customers(id) on delete restrict
stripe_checkout_session_id text unique
stripe_payment_intent_id text unique
stripe_price_id text not null
plan_code text not null check (plan_code in ('team_season'))
status text not null check (status in ('pending','paid','refunded','expired','failed'))
access_start timestamptz
access_end timestamptz
amount_total integer
currency text
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

### Table `billing_events`

```sql
id uuid primary key default gen_random_uuid()
stripe_event_id text not null unique
event_type text not null
team_id uuid references teams(id) on delete set null
status text not null check (status in ('processing','processed','failed','ignored'))
attempt_count integer not null default 1
last_error text
created_at timestamptz not null default now()
processed_at timestamptz
```

N’enregistre pas le payload complet. Si quelques métadonnées sont indispensables au diagnostic, conserve uniquement une sélection non sensible dans un champ JSON limité.

### Table `team_entitlements`

```sql
id uuid primary key default gen_random_uuid()
team_id uuid not null references teams(id) on delete cascade
feature_key text not null
value jsonb not null
source text not null
valid_until timestamptz
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
unique(team_id, feature_key, source)
```

Les droits Stripe peuvent être calculés depuis les souscriptions et commandes. Utilise `team_entitlements` pour les dérogations administratives, promotions ou futurs droits ponctuels, pas pour recopier inutilement chaque plan.

### Index et maintenance

Ajoute les index sur les identifiants Stripe, `team_id`, les statuts et les dates d’expiration. Ajoute le trigger `updated_at` selon la convention existante. Les migrations répétées ne doivent provoquer ni doublon ni perte de données.

## Service central des droits

Crée `netlify/functions/_lib/billing.ts` avec une API interne claire.

Il doit notamment exposer :

```ts
type PlanCode = 'free' | 'team_monthly' | 'team_yearly' | 'team_season' | 'founder_monthly';

type TeamBillingStatus = {
  teamId: string;
  planCode: PlanCode;
  access: 'active' | 'grace' | 'read_only' | 'expired';
  stripeStatus: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  canManageBilling: boolean;
  limits: {
    members: number | null;
    importedMatches: number | null;
    reports: number | null;
    compositions: number | null;
    exportEnabled: boolean;
  };
};
```

Fonctions attendues :

- `getTeamBillingStatus(teamId, userId)` ;
- `getEffectivePlan(teamId, now)` ;
- `getPlanLimits(planCode)` ;
- `requireBillingViewer(teamId, userId)` ;
- `requireBillingManager(teamId, userId, action)` ;
- `assertTeamEntitlement(teamId, featureKey, context?)` ;
- `getTeamUsage(teamId)` ;
- `isPaidAccessActive(subscriptionOrOrder, now)`.

Règles d’accès :

- `active` et `trialing` donnent l’accès complet ;
- `past_due` donne une grâce de sept jours à partir de la première échéance impayée si cette date peut être déterminée ;
- après la grâce : lecture seule ;
- `cancel_at_period_end=true` conserve l’accès jusqu’à `current_period_end` ;
- `canceled`, `unpaid` ou abonnement expiré : lecture seule ;
- un Pass Saison payé est actif entre `access_start` et `access_end` ;
- si plusieurs accès coexistent, retenir celui qui donne la date valide la plus lointaine ;
- sans accès payant valide : plan `free` ;
- une dérogation administrateur doit être explicite, datée et auditée.

N’éparpille pas les règles dans les endpoints. Tous doivent appeler ce service.

## Endpoints Netlify à créer

Respecte les helpers actuels `assertSessionSecret`, `requireAuth`, `assertMethod`, `readJson`, `json` et `handleError`.

### `billing-plans.ts` — GET public

Retourne uniquement les offres publiques, leurs montants d’affichage, périodicité, fonctions et codes autorisés. Les montants peuvent être définis dans un catalogue serveur versionné, mais le Price Stripe reste la référence à l’achat.

Ne retourne jamais de clé secrète ni le Founder Price. Le Pass Structure reste une proposition sur devis dans le catalogue de présentation ; il n’appartient pas au catalogue de facturation ni à la liste blanche des plans achetables.

### `billing-status.ts` — GET authentifié

Entrée : `teamId` en query string.

Retourne `TeamBillingStatus`, les usages utiles et une version filtrée des informations de facturation selon le rôle. Pour un coach, ne retourne ni facture, ni e-mail de facturation, ni identifiant Stripe.

### `billing-checkout-create.ts` — POST authentifié

Body attendu :

```json
{
  "teamId": "uuid",
  "planCode": "team_monthly | team_yearly | team_season"
}
```

Étapes obligatoires :

1. valider le body et l’UUID ;
2. charger l’utilisateur et son rôle depuis la base ;
3. vérifier qu’il peut acheter pour cette équipe ;
4. résoudre le Price ID depuis la liste blanche serveur ;
5. retrouver ou créer un Customer Stripe associé à l’équipe ;
6. enregistrer ou mettre à jour `billing_customers` ;
7. empêcher une deuxième souscription récurrente active ;
8. créer Checkout en mode `subscription` pour mensuel/annuel ;
9. créer Checkout en mode `payment` pour le Pass Saison ;
10. inclure `team_id`, `plan_code` et `initiated_by` dans les métadonnées Stripe ;
11. utiliser une clé d’idempotence stable par tentative contrôlée ;
12. limiter le nombre de créations par utilisateur et équipe ;
13. retourner uniquement `{ url }`.

Pour le Pass Saison, crée une commande `pending` avant ou au moment de Checkout et lie son identifiant aux métadonnées. Ne calcule les six mois d’accès qu’après paiement confirmé.

Refuse explicitement `planCode=structure` : une demande de devis ne doit jamais créer de session Checkout ni activer d’accès payant.

### `billing-portal-create.ts` — POST authentifié

Body : `{ "teamId": "uuid" }`.

- vérifier le rôle ;
- vérifier l’existence du Customer ;
- créer une session Stripe Customer Portal ;
- utiliser `/abonnement` comme retour ;
- retourner `{ url }`.

La configuration du portail doit autoriser mise à jour du moyen de paiement, consultation des factures et résiliation. Les changements de plan ne doivent être activés que si leur comportement de prorata a été choisi et testé. Pour la première version, autorise la résiliation mais effectue les changements de formule depuis NXT5 ou désactive-les.

### `billing-invoices.ts` — GET authentifié

- réservé à `captain` et `manager` ;
- retourne une liste minimale : identifiant, date, montant, devise, statut, URL de facture hébergée et PDF ;
- pagination limitée ;
- ne stocke pas les PDF dans NXT5.

### `stripe-webhook.ts` — POST public signé

Exigences :

- lire le corps brut ;
- vérifier `stripe-signature` avec `STRIPE_WEBHOOK_SECRET` avant tout parsing métier ;
- refuser une signature invalide ;
- insérer `billing_events` avec unicité sur `stripe_event_id` ;
- retourner 2xx à un événement déjà traité ;
- traiter chaque événement dans une transaction PostgreSQL quand les écritures sont liées ;
- marquer l’événement `processed`, `ignored` ou `failed` ;
- ne jamais loguer de secret ou de payload complet ;
- répondre rapidement et de manière compatible avec les retries Stripe.

Événements minimums :

#### `checkout.session.completed`

- valider les métadonnées ;
- vérifier que le Price/plan attendu correspond à la session ;
- lier Customer et équipe ;
- pour le Pass Saison payé : passer la commande à `paid`, fixer `access_start` à la date du paiement et `access_end` à six mois calendaires plus tard ;
- pour une souscription : ne pas inventer les dates, récupérer/synchroniser la Subscription Stripe.

#### `customer.subscription.created` et `customer.subscription.updated`

- synchroniser Price, plan, statut, période et annulation ;
- refuser silencieusement les Prices inconnus en les signalant comme erreur de configuration sans accorder de droit ;
- mettre à jour l’audit.

#### `customer.subscription.deleted`

- conserver l’historique ;
- passer le statut à `canceled` ;
- ne pas supprimer les données de l’équipe.

#### `invoice.paid`

- synchroniser l’abonnement ;
- lever un éventuel état de grâce ;
- déclencher l’e-mail de confirmation seulement de façon idempotente.

#### `invoice.payment_failed`

- synchroniser le statut ;
- enregistrer le début de grâce ;
- créer une notification utilisateur ;
- envoyer un e-mail au contact de facturation avec un lien vers NXT5, jamais un lien forgé depuis le payload.

#### `charge.refunded`

- pour un Pass Saison entièrement remboursé, mettre la commande à `refunded` et retirer l’accès futur ;
- pour un remboursement partiel, conserver l’accès et signaler le cas à l’administration, sauf règle commerciale contraire documentée.

## Application des quotas côté serveur

Ajoute les contrôles sans casser la lecture des données existantes.

### Création d’équipe

Dans `teams-create.ts`, une offre gratuite permet à un compte de posséder une équipe. Un compte déjà propriétaire d’une équipe doit recevoir une erreur structurée s’il tente d’en créer une autre, sauf dérogation future.

### Membres

Avant l’ajout ou l’acceptation d’une invitation, compter les membres actuels et appliquer la limite 10 ou 15. Ne bloque pas le départ ou la suppression d’un membre.

### Imports

Avant la création définitive d’une nouvelle game, compter les games distinctes de l’équipe. L’offre gratuite s’arrête à cinq. Une correction ou un nouvel import du même match ne doit pas consommer artificiellement un quota supplémentaire.

### Reviews

Bloquer seulement la création d’une quatrième review gratuite. Autoriser modification, suppression et consultation des trois existantes.

### Compositions

Bloquer seulement la création d’une deuxième composition gratuite. Autoriser modification, suppression et consultation de l’existante.

### Export

Réserver l’export enrichi à une offre payante, mais maintenir l’accès légal aux données personnelles et à la suppression du compte. Ne transforme pas une fonction RGPD nécessaire en option payante.

### Downgrade et expiration

Si l’équipe dépasse les quotas gratuits :

- ne rien supprimer ;
- garder les données consultables ;
- autoriser suppression et export réglementaire ;
- bloquer les nouvelles créations ;
- afficher ce qui doit être réduit ou proposer le renouvellement ;
- ne jamais empêcher l’accès à la page de facturation ou au portail.

Les erreurs API de quota doivent utiliser le statut HTTP `402` ou `403` de manière cohérente dans tout le projet et inclure un code stable, par exemple :

```json
{
  "error": "Le quota gratuit de cinq games est atteint.",
  "code": "PLAN_LIMIT_REACHED",
  "feature": "matches",
  "limit": 5,
  "upgradePath": "/abonnement"
}
```

Choisis un statut et documente-le. Le front doit se baser sur `code`, pas analyser le texte.

## Routage et pages React

Étends proprement le routeur existant et ses listes `PUBLIC_ROUTES`, `NAV` ou équivalentes.

### `/tarifs` — public

Adapter la page de prévisualisation existante pour cette future ouverture publique, en conservant une présentation responsive comprenant :

- titre : « Choisis la formule adaptée à ton équipe » ;
- carte Découverte ;
- carte Pass Équipe avec choix mensuel/annuel ;
- carte Pass Saison ;
- carte Pass Structure « sur devis, à partir de 79 € TTC par mois », orientée vers le recueil de besoins ;
- prix TTC clairement visibles ;
- fonctions réellement incluses pour les offres achetables, besoins envisagés clairement identifiés pour Structure ;
- CTA adapté à l’état connecté ;
- FAQ sur membres, renouvellement, résiliation, factures, données et Pass Saison ;
- lien vers CGV, CGU et confidentialité.

L’offre Founder ne doit jamais apparaître. Le Pass Structure garde un parcours de contact ou de demande de devis, sans bouton d’achat ni redirection vers `/achat`. Ne promets pas de fonctions multi-équipes disponibles. N’ajoute ni faux témoignage, ni compte à rebours, ni réduction artificielle.

### `/achat` — authentifié

Étape intermédiaire avant Checkout :

- offre choisie ;
- équipe facturée ;
- sélecteur d’équipe limité aux équipes gérables ;
- création d’équipe si aucune n’existe ;
- résumé du prix, périodicité et renouvellement ;
- case d’acceptation des CGV avec version et horodatage ;
- bouton « Continuer vers le paiement » ;
- état de chargement et gestion d’erreur.

Enregistre l’acceptation des CGV associée à l’achat dans une table ou un journal d’audit avec version. Ne réutilise pas aveuglément l’acceptation générale des CGU.

### `/achat/confirme` — public mais contenu protégé

- lire `session_id` dans l’URL uniquement pour demander un statut serveur ;
- ne jamais afficher d’information d’une autre équipe ;
- afficher « Paiement en cours de confirmation » tant que le webhook n’a pas fini ;
- faire quelques rafraîchissements bornés, puis proposer de revenir plus tard ;
- afficher l’offre, l’équipe, la période et un bouton vers l’application une fois confirmée ;
- ne pas activer le plan dans cette page.

Créer au besoin un endpoint `billing-checkout-status` qui vérifie utilisateur, session et équipe.

### `/achat/annule` — public

- expliquer qu’aucun changement n’a été appliqué ;
- retour aux tarifs ;
- conserver la possibilité de reprendre l’achat.

### `/abonnement` — authentifié

Pour capitaine/manager :

- offre et statut ;
- période actuelle ;
- renouvellement ou date de fin ;
- bannière de grâce ou paiement échoué ;
- usage et limites ;
- coordonnées de facturation disponibles ;
- liste paginée des factures ;
- bouton « Gérer la facturation » ;
- CTA pour acheter ou renouveler ;
- mention claire pour le Pass Saison sans renouvellement.

Pour coach/analyste autorisé à voir le statut : afficher uniquement l’offre et sa validité. Pour les autres rôles : refuser la route et revenir vers l’équipe.

### Intégration dans l’application

- ajouter « Abonnement » dans la zone Paramètres/Gestion, sans surcharger la navigation principale ;
- afficher un badge discret « Gratuit », « Équipe » ou « Saison » ;
- créer un composant commun `PlanLimitNotice` ;
- lors d’une erreur `PLAN_LIMIT_REACHED`, ouvrir un message clair avec lien vers `/abonnement` ;
- ne pas parsemer de bannières d’achat sur toutes les pages ;
- ne jamais cacher les fonctions de suppression, sécurité ou gestion du compte derrière un paywall.

## États d’interface à prévoir

Chaque page de facturation doit gérer :

- chargement ;
- aucune équipe ;
- rôle insuffisant ;
- gratuit ;
- Checkout en cours ;
- paiement en confirmation ;
- actif ;
- fin de période programmée ;
- paiement échoué avec grâce ;
- lecture seule après grâce ;
- Pass Saison actif ;
- Pass Saison expiré ;
- erreur Stripe temporaire ;
- configuration serveur manquante.

Les boutons externes Stripe doivent annoncer clairement la redirection. Désactive les doubles clics et rends les actions accessibles au clavier.

## CGV et conformité

Créer une route `/conditions-vente` avec une structure complète, mais placer visiblement les informations juridiques inconnues sous forme de constantes/configuration à compléter avant production. Ne fabrique aucune identité légale, adresse, numéro d’entreprise ou numéro de TVA.

Inclure les sections :

- vendeur ;
- objet ;
- clients concernés ;
- prix TTC/HT et taxes ;
- commande ;
- paiement ;
- fourniture du service ;
- renouvellement ;
- résiliation ;
- Pass Saison ;
- remboursement ;
- droit de rétractation et commencement immédiat du service numérique ;
- disponibilité ;
- responsabilité ;
- données personnelles ;
- propriété intellectuelle ;
- droit applicable et litiges ;
- contact.

Ajoute un avertissement dans la documentation : validation obligatoire par un juriste/comptable avant production. Ne présente pas le texte généré comme un avis juridique.

Ajouter une version de CGV, par exemple `2026-09-05`, configurable dans un fichier central. La preuve d’acceptation doit contenir utilisateur, équipe, version, date, plan et identifiant Checkout.

## E-mails et notifications

Réutilise l’infrastructure e-mail existante.

Créer des templates sobres pour :

- achat confirmé ;
- renouvellement payé ;
- paiement échoué ;
- résiliation programmée ;
- fin du Pass Saison dans 14 jours ;
- Pass Saison expiré ;
- remboursement confirmé.

Exigences :

- idempotence pour éviter les doublons lors des retries webhook ;
- aucun détail bancaire ;
- liens construits depuis `PUBLIC_SITE_URL` ;
- texte et HTML ;
- adresse de support configurable ;
- distinction entre notification nécessaire au service et marketing.

Pour le rappel Pass Saison, utiliser une Scheduled Function quotidienne ou un mécanisme existant. Enregistrer l’envoi afin de ne pas répéter le message chaque jour.

## Administration

Étendre l’administration existante avec une section facturation en lecture seule :

- équipes gratuites ;
- souscriptions actives ;
- Pass Saison actifs ;
- `past_due` ;
- résiliations en fin de période ;
- paiements échoués récents ;
- revenu récurrent mensuel estimé ;
- revenu encaissé sur 30 jours si calculable proprement ;
- répartition par plan.

Ne présente pas une estimation comme un montant comptable. N’affiche pas d’adresse complète, données de carte ou informations inutiles. Toute dérogation manuelle d’accès doit avoir motif, auteur, date de fin et audit.

## Analytics respectueux des données

Instrumenter uniquement :

- `pricing_viewed` ;
- `plan_selected` ;
- `checkout_started` ;
- `checkout_completed` ;
- `billing_portal_opened` ;
- `plan_limit_reached` ;
- `subscription_cancel_scheduled` ;
- `payment_failed` ;
- `season_pass_expiring`.

Ne jamais envoyer Riot ID, nom de joueur, contenu de review, note du coach, composition ou statistique de game. Utiliser des identifiants internes pseudonymisés si une corrélation est indispensable.

## Sécurité

Vérifier explicitement :

- authentification et rôle sur chaque endpoint privé ;
- appartenance de l’équipe ;
- liste blanche des plans et Prices ;
- validation UUID et tailles de chaînes ;
- rate limiting de Checkout et Portal ;
- CSRF selon le modèle de cookie actuel et les protections déjà présentes ;
- vérification cryptographique du webhook sur corps brut ;
- idempotence des sessions, événements et e-mails ;
- absence de secret dans les logs et réponses ;
- URLs de redirection internes sûres ;
- refus d’un Customer Stripe appartenant à une autre équipe ;
- transactions SQL sur les mises à jour liées ;
- gestion des courses entre Checkout, webhook et consultation du statut ;
- impossibilité de contourner un quota en appelant directement une Function.

## Tests automatisés

Conserve tous les tests actuels et ajoute des tests ciblés.

### Tests unitaires

- catalogue des plans ;
- calcul des limites ;
- calcul de l’accès effectif ;
- priorité entre souscription et Pass Saison ;
- grâce de sept jours ;
- fin de période après résiliation ;
- expiration du Pass Saison ;
- mapping Price ID vers plan ;
- filtrage des données selon le rôle.

### Tests des endpoints

- utilisateur non connecté ;
- équipe étrangère ;
- rôle interdit ;
- plan inconnu ;
- proposition Structure refusée à la création de Checkout ;
- Founder plan demandé publiquement ;
- configuration Stripe manquante ;
- Checkout récurrent ;
- Checkout saison ;
- seconde souscription active ;
- ouverture du portail ;
- pagination des factures.

Mocke Stripe : aucun test automatisé ne doit contacter l’API réelle.

### Tests webhook

- signature absente ou invalide ;
- événement valide ;
- même événement reçu deux fois ;
- Price inconnu ;
- session sans métadonnées ;
- création/mise à jour/suppression d’abonnement ;
- facture payée ;
- paiement échoué ;
- Pass Saison payé ;
- remboursement complet ;
- erreur temporaire suivie d’un retry.

### Tests des quotas

- 5e import gratuit accepté, 6e refusé ;
- réimport/correction sans double comptage ;
- 3e review acceptée, 4e refusée ;
- modification et suppression toujours permises ;
- 10e membre accepté, 11e refusé ;
- plan actif sans quotas ;
- plan expiré en lecture seule ;
- appel direct API refusé comme l’interface.

### Tests React

- tarifs publics ;
- sélection d’offre ;
- quatre cartes visibles, dont Pass Structure avec un parcours de recueil de besoins sans paiement ;
- redirection connexion avec retour ;
- choix d’équipe ;
- confirmation en attente puis confirmée ;
- abonnement gratuit, actif, résilié et `past_due` ;
- rôle insuffisant ;
- affichage de `PlanLimitNotice` ;
- navigation clavier et libellés accessibles.

### Validation finale

Exécuter :

```bash
npm test
npm run build
git diff --check
```

Effectuer également un parcours Stripe Test manuel complet avec Stripe CLI :

```bash
stripe listen --forward-to http://localhost:8888/.netlify/functions/stripe-webhook
```

Tester au minimum paiement réussi, carte refusée, renouvellement, `invoice.payment_failed`, résiliation et remboursement du Pass Saison. Documenter les commandes utilisées sans inclure de secret.

## Documentation à livrer

Mettre à jour ou créer :

- `README.md` : variables et démarrage local ;
- `docs/billing-setup.md` : configuration Stripe détaillée ;
- `docs/billing-operations.md` : remboursements, support, incidents et rapprochement ;
- `.env.example` sans valeur secrète ;
- documentation des plans et quotas ;
- checklist avant passage en Live Mode.

La checklist production doit contenir :

- identité légale complétée ;
- CGV validées ;
- TVA validée avec un comptable ;
- produits et Prices Live créés séparément ;
- clés Live configurées dans Netlify ;
- webhook Live configuré et testé ;
- portail client Live configuré ;
- domaine et e-mails vérifiés ;
- politique de remboursement décidée ;
- sauvegarde/restauration Neon vérifiée ;
- alertes sur webhooks échoués et paiements échoués ;
- achat réel de faible montant puis remboursement contrôlé avant ouverture publique.

## Ordre d’implémentation imposé

Procède par petits lots vérifiables :

1. audit du dépôt et note des risques ;
2. catalogue des plans et configuration ;
3. migration PostgreSQL ;
4. service central de droits avec tests ;
5. intégration Stripe serveur et mocks ;
6. Checkout et portail ;
7. webhook idempotent ;
8. statut et factures ;
9. quotas sur les endpoints existants ;
10. pages publiques ;
11. pages achat et abonnement ;
12. notifications et e-mails ;
13. administration et analytics ;
14. tests de régression, build et parcours Stripe Test ;
15. documentation et checklist de production.

Après chaque lot, exécute les tests concernés. Ne masque jamais un test cassé et n’affaiblis pas les contrôles de sécurité pour faire passer la suite.

## Décisions à ne pas inventer

Si ces informations ne sont pas fournies, utilise des placeholders clairement bloquants et liste-les dans le compte rendu final :

- raison sociale ou nom légal du vendeur ;
- forme juridique ;
- adresse ;
- SIREN/SIRET ;
- numéro de TVA ;
- e-mail de support ;
- politique exacte de remboursement ;
- pays ouverts à la vente ;
- traitement fiscal TTC/HT ;
- compte Stripe et identifiants Price réels.

Tu peux achever toute l’intégration en mode Test sans ces valeurs. Tu ne dois pas activer le Live Mode ni publier des CGV contenant des données inventées.

## Critères d’acceptation

La mission est terminée seulement si :

- les pages `/tarifs`, `/achat`, `/achat/confirme`, `/achat/annule`, `/abonnement` et `/conditions-vente` sont accessibles selon leurs règles ;
- les quatre familles d’offres s’affichent correctement : Découverte, Pass Équipe (mensuel/annuel), Pass Saison et Pass Structure sur devis ;
- le Pass Structure reste un recueil de besoins, sans Checkout, droits activés ni fonctions multi-équipes ajoutées ;
- Checkout Test fonctionne pour mensuel, annuel et saison ;
- le webhook signé est idempotent ;
- une souscription active et un Pass Saison payé donnent les bons droits ;
- les quotas gratuits sont réellement bloqués côté serveur ;
- aucune donnée existante n’est supprimée lors d’une expiration ;
- Stripe Customer Portal fonctionne ;
- les factures sont visibles uniquement par les rôles autorisés ;
- aucun secret Stripe n’est présent dans le front, Git ou les logs ;
- les événements critiques sont audités ;
- tous les tests existants et nouveaux passent ;
- le build Vite réussit ;
- la configuration locale et production est documentée ;
- le compte rendu final indique les fichiers modifiés, les migrations, les tests réalisés, les risques restants et les informations juridiques encore nécessaires.

## Format du compte rendu final attendu de l’IA

Termine par un rapport court et précis :

1. résultat livré ;
2. architecture retenue ;
3. pages et endpoints ajoutés ;
4. règles de quotas appliquées ;
5. tests automatiques et manuels exécutés ;
6. variables à configurer ;
7. étapes Stripe Dashboard restantes ;
8. placeholders juridiques à compléter ;
9. limites ou risques connus ;
10. confirmation explicite indiquant si le code a été poussé ou déployé.

---

## Informations complémentaires sur le projet actuel

Les fichiers importants à examiner incluent au minimum :

- `package.json` ;
- `database/schema.sql` ;
- `netlify/functions/_lib/auth.ts` ;
- `netlify/functions/_lib/db.ts` ;
- `netlify/functions/_lib/http.ts` ;
- `netlify/functions/_lib/migrations.ts` ;
- `netlify/functions/teams-create.ts` ;
- les fonctions d’invitation, d’import, de reviews et de compositions ;
- `src/api/client.js` ;
- `src/app/constants.jsx` ;
- `src/app/routing.js` ;
- `src/pages/public/PublicPages.jsx` ;
- `src/pages/admin/AdminDashboard.jsx` ;
- `src/AppContent.jsx` ;
- les tests de sécurité, workflow et pages légales.

Le projet possède déjà des utilisateurs, des sessions, des équipes, des membres et des rôles. Réutilise-les. L’objectif est d’ajouter une couche de facturation fiable, pas de remplacer les fondations existantes.
