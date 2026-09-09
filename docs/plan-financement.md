# Plan de financement et de monétisation de NXT5

Version de travail — septembre 2026

## 1. Objectif

Le premier objectif n’est pas de maximiser le revenu. Il est de couvrir les frais fixes de NXT5, puis de financer son amélioration sans dégrader l’expérience des joueurs.

Le produit doit être vendu à l’équipe. Le capitaine ou le manager paie et invite les autres membres. Un joueur ne doit pas avoir à acheter son propre accès pour rejoindre une équipe déjà abonnée.

## 2. Offre de lancement retenue

Décision du 8 septembre 2026 : simplifier la grille en deux cartes, pour permettre aux premières équipes de tester NXT5 avant de s’engager. **9,90 € reste une hypothèse commerciale à valider auprès d’équipes réelles**, pas un prix déjà validé par des clients.

La page et le formulaire restent une prévisualisation réservée à l’administrateur plateforme. Cette évolution de la proposition commerciale n’active ni paiement, ni essai chronométré, ni nouveaux droits ou quotas. **Les abonnements ne sont pas lancés : ne bloquer aucune fonction aujourd’hui**, quel que soit le profil ou le nombre d’imports. Les parcours de paiement et règles d’accès décrits plus bas constituent une étape future.

Décision du 9 septembre 2026 : **Découverte donne accès à tous les outils pendant 14 jours, puis le Pass Équipe est nécessaire pour continuer à utiliser NXT5**. Il n’y a pas de niveau gratuit permanent ni de quota de dix imports ; Champion Pool suit la même règle que les autres outils. Le [périmètre des fonctions Pass](pass-feature-access.md) détaille le masquage flouté préparé, actuellement désactivé, et les contrôles serveur nécessaires avant lancement.

### Découverte — 14 jours gratuits, sans carte bancaire

- Une équipe et jusqu’à 15 membres.
- Accès complet aux mêmes fonctions que le Pass Équipe pendant 14 jours : imports, statistiques, reviews, planning, champion pools, compositions, tendances, historique, export et accès du staff.
- Aucun quota commercial d’imports, de compositions ou de reviews pendant l’essai ; les limites techniques contre les abus restent applicables.
- Aucun prélèvement automatique à la fin : le passage au Pass Équipe exige une souscription explicite.

Le futur essai doit permettre d’éprouver le produit sur plusieurs sessions. Sa demande dans la prévisualisation ne le démarre pas.

### Pass Équipe — 9,90 € TTC par mois et par équipe

- Une équipe et jusqu’à 15 membres.
- Accès à tous les outils : imports, reviews, compositions, tendances, exports produit, Champion Pool, statistiques, planning, roster, profils joueurs et historique.
- Aucun quota commercial réduit d’imports, de reviews ou de compositions.
- Gestion des rôles et accès du staff.
- Assistance standard.
- Résiliation à tout moment, avec accès jusqu’à la fin de la période payée.

### Plusieurs équipes : échange sur les besoins

Le lien « Plusieurs équipes ? Parlons de tes besoins » mène au formulaire d’échange, avec le choix Structure. Aucun prix ni fonction multi-équipe à venir n’est promis. Ce parcours sert à comprendre le nombre d’équipes, leur organisation et leurs besoins avant de définir une éventuelle offre.

Pass Saison, Pass Structure, annuel et tarif fondateur sont retirés de la commercialisation de lancement. Les codes et attributions manuelles historiques sont conservés pour compatibilité ; ils ne constituent ni de nouvelles offres achetables ni des droits Stripe.

## 3. Positionnement commercial

Le message principal : « Tout le suivi de ton équipe LoL au même endroit. »

NXT5 ne doit pas être présenté comme une IA qui gagne les drafts ou remplace le coach. Le produit vend du temps gagné, des données rangées et un suivi partagé.

Arguments concrets :

- retrouver les games et les reviews sans multiplier les fichiers ;
- garder les champion pools à jour ;
- préparer une session avec le même support pour tout le staff ;
- conserver l’historique quand le roster change.

## 4. Futurs parcours d’essai et d’achat

### Essai Découverte, après activation du parcours

- Le capitaine ou le manager démarre explicitement les 14 jours d’essai pour son équipe.
- Les dates de début et de fin sont enregistrées côté serveur, sans collecte de carte bancaire.
- Les droits fonctionnels sont ceux du Pass Équipe, dans la limite de 15 membres.
- Le service affiche la date de fin et propose une souscription explicite au mensuel.
- À l’expiration, le Pass Équipe devient nécessaire pour continuer à utiliser les outils ; les données sont conservées et aucun paiement n’est créé automatiquement. Les fonctions de compte, de sécurité et de droits sur les données restent accessibles.
- La règle d’éligibilité à un nouvel essai et le traitement des équipes existantes doivent être décidés avant activation, sans réinitialisation implicite.

### Achat depuis le site public

1. Le visiteur ouvre `/tarifs`.
2. Il compare les 14 jours de Découverte et le Pass Équipe mensuel à 9,90 € TTC par équipe.
3. Il clique sur « Choisir le Pass Équipe ».
4. S’il n’est pas connecté, il crée son compte ou se connecte.
5. Il choisit une équipe existante dont il est capitaine ou en crée une.
6. Une fonction serveur crée une session Stripe Checkout.
7. Stripe collecte le paiement et les informations de facturation.
8. Stripe renvoie vers `/achat/confirme?session_id=...`.
9. L’accès n’est activé qu’après réception et validation du webhook Stripe.
10. La page confirmée affiche l’équipe, l’offre et la prochaine échéance.

### Depuis l’application

- Une page `/abonnement` affiche l’offre de l’équipe, les limites, l’échéance et le payeur.
- Après lancement uniquement, les outils sans essai ou Pass valide affichent un aperçu décoratif flouté et un message contextualisé, par exemple « Prends le Pass Équipe pour accéder aux reviews », avec accès au parcours d’abonnement. Aucun contenu protégé réel ne doit être chargé sous le flou.
- Le bouton « Gérer la facturation » ouvre le portail client Stripe.
- Le propriétaire peut mettre à jour la carte, télécharger ses factures ou résilier.

## 5. Pages à créer ou modifier lors de l’intégration future

### Pages publiques

#### `/tarifs`

- Deux cartes : Découverte, 14 jours sans carte bancaire, et Pass Équipe, 9,90 € TTC par mois et par équipe.
- Prix TTC et durée de l’essai clairement affichés.
- Lien « Plusieurs équipes ? Parlons de tes besoins » vers le formulaire, sans tarif annoncé.
- Liste factuelle des fonctions incluses.
- FAQ : renouvellement, résiliation, membres, conservation des données, remboursement et factures.
- CTA d’essai ou de souscription adapté au parcours réellement activé. Tant que la validation commerciale est interne, conserver « Demander un accès » et expliquer qu’aucun essai ne démarre.
- Aucun faux compteur, fausse réduction urgente ou témoignage inventé.

#### `/conditions-vente`

- Identité du vendeur.
- Prix et taxes.
- Moyens de paiement.
- Date d’effet du service.
- Renouvellement et résiliation.
- Remboursements.
- Droit de rétractation applicable aux contenus/services numériques.
- Disponibilité, responsabilité et support.

Le texte final doit être validé par un professionnel du droit selon le statut de l’entreprise et les pays vendus.

#### `/achat/confirme`

- État de traitement du paiement.
- Offre achetée et équipe concernée.
- Lien vers l’équipe.
- Lien vers la facture quand elle est disponible.
- Message spécifique si le webhook est encore en cours.

#### `/achat/annule`

- Confirmation qu’aucun changement n’a été appliqué.
- Retour aux tarifs.
- Aucun message culpabilisant.

### Pages connectées

#### `/abonnement`

- Offre actuelle.
- Statut : actif, en essai, paiement à régulariser, résilié ou expiré.
- Période couverte.
- Moyen de paiement masqué.
- Historique des factures.
- Bouton vers le portail Stripe.
- Coordonnées de facturation de la structure.
- Compteur d’usage uniquement pour les limites réellement appliquées.

#### Paramètres de l’équipe

- Bloc « Facturation » visible au capitaine et au manager.
- Nom légal, adresse, pays, numéro de TVA éventuel.
- Adresse e-mail destinée aux factures.
- Transfert du rôle de payeur avant suppression du compte propriétaire.

#### Administration NXT5

- Revenu mensuel récurrent estimé, dans une future vue facturation distincte du suivi commercial actuel.
- Nombre d’équipes actives par offre.
- Nouveaux achats, résiliations et paiements échoués.
- Conversion Découverte vers payant.
- Aucun numéro de carte ni donnée bancaire stocké dans NXT5.

## 6. Comptes, propriété et droits

La souscription appartient à une équipe et non à un utilisateur. Le compte qui paie reste le contact de facturation, mais tous les membres autorisés profitent des droits de l’équipe.

Règles recommandées :

- capitaine et manager : démarrage de l’essai, achat et accès à la page de facturation ;
- capitaine : résiliation ;
- coach et analyste : consultation du statut, sans accès aux factures ni au moyen de paiement ;
- joueur et viewer : aucun accès à la facturation ;
- administrateur NXT5 : vue du statut Stripe, sans capacité de lire les données de carte.

Cas à traiter :

- une personne peut appartenir à plusieurs équipes avec des offres différentes ;
- quitter une équipe ne résilie jamais son abonnement ;
- supprimer une équipe active demande d’abord une confirmation explicite et la résiliation ;
- transférer la propriété ne transfère pas automatiquement le compte Stripe ;
- une équipe dont l’essai ou le Pass expire doit souscrire pour continuer à utiliser les outils, sans perdre l’accès aux fonctions de compte et aux droits sur les données ;
- les données existantes ne sont pas supprimées à l’expiration ; leur conservation doit être précisée avant lancement et toute éventuelle suppression doit être annoncée conformément à cette politique.

## 7. Architecture de paiement

Stripe Checkout est recommandé pour l’achat et Stripe Customer Portal pour la gestion. NXT5 ne collecte ni ne stocke les coordonnées bancaires.

### Tables à ajouter

#### `billing_customers`

- `team_id` unique ;
- `stripe_customer_id` unique ;
- `billing_email` ;
- `legal_name` ;
- `country` ;
- `tax_id_display` ;
- dates de création et mise à jour.

#### `subscriptions`

- `team_id` ;
- `stripe_subscription_id` unique ;
- `stripe_price_id` ;
- `plan_code` ;
- `status` ;
- `current_period_start` et `current_period_end` ;
- `cancel_at_period_end` ;
- `latest_invoice_id` ;
- dates de création et mise à jour.

#### `billing_events`

- `stripe_event_id` unique pour l’idempotence ;
- `event_type` ;
- `team_id` nullable ;
- `processed_at` ;
- `processing_error` ;
- empreinte ou métadonnées minimales, sans recopier tout le payload durablement.

#### `entitlements`

- `team_id` ;
- `feature_key` ;
- `value` JSON ou entier ;
- `source` ;
- `valid_until` nullable.

Une table d’entitlements évite de disperser les conditions `plan === ...` dans tout le code. Les 14 jours de Découverte sont enregistrés séparément côté NXT5 avec `team_id`, début et fin de validité, auteur du démarrage et audit. Ils ne nécessitent ni Customer Stripe ni carte bancaire. Le mensuel est le seul plan achetable ; les anciens codes manuels ne doivent pas être convertis automatiquement.

### Fonctions serveur à ajouter

- `billing-checkout-create` : vérifie le rôle, l’équipe et le `price_id`, puis crée Checkout.
- `billing-portal-create` : crée une session Customer Portal.
- `billing-trial-start` : démarre les 14 jours sans carte après contrôle du rôle et de l’éligibilité, avec dates serveur et idempotence.
- `billing-status` : retourne le statut, la date de fin de l’essai éventuel et les droits de l’équipe.
- `billing-invoices` : retourne les liens de factures autorisés.
- `stripe-webhook` : vérifie la signature, enregistre l’événement puis met à jour la souscription.

### Événements Stripe à gérer

- `checkout.session.completed` ;
- `customer.subscription.created` ;
- `customer.subscription.updated` ;
- `customer.subscription.deleted` ;
- `invoice.paid` ;
- `invoice.payment_failed` ;
- `charge.refunded` si des remboursements sont proposés.

Le webhook est la source de vérité pour les droits payants. Le retour navigateur après Checkout ne doit jamais suffire à activer une offre. Les dates d’essai enregistrées côté NXT5 déterminent séparément les droits de Découverte.

### Variables d’environnement

- `STRIPE_SECRET_KEY` ;
- `STRIPE_WEBHOOK_SECRET` ;
- `STRIPE_PRICE_TEAM_MONTHLY` ;
- `STRIPE_PORTAL_CONFIGURATION_ID` facultatif ;
- `PUBLIC_SITE_URL`, déjà présent.

## 8. Droits et expiration — après lancement uniquement

Le catalogue et les composants actuels préparent la présentation ; `SUBSCRIPTION_RESTRICTIONS_ENABLED` reste fixé à `false` dans `src/app/pass-access.js`. Un flou dans React ne protège aucune donnée. Avant toute activation, les droits de l’équipe et les limites doivent être contrôlés côté serveur, y compris par appel direct aux API. Les attributions manuelles de profil ne prouvent pas qu’une équipe possède le Pass.

| Périmètre après lancement | Essai de 14 jours ou Pass valide | Sans essai ni Pass valide |
| --- | --- | --- |
| Tous les outils de l’équipe, dont Champion Pool et les imports | Accès complet | Pass requis pour continuer |
| Compte, sécurité, confidentialité et droits sur les données | Accessible | Accessible |
| Souscription et régularisation de la facturation | Selon le rôle autorisé | Selon le rôle autorisé |

Les 14 jours et le Pass donnent accès aux mêmes outils, sans quota commercial de dix imports. Les limites techniques contre les abus et les autorisations de rôle restent inchangées.

Découverte et Pass Équipe ont les mêmes droits fonctionnels et la même limite de 15 membres pendant l’essai valide. À l’expiration de l’essai ou de la période payée sans autre droit valide :

- exiger le Pass pour continuer à utiliser les outils, y compris Champion Pool, planning, statistiques et roster ;
- présenter l’aperçu flouté contextualisé, sans rendre les outils ou leurs données accessibles sous un simple filtre CSS ;
- ne supprimer aucune donnée existante ni démarrer un nouvel essai implicitement ;
- préserver les parcours de données personnelles, d’export RGPD, de confidentialité, de sécurité et de suppression du compte ;
- laisser l’accès nécessaire à la facturation pour souscrire ou régulariser.

## 9. E-mails transactionnels

- confirmation d’achat ;
- facture disponible ;
- paiement échoué, avec lien sécurisé vers le portail ;
- confirmation de démarrage et rappel avant fin de l’essai de 14 jours ;
- confirmation de résiliation ;
- rappel avant expiration ;
- confirmation de passage de Découverte au mensuel ;
- avertissement avant suppression de données.

Les e-mails commerciaux doivent être séparés des e-mails nécessaires au service et soumis au consentement approprié.

## 10. Fiscalité, comptabilité et conformité

Avant le premier encaissement :

- disposer d’une structure capable de facturer ;
- ouvrir un compte bancaire professionnel si le statut l’exige ;
- définir la numérotation et l’archivage des factures ;
- vérifier le régime de TVA et les seuils applicables ;
- distinguer ventes B2C, associations et structures professionnelles ;
- mettre à jour CGU, politique de confidentialité et politique de remboursement ;
- documenter Stripe comme sous-traitant ;
- tenir un registre des remboursements et litiges.

Stripe Tax peut calculer les taxes, mais ne remplace pas l’immatriculation, les déclarations ni le conseil d’un comptable. Pour le lancement, limiter la vente à la France simplifie fortement le cadre. L’ouverture à toute l’Union européenne doit venir après validation comptable.

## 11. Économie du projet

### Hypothèse de calcul, à vérifier avant encaissement

Le scénario ci-dessous reprend uniquement l’hypothèse de frais d’encaissement utilisée dans le document précédent : 1,5 % + 0,25 € par paiement. **Ce tarif Stripe n’a pas été revérifié pour cette révision.** À 9,90 €, ces frais hypothétiques valent 0,3985 €, soit environ 0,40 € ; il reste environ 9,50 € encaissés après ces seuls frais.

### Couverture indicative des coûts

| Coûts mensuels de NXT5 | Équipes à 9,90 €/mois nécessaires, après ces seuls frais hypothétiques |
|---:|---:|
| 50 € | 6 |
| 100 € | 11 |
| 200 € | 22 |
| 500 € | 53 |
| 1 000 € | 106 |

Calcul : arrondir au supérieur `coûts / (9,90 − (9,90 × 1,5 % + 0,25))`. Ce tableau n’est pas un seuil de rentabilité : il ne déduit ni TVA éventuellement due, ni impôts, cotisations, remboursements, options de facturation ou de taxe, temps de travail ou coûts variables. Les essais gratuits ne produisent aucun revenu et ont aussi un coût. Ces hypothèses doivent être remplacées par les frais et le régime réellement applicables avant toute décision financière. Un budget de sécurité de trois à six mois de dépenses reste un objectif de préparation.

### Tableau de bord mensuel

- revenu encaissé ;
- revenu récurrent mensuel ;
- revenu mensuel engagé et coût des essais ;
- coûts Stripe ;
- Netlify, Neon, e-mails, domaine, outils et comptabilité ;
- revenu net avant fiscalité ;
- équipes payantes ;
- revenu moyen par équipe ;
- taux de conversion ;
- résiliations ;
- paiements échoués ;
- coût moyen d’une équipe active.

## 12. Acquisition sans gros budget

### Premières équipes

Proposer la même offre de lancement aux premières équipes : 14 jours d’accès complet sans carte, puis une souscription volontaire à 9,90 € TTC par mois. Organiser un retour produit pendant l’essai et après les premiers renouvellements. Aucun tarif fondateur distinct ni prix « à vie » n’est proposé.

### Vente directe

- contacter des coachs, managers et structures amateur/semi-pro ;
- faire une démonstration de 20 minutes avec leurs propres usages ;
- accompagner le démarrage de l’essai de 14 jours sur leurs propres usages ;
- demander un retour et l’autorisation d’utiliser un témoignage réel ;
- suivre prospects, essais, refus et raisons de résiliation dans un tableau simple.

### Partenariats

- écoles et associations esport ;
- ligues communautaires ;
- coachs indépendants ;
- organisateurs de tournois.

Pas de publicité payante avant de connaître le taux de conversion et la rétention sur au moins deux mois.

## 13. Mesure du parcours

Événements minimums :

- vue des tarifs ;
- clic sur une offre ;
- démarrage et fin de l’essai, puis démarrage et réussite de Checkout ;
- création de la première équipe ;
- premier joueur ajouté ;
- première game importée ;
- première review créée ;
- ouverture du portail client ;
- résiliation ;
- paiement échoué.

Ne pas envoyer les noms de joueurs, Riot IDs, notes de coach ou données de game à l’outil d’analytics.

## 14. Déploiement par étapes

### Étape 1 — validation commerciale, une semaine

- préparer la page Tarifs sans paiement en accès administrateur, puis ouvrir la collecte après une décision explicite ;
- ajouter « Demander un accès » ou une liste d’attente ;
- présenter l’offre à 10 équipes ;
- tester le prix de 9,90 €, l’intérêt d’un essai de 14 jours et la personne qui paie ;
- obtenir au moins trois intentions d’achat avant l’intégration complète.

### Étape 2 — paiement minimum viable, une à deux semaines

- créer le produit et le prix mensuel Stripe en mode test ;
- développer le démarrage et l’expiration serveur de l’essai sans carte ;
- ajouter les tables de facturation ;
- implémenter Checkout, webhook, statut et portail ;
- créer les quatre pages d’achat ;
- protéger côté serveur tous les outils de l’équipe, l’échéance de l’essai et la limite de membres applicable ;
- tester achat, renouvellement, échec, résiliation et remboursement.

### Étape 3 — premières équipes, quatre semaines

- vendre à 20 équipes maximum ;
- suivre chaque activation manuellement ;
- corriger les blocages du parcours ;
- mesurer les coûts par équipe ;
- ne construire aucune nouvelle formule pendant cette phase.

### Étape 4 — passage à l’échelle

- automatiser les relances de paiement ;
- définir une éventuelle offre pour plusieurs équipes si des besoins réels sont confirmés ;
- ouvrir de nouveaux pays après validation fiscale ;
- ajuster les prix à partir de la rétention, pas du nombre d’inscriptions.

## 15. Tests indispensables

- un joueur ne peut pas acheter pour une équipe qu’il ne gère pas ;
- un `price_id` envoyé par le navigateur ne peut pas imposer un prix arbitraire ;
- un webhook falsifié est refusé ;
- un même événement Stripe traité deux fois ne crée pas deux droits ;
- une page de confirmation ouverte manuellement n’active rien ;
- une résiliation garde l’accès jusqu’à l’échéance ;
- un paiement échoué applique une période de grâce définie ;
- l’essai expire après 14 jours sans prélèvement ni renouvellement automatique ;
- un changement de propriétaire ne divulgue aucune facture ;
- une équipe en essai garde les mêmes fonctions qu’une équipe payante et ne contourne ni l’échéance ni la limite de 15 membres via l’API ;
- les imports au-delà de dix sont autorisés pendant l’essai et avec le Pass ; aucun niveau gratuit permanent n’est créé ;
- sans essai ni Pass valide, tous les outils sont protégés contre les appels API directs ; les exports RGPD et la gestion du compte restent accessibles ;
- les pages achat et facturation fonctionnent sur mobile ;
- les montants, taxes et dates sont cohérents entre NXT5 et Stripe.

## 16. Décisions à prendre avant développement

1. Statut juridique et régime de TVA du vendeur.
2. Vente limitée à la France au lancement ou non.
3. Prix affichés TTC ou HT selon la clientèle visée.
4. Durée de grâce après paiement échoué, recommandation : sept jours.
5. Durée de conservation des données après expiration, distincte de l’accès aux outils et avec maintien des droits sur les données.
6. Politique de remboursement du mensuel.
7. Déclenchement, éligibilité et traitement des équipes existantes pour l’essai de 14 jours.
8. Date d’activation réelle du paiement et de l’essai, après validation commerciale.

## 17. Décision de lancement

Retenir Découverte, 14 jours d’accès complet sans carte bancaire, puis Pass Équipe à 9,90 € TTC par mois et par équipe pour continuer à utiliser tous les outils. Aucun niveau gratuit permanent ni quota de dix imports n’est prévu. Le lien destiné aux organisations possédant plusieurs équipes recueille leurs besoins sans prix ni engagement fonctionnel. Les autres formules sont hors du lancement.

Le développement du paiement vient après des échanges réels et au moins trois intentions d’achat documentées pour le mensuel. Ce prix reste à tester ; la fidélité des premières équipes et les coûts observés permettront de décider de la suite. La présente révision ne démarre aucun essai, n’encaisse aucun paiement et conserve le périmètre administrateur de la prévisualisation.
