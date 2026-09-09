# Brief complet à donner à une IA — intégration de la monétisation NXT5

Copier tout le contenu de ce document dans une nouvelle tâche de développement ouverte à la racine du dépôt NXT5.

---

Ce brief prépare une étape de développement ultérieure ; il n’active rien à lui seul. L’état actuel est décrit dans [la validation commerciale](validation-commerciale.md) : Tarifs, son formulaire et le suivi des demandes restent réservés à l’administrateur plateforme. La prévisualisation de lancement présente deux cartes : Découverte, 14 jours d’accès complet sans carte bancaire, et Pass Équipe à 9,90 € TTC par mois et par équipe. Ce prix est une hypothèse à valider. Le formulaire et les choix manuels reprennent uniquement ces deux offres. Le lien pour plusieurs équipes et la demande Structure sont retirés. Aucun essai d’équipe, paiement ou quota commercial n’est actuellement activé ; les accès actuels restent inchangés. L’ouverture publique, l’essai d’équipe et Stripe décrits ci-dessous relèvent d’une future mission expressément lancée.

La décision du 9 septembre 2026 porte sur **tous les outils** : accès complet pendant 14 jours, puis Pass Équipe nécessaire pour continuer. Aucun niveau gratuit permanent ni quota de dix imports n’est prévu ; Champion Pool suit cette règle commune. Le [composant préparé pour les accès Pass](pass-feature-access.md) reste dormant avec `SUBSCRIPTION_RESTRICTIONS_ENABLED = false`. **Ne bloquer aucune fonction tant que les abonnements ne sont pas lancés.** Avant d’activer les restrictions, implémenter et vérifier les dates d’essai, les droits par équipe et les contrôles serveur ; changer cette constante ne suffit pas.

Les [abonnements manuels des profils](abonnements-manuels.md) sont également intégrés et alignés sur le catalogue actuel : seuls Découverte (`free`) et Pass Équipe (`team_monthly`) peuvent être attribués. Une Découverte sans dates reste `pending`, sans essai démarré. L’administrateur peut choisir explicitement un début ; le serveur calcule alors une fin exactement 14 × 24 heures plus tard. Tout statut autre qu’`active` a un `effectivePlanCode` nul, sans retour à un gratuit permanent. La migration du catalogue convertit les attributions Saison et Structure en Pass Équipe en conservant dates, notes, retraits et historique, avec un événement d’audit et une nouvelle révision. Elle ne modifie pas les demandes commerciales historiques. Ces attributions personnelles ne sont pas des souscriptions Stripe et ne changent aucun accès produit avant lancement. Préserve leur état et leur audit. La présente mission porte sur la facturation des équipes ; définis explicitement sa coexistence avec les abonnements de profils avant tout calcul de droits, sans conversion automatique en souscription d’équipe ni rattachement présumé.

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
6. l’essai de 14 jours sans carte bancaire, son expiration et la limite commune de 15 membres sont contrôlés côté serveur ;
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
- Le webhook Stripe est la source de vérité pour l’activation d’une offre payante ; le démarrage et l’expiration de l’essai gratuit dépendent des dates enregistrées côté NXT5.
- Une redirection Checkout réussie ne doit jamais activer un plan à elle seule.
- Toutes les mutations de facturation doivent produire une entrée d’audit exploitable.
- Les migrations doivent être idempotentes et compatibles avec la base existante.
- Préserve les données et changements existants qui ne concernent pas cette mission.
- Utilise les composants d’interface existants avant d’en créer de nouveaux.
- Évite les gros fichiers supplémentaires lorsque le code peut être séparé clairement.

## Modèle commercial à intégrer

La facturation en ligne décrite ici appartient à l’équipe. Le capitaine ou le manager paie pour tous les membres. Elle reste distincte des abonnements manuels déjà attribués aux comptes par l’administrateur.

### Découverte — code de présentation `free`

- 14 jours gratuits, sans carte bancaire ;
- une équipe et 15 membres maximum ;
- tous les outils, comme le Pass Équipe : imports, statistiques, reviews, compositions, tendances, planning, Champion Pool, roster, profils joueurs, historique, exports produit et accès du staff ;
- aucun quota réduit d’imports, de reviews ou de compositions ;
- démarrage explicite par un utilisateur autorisé, enregistré côté serveur ;
- aucun prélèvement ni abonnement payant automatique à la fin ;
- Pass Équipe nécessaire pour continuer à utiliser les outils après expiration ; conservation des données selon la politique retenue, sans accès gratuit permanent aux outils.

Le code `free` reste utile pour la compatibilité du catalogue et des demandes. Il désigne ici une découverte limitée à 14 jours, pas un plan gratuit permanent. Représente distinctement les états non démarré, en essai et expiré. Une demande commerciale et une attribution manuelle à un profil ne démarrent jamais cet essai d’équipe à elles seules, même si l’administrateur a daté la Découverte personnelle. La règle d’éligibilité, le point de départ exact et le traitement des équipes déjà présentes sont à décider avant activation réelle.

### Pass Équipe — `team_monthly`

- 9,90 € TTC par mois et par équipe ;
- renouvellement automatique après souscription explicite ;
- une équipe et 15 membres maximum ;
- tous les outils, dont imports, statistiques, reviews, compositions, tendances, planning, Champion Pool, roster, profils joueurs et historique, sans quota produit artificiel ;
- export des données, rôles et accès du staff, assistance standard ;
- résiliation à tout moment avec accès jusqu’à la fin de la période payée.

Le mensuel est la seule offre achetable au lancement. Ne crée aucun produit, Price Stripe ou Checkout pour les anciennes offres saison, annuelle, fondateur ou Structure.

### Anciennes offres — historique uniquement

Le lien pour plusieurs équipes et le choix `structure` sont retirés de Tarifs et du formulaire. Les nouvelles demandes acceptent uniquement `free` et `team_monthly`, comme les attributions manuelles. Les codes Saison et Structure restent lisibles dans les demandes et audits antérieurs ; ils ne sont ni des choix actuels, ni des plans de facturation, ni des autorisations multi-équipes.

Préserve les demandes et leurs notes, y compris leurs anciennes offres. Ne convertis pas automatiquement une demande Structure en souscription ou en droit. Une éventuelle offre pour plusieurs équipes fera l’objet d’une décision séparée, après validation des besoins ; ses fonctions ne sont pas à construire dans cette mission.

## Comptes et autorisations

Respecte les rôles actuels de `team_members`.

- `captain` : voir la facturation, démarrer l’essai, acheter, ouvrir le portail et résilier ;
- `manager` : voir la facturation, démarrer l’essai, acheter et ouvrir le portail ;
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
STRIPE_PORTAL_CONFIGURATION_ID=
PUBLIC_SITE_URL=
```

Ne préfixe aucune clé secrète avec `VITE_`. Aucun secret Stripe ne doit arriver dans le bundle navigateur.

Ajoute une validation centralisée de la configuration :

- erreur serveur claire si une clé obligatoire manque ;
- liste blanche serveur reliant chaque `plan_code` public au Price ID attendu ;
- seul `team_monthly` figure dans la liste des plans achetables ;
- URL de retour construite uniquement à partir de `PUBLIC_SITE_URL`, pas d’une origine arbitraire envoyée par le navigateur.

Documente dans le README la création des produits et Prices Stripe, la configuration du portail, l’URL du webhook Netlify et les variables à renseigner.

## Schéma PostgreSQL

Ajoute le schéma à `database/schema.sql` et une migration versionnée dans le parcours `npm run db:migrate` existant, sans migration pendant les requêtes. Utilise les types PostgreSQL simples et des contraintes explicites.

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

Contrainte `plan_code` des nouvelles souscriptions Stripe : `team_monthly`. Le modèle personnel `account_subscriptions` conserve seulement `free` et `team_monthly` ; les anciens codes restent lisibles dans son audit, séparément des souscriptions Stripe.

Contrainte `status` compatible avec les statuts utiles de Stripe : `incomplete`, `incomplete_expired`, `trialing`, `active`, `past_due`, `canceled`, `unpaid`, `paused`.

### Table `team_trials`

L’essai est géré côté NXT5, sans carte ni souscription Stripe.

```sql
id uuid primary key default gen_random_uuid()
team_id uuid not null unique references teams(id) on delete restrict
started_by uuid not null references users(id) on delete restrict
started_at timestamptz not null
ends_at timestamptz not null
created_at timestamptz not null default now()
check (ends_at > started_at)
```

Adapter la clé utilisateur à la convention réelle du dépôt. Enregistrer une durée exacte de 14 jours et un événement d’audit lors du démarrage. Un retry ne doit ni doubler ni prolonger l’essai. Ne créer aucune ligne `team_trials` à partir d’une simple visite, demande commerciale ou attribution manuelle de profil, y compris une Découverte personnelle datée. Les règles anti-réinitialisation et la migration éventuelle des équipes existantes doivent être décidées explicitement avant activation.

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

Les droits Stripe sont calculés depuis les souscriptions ; les droits d’essai viennent de `team_trials`. Utilise `team_entitlements` pour les dérogations administratives, promotions ou futurs droits ponctuels, pas pour recopier inutilement chaque plan.

### Index et maintenance

Ajoute les index sur les identifiants Stripe, `team_id`, les statuts et les dates d’expiration. Ajoute le trigger `updated_at` selon la convention existante. Les migrations répétées ne doivent provoquer ni doublon ni perte de données.

## Service central des droits

Crée `netlify/functions/_lib/billing.ts` avec une API interne claire.

Il doit notamment exposer :

```ts
type PlanCode = 'free' | 'team_monthly';

type TeamBillingStatus = {
  teamId: string;
  planCode: PlanCode;
  access: 'not_started' | 'trial' | 'active' | 'grace' | 'expired';
  trialEndsAt: string | null;
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
- `isPaidAccessActive(subscription, now)` ;
- `isTrialActive(trial, now)` ;
- `startTeamTrial(teamId, userId)` avec autorisation, éligibilité et idempotence.

Règles d’accès :

- un essai NXT5 entre `started_at` inclus et `ends_at` exclu donne les mêmes fonctions et la même limite de 15 membres que le mensuel ;
- une souscription Stripe `active` donne l’accès complet ; ne crée pas d’essai Stripe nécessitant une carte pour Découverte ;
- `past_due` donne une grâce de sept jours à partir de la première échéance impayée si cette date peut être déterminée ;
- après la grâce : accès aux outils expiré si aucun autre droit valide ne subsiste ;
- `cancel_at_period_end=true` conserve l’accès jusqu’à `current_period_end` ;
- `canceled`, `unpaid` ou abonnement expiré : Pass requis pour utiliser les outils si aucun autre droit explicite ne subsiste ;
- l’expiration de l’essai ne crée ni prélèvement ni abonnement ;
- une souscription valide prend le relais de l’essai sans réinitialiser sa durée ni supprimer de données ;
- sans accès payant ni essai valide : état non démarré ou expiré, sans niveau gratuit permanent ;
- les parcours de compte, de confidentialité, de sécurité, d’export RGPD et de suppression du compte restent accessibles indépendamment du Pass ;
- une dérogation administrateur doit être explicite, datée et auditée ; les abonnements manuels de profils ne deviennent pas implicitement des dérogations d’équipe.

N’éparpille pas les règles dans les endpoints. Tous doivent appeler ce service.

## Endpoints Netlify à créer

Respecte les helpers actuels `assertSessionSecret`, `requireAuth`, `assertMethod`, `readJson`, `json` et `handleError`.

### `billing-plans.ts` — GET public

Retourne uniquement les offres publiques, leurs montants d’affichage, périodicité, fonctions et codes autorisés. Les montants peuvent être définis dans un catalogue serveur versionné, mais le Price Stripe reste la référence à l’achat.

Ne retourne jamais de clé secrète. Expose Découverte comme essai sans paiement et `team_monthly` comme seule offre achetable. Ne réintroduis pas de contact pour plusieurs équipes dans le catalogue ou le formulaire.

### `billing-trial-start.ts` — POST authentifié

Body : `{ "teamId": "uuid" }`. Vérifier la session, le rôle, l’équipe et l’éligibilité côté serveur ; enregistrer atomiquement le démarrage et l’échéance à 14 jours, puis auditer l’action. Refuser la relance d’un essai terminé selon la règle choisie ; un double clic ou retry retourne le même essai sans extension. N’appelle pas Stripe et ne demande aucune carte. Une soumission du formulaire commercial ne peut pas invoquer implicitement ce parcours.

### `billing-status.ts` — GET authentifié

Entrée : `teamId` en query string.

Retourne `TeamBillingStatus`, les usages utiles et une version filtrée des informations de facturation selon le rôle. Pour un coach, ne retourne ni facture, ni e-mail de facturation, ni identifiant Stripe.

### `billing-checkout-create.ts` — POST authentifié

Body attendu :

```json
{
  "teamId": "uuid",
  "planCode": "team_monthly"
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
8. créer Checkout en mode `subscription` pour le mensuel ;
9. inclure `team_id`, `plan_code` et `initiated_by` dans les métadonnées Stripe ;
10. utiliser une clé d’idempotence stable par tentative contrôlée ;
11. limiter le nombre de créations par utilisateur et équipe ;
12. retourner uniquement `{ url }`.

Refuse explicitement `free`, `structure` et les anciens codes saison, annuel et fondateur : ils ne doivent créer aucune session Checkout. Le début d’un abonnement avant la fin de l’essai doit faire apparaître clairement la date du premier paiement ; ne déclenche jamais Checkout automatiquement à l’expiration de Découverte.

### `billing-portal-create.ts` — POST authentifié

Body : `{ "teamId": "uuid" }`.

- vérifier le rôle ;
- vérifier l’existence du Customer ;
- créer une session Stripe Customer Portal ;
- utiliser `/abonnement` comme retour ;
- retourner `{ url }`.

La configuration du portail doit autoriser mise à jour du moyen de paiement, consultation des factures et résiliation. Désactive les changements de formule : seul le mensuel est commercialisé au lancement.

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
- ne pas inventer les dates : récupérer/synchroniser la Subscription Stripe.

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

- consigner le remboursement et le rapprocher du paiement concerné ;
- appliquer la politique de remboursement décidée : un remboursement ne résilie pas automatiquement une souscription Stripe ;
- conserver un audit et signaler les cas nécessitant une décision, sans supprimer les données d’équipe.

## Application des droits côté serveur

Lors de la future activation, protège l’utilisation de tous les outils de l’équipe, en lecture comme en écriture, par un essai valide, une souscription valide ou une dérogation d’équipe explicite. Cela couvre notamment imports, reviews, exports produit, tendances, compositions, Champion Pool, planning, statistiques, roster et profils joueurs. Préserve les données existantes ; leur conservation ne signifie pas que les outils restent utilisables gratuitement. Ne crée aucun quota commercial de dix imports ni aucun niveau gratuit permanent. Les endpoints de compte, sécurité, confidentialité et droits sur les données suivent leurs autorisations actuelles indépendamment du Pass.

### Création d’équipe et essai

Dans `teams-create.ts` et le démarrage d’essai, appliquer la règle d’éligibilité décidée, sans permettre de renouveler indéfiniment un essai par recréation ou transfert d’équipe. Le forfait couvre une équipe ; une personne peut rejoindre d’autres équipes sans payer un accès individuel. Ne modifier les droits des équipes existantes qu’après avoir documenté leur transition.

### Membres

Avant l’ajout ou l’acceptation d’une invitation, compter les membres actuels et appliquer la même limite de 15 pendant l’essai ou le mensuel. Ne bloque pas le départ ou la suppression d’un membre. Gérer les ajouts concurrents atomiquement.

### Tous les outils de l’équipe

Pendant les 14 jours et pendant une période payée valide, proposer tous les outils sans quotas commerciaux réduits. Les protections techniques existantes contre les abus restent applicables. Une correction ou un réimport du même match garde son comportement actuel. Les exports produit sont inclus dans les deux offres ; les distinguer des exports de données personnelles et autres parcours de droits sur les données qui restent accessibles après expiration.

### Expiration

Si aucun droit valide ne subsiste :

- ne rien supprimer ;
- conserver les données selon la politique retenue sans continuer à exposer les outils gratuitement ;
- autoriser les parcours de compte, de sécurité, de confidentialité, d’export RGPD et de suppression du compte ;
- bloquer l’accès aux outils en lecture et en écriture, y compris les appels API directs ;
- afficher l’échéance atteinte et proposer la souscription ou la régularisation ;
- ne jamais empêcher l’accès à la page de facturation ou au portail.

Les erreurs API doivent utiliser le statut HTTP `402` ou `403` de manière cohérente dans tout le projet et inclure un code stable, par exemple :

```json
{
  "error": "Les 14 jours de Découverte sont terminés.",
  "code": "TEAM_ACCESS_EXPIRED",
  "upgradePath": "/abonnement"
}
```

Réserver `PLAN_LIMIT_REACHED` à une limite réellement atteinte, comme les 15 membres. Choisis un statut et documente-le. Le front doit se baser sur `code`, pas analyser le texte.

## Routage et pages React

Étends proprement le routeur existant et ses listes `PUBLIC_ROUTES`, `NAV` ou équivalentes.

### `/tarifs` — public

Adapter la page de prévisualisation existante pour cette future ouverture publique, en conservant une présentation responsive comprenant :

- titre : « Choisis la formule adaptée à ton équipe » ;
- carte Découverte : 14 jours d’accès complet, sans carte bancaire, une équipe et jusqu’à 15 membres ;
- carte Pass Équipe : 9,90 € TTC par mois et par équipe, jusqu’à 15 membres, résiliable à tout moment ;
- formulaire limité à Découverte et au Pass Équipe, sans lien ni choix Structure ;
- prix TTC clairement visibles ;
- mêmes fonctions listées pour l’essai et le mensuel ;
- CTA adapté à l’état connecté ;
- FAQ sur essai sans carte, fin des 14 jours, membres, renouvellement, résiliation, factures et données ;
- lien vers CGV, CGU et confidentialité.

N’affiche aucune carte ni offre achetable Saison, Structure, annuelle ou fondateur. Ne réintroduis pas le lien de contact pour plusieurs équipes ni le choix Structure. Ne promets pas de fonctions multi-équipes disponibles. N’ajoute ni faux témoignage, ni compte à rebours, ni réduction artificielle.

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
- CTA pour démarrer l’essai, souscrire ou régulariser selon l’état ;
- dates de l’essai et mention de l’absence de prélèvement automatique à son terme.

Pour coach/analyste autorisé à voir le statut : afficher uniquement l’offre et sa validité. Pour les autres rôles : refuser la route et revenir vers l’équipe.

### Intégration dans l’application

- ajouter « Abonnement » dans la zone Paramètres/Gestion, sans surcharger la navigation principale ;
- afficher un badge discret « Découverte », « Équipe » ou « Expiré » ;
- réutiliser le composant `PassFeatureGate` et sa présentation `PassFeaturePreview`, après raccordement à des droits d’équipe validés côté serveur ;
- après expiration, afficher le décor flouté et un message contextualisé invitant à prendre le Pass Équipe ; ne jamais charger ou monter des données protégées sous un simple flou CSS ;
- lors d’une erreur `PLAN_LIMIT_REACHED` ou `TEAM_ACCESS_EXPIRED`, ouvrir un message clair adapté à la limite ou à l’échéance, avec lien vers `/abonnement` ;
- ne pas parsemer de bannières d’achat sur toutes les pages ;
- ne jamais cacher les fonctions de suppression, sécurité ou gestion du compte derrière un paywall.

## États d’interface à prévoir

Chaque page de facturation doit gérer :

- chargement ;
- aucune équipe ;
- rôle insuffisant ;
- essai non démarré ;
- essai de 14 jours actif ;
- Checkout en cours ;
- paiement en confirmation ;
- actif ;
- fin de période programmée ;
- paiement échoué avec grâce ;
- accès aux outils expiré après grâce ;
- essai expiré sans souscription ;
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
- essai de 14 jours sans carte et sans prélèvement automatique ;
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
- essai démarré ;
- rappel avant fin de l’essai ;
- essai expiré ;
- remboursement confirmé.

Exigences :

- idempotence pour éviter les doublons lors des retries webhook ;
- aucun détail bancaire ;
- liens construits depuis `PUBLIC_SITE_URL` ;
- texte et HTML ;
- adresse de support configurable ;
- distinction entre notification nécessaire au service et marketing.

Pour le rappel de fin d’essai, utiliser une Scheduled Function quotidienne ou un mécanisme existant. Enregistrer l’envoi afin de ne pas répéter le message chaque jour.

## Administration

Étendre l’administration existante avec une section facturation en lecture seule :

- essais non démarrés, actifs et expirés ;
- souscriptions actives ;
- `past_due` ;
- résiliations en fin de période ;
- paiements échoués récents ;
- revenu récurrent mensuel estimé ;
- revenu encaissé sur 30 jours si calculable proprement ;
- répartition par plan.

Ne présente pas une estimation comme un montant comptable. N’affiche pas d’adresse complète, données de carte ou informations inutiles. La section de facturation en lecture seule ne remplace pas **Profils et abonnements**, qui conserve ses fonctions d’attribution et de retrait. Préserve les notes privées, les révisions et l’audit des abonnements manuels de profils, y compris les validités de Pass sans date de fin et les Découvertes préparées sans dates. Une Découverte démarrée garde sa durée exacte de 14 jours. Toute nouvelle dérogation aux droits d’une équipe doit avoir motif, auteur, date de fin et audit.

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
- `trial_started` ;
- `trial_expired`.

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
- passage de l’essai à une souscription sans remise à zéro ;
- grâce de sept jours ;
- fin de période après résiliation ;
- démarrage idempotent et expiration exacte des 14 jours d’essai ;
- mapping Price ID vers plan ;
- filtrage des données selon le rôle.

### Tests des endpoints

- utilisateur non connecté ;
- équipe étrangère ;
- rôle interdit ;
- plan inconnu ;
- proposition Structure refusée à la création de Checkout ;
- anciens plans saison, annuel et fondateur refusés à la création de Checkout ;
- configuration Stripe manquante ;
- Checkout récurrent ;
- démarrage d’essai sans Stripe ni carte ;
- relance d’un essai interdit et retry sans prolongation ;
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
- remboursement complet ;
- erreur temporaire suivie d’un retry.

### Tests des droits

- même accès complet pour un essai valide et le mensuel actif ;
- tous les outils accessibles pendant l’essai, dont Champion Pool, tendances et planning ; plus de dix imports et plusieurs reviews/compositions autorisés ;
- 15e membre accepté, 16e refusé, y compris ajouts concurrents ;
- après 14 jours sans droit valide : outils inaccessibles, sans paiement automatique ni niveau gratuit permanent ;
- données existantes conservées ; parcours de compte, de sécurité, de confidentialité, d’export RGPD et de suppression du compte accessibles ;
- un nouveau navigateur, un retry ou un changement de propriétaire ne remet pas les dates à zéro ;
- appel direct API refusé comme l’interface lorsqu’aucun droit n’est valide ;
- aucune demande commerciale ou attribution manuelle de profil ne démarre implicitement l’essai d’équipe.

### Tests React

- tarifs publics ;
- sélection d’offre ;
- deux cartes visibles, à 14 jours sans carte et 9,90 €/mois/équipe, avec les mêmes choix dans le formulaire et aucun lien pour plusieurs équipes ;
- redirection connexion avec retour ;
- choix d’équipe ;
- confirmation en attente puis confirmée ;
- essai non démarré, actif, expiré, puis abonnement actif, résilié et `past_due` ;
- rôle insuffisant ;
- affichage de `PassFeatureGate` avec `PassFeaturePreview`, sans montage du contenu protégé ;
- avant lancement, les fonctions réelles restent accessibles, sans flou ni démarrage automatique d’essai, quelle que soit l’attribution manuelle de profil ;
- navigation clavier et libellés accessibles.

### Validation finale

Exécuter :

```bash
npm run verify
git diff --check
```

Effectuer également un parcours Stripe Test manuel complet avec Stripe CLI :

```bash
stripe listen --forward-to http://localhost:8888/.netlify/functions/stripe-webhook
```

Tester au minimum paiement réussi, carte refusée, renouvellement, `invoice.payment_failed`, résiliation, remboursement et essai de 14 jours sans carte (expiration simulée). Documenter les commandes utilisées sans inclure de secret.

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
4. démarrage d’essai et service central de droits avec tests ;
5. intégration Stripe serveur et mocks ;
6. Checkout et portail ;
7. webhook idempotent ;
8. statut et factures ;
9. droits, limite de membres et expiration sur les endpoints existants ;
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
- compte Stripe et identifiant Price mensuel réel ;
- règle d’éligibilité et point de départ de l’essai, traitement des équipes existantes et politique de conservation à son terme.

La durée de 14 jours, l’absence de carte, l’accès complet jusqu’à 15 membres et le mensuel à 9,90 € TTC sont déjà retenus pour la proposition de lancement ; ne réintroduis pas les anciennes formules pour combler une décision manquante.

Tu peux achever toute l’intégration en mode Test sans ces valeurs. Tu ne dois pas activer le Live Mode ni publier des CGV contenant des données inventées.

## Critères d’acceptation

La mission est terminée seulement si :

- les pages `/tarifs`, `/achat`, `/achat/confirme`, `/achat/annule`, `/abonnement` et `/conditions-vente` sont accessibles selon leurs règles ;
- les deux cartes s’affichent correctement : Découverte, 14 jours d’accès complet sans carte, et Pass Équipe à 9,90 € TTC/mois/équipe ;
- Tarifs, son formulaire et les choix manuels utilisent les deux offres actuelles ; aucun lien de contact multi-équipe ni nouveau choix Structure n’est proposé, et les anciennes demandes ainsi que leur audit restent lisibles ;
- les attributions manuelles de profils, leurs dates et leur audit sont préservés, sans conversion automatique en souscriptions d’équipe ;
- Checkout Test fonctionne pour le mensuel uniquement ;
- le webhook signé est idempotent ;
- un essai valide et une souscription active donnent les mêmes fonctions et la limite de 15 membres côté serveur ;
- l’essai expire après 14 jours sans prélèvement automatique et sans remise à zéro implicite ;
- à l’expiration sans droit valide, tous les outils exigent le Pass, dont Champion Pool ; aucun niveau gratuit permanent ou quota de dix imports n’est ajouté ;
- compte, sécurité, confidentialité, export RGPD et suppression du compte restent accessibles indépendamment du Pass ;
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
