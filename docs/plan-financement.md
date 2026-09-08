# Plan de financement et de monétisation de NXT5

Version de travail — septembre 2026

## 1. Objectif

Le premier objectif n’est pas de maximiser le revenu. Il est de couvrir les frais fixes de NXT5, puis de financer son amélioration sans dégrader l’expérience des joueurs.

Le produit doit être vendu à l’équipe. Le capitaine, le coach ou le manager paie et invite les autres membres. Un joueur ne doit pas avoir à acheter son propre accès pour rejoindre une équipe déjà abonnée.

## 2. Offre recommandée

### Découverte — gratuit

- Un compte personnel.
- Une équipe.
- Jusqu’à 10 membres.
- 5 imports de games au total.
- Statistiques essentielles.
- Une composition et trois reviews.
- Pas d’essai automatique avec carte bancaire.

Cette offre doit permettre de comprendre le produit, mais pas de gérer une saison entière.

### Pass Équipe — 29 € TTC par mois

- Une équipe et jusqu’à 15 membres.
- Imports, statistiques, reviews, planning, champion pools et compositions sans limite fonctionnelle artificielle.
- Historique complet.
- Export des données.
- Gestion des rôles et accès du staff.
- Assistance standard.
- Résiliation à tout moment, avec accès jusqu’à la fin de la période payée.

### Pass Équipe annuel — 290 € TTC par an

Même contenu que le Pass Équipe mensuel, avec deux mois offerts. L’offre annuelle doit être mise en avant comme le choix le plus simple pour une structure stable.

### Pass Saison — 169 € TTC pour six mois

Paiement unique, sans renouvellement automatique. Cette formule répond aux équipes temporaires, splits, projets amateurs et associations qui refusent un abonnement permanent.

### Structure — sur devis, à partir de 79 € TTC par mois

- Plusieurs équipes sous une même organisation.
- Facturation centralisée.
- Administrateur de structure.
- Vue multi-équipe.
- Accompagnement à l’installation.

Cette offre ne doit être commercialisée qu’après validation du Pass Équipe. Il ne faut pas construire les fonctions multi-équipes avant d’avoir des prospects réels.

## 3. Positionnement commercial

Le message principal : « Tout le suivi de ton équipe LoL au même endroit. »

NXT5 ne doit pas être présenté comme une IA qui gagne les drafts ou remplace le coach. Le produit vend du temps gagné, des données rangées et un suivi partagé.

Arguments concrets :

- retrouver les games et les reviews sans multiplier les fichiers ;
- garder les champion pools à jour ;
- préparer une session avec le même support pour tout le staff ;
- conserver l’historique quand le roster change.

## 4. Parcours d’achat

### Depuis le site public

1. Le visiteur ouvre `/tarifs`.
2. Il compare Découverte, Pass Équipe mensuel, annuel et Pass Saison.
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
- Les boutons bloqués ouvrent une fenêtre courte expliquant la limite et renvoient vers cette page.
- Le bouton « Gérer la facturation » ouvre le portail client Stripe.
- Le propriétaire peut changer de formule, mettre à jour la carte, télécharger ses factures ou résilier.

## 5. Pages à créer ou modifier

### Pages publiques

#### `/tarifs`

- Tableau simple des trois formules principales.
- Prix TTC clairement affichés pour la France.
- Mensuel, annuel et saison dans un sélecteur unique.
- Liste factuelle des fonctions incluses.
- FAQ : renouvellement, résiliation, membres, conservation des données, remboursement et factures.
- CTA principal « Créer mon équipe ».
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

- Revenu mensuel récurrent estimé.
- Nombre d’équipes actives par offre.
- Nouveaux achats, résiliations et paiements échoués.
- Conversion Découverte vers payant.
- Aucun numéro de carte ni donnée bancaire stocké dans NXT5.

## 6. Comptes, propriété et droits

La souscription appartient à une équipe et non à un utilisateur. Le compte qui paie reste le contact de facturation, mais tous les membres autorisés profitent des droits de l’équipe.

Règles recommandées :

- capitaine et manager : achat et accès à la page de facturation ;
- capitaine : changement de formule et résiliation ;
- coach et analyste : consultation du statut, sans accès aux factures ni au moyen de paiement ;
- joueur et viewer : aucun accès à la facturation ;
- administrateur NXT5 : vue du statut Stripe, sans capacité de lire les données de carte.

Cas à traiter :

- une personne peut appartenir à plusieurs équipes avec des offres différentes ;
- quitter une équipe ne résilie jamais son abonnement ;
- supprimer une équipe active demande d’abord une confirmation explicite et la résiliation ;
- transférer la propriété ne transfère pas automatiquement le compte Stripe ;
- une équipe expirée conserve ses données en lecture seule pendant 90 jours ;
- après 90 jours, prévenir avant toute suppression conformément à la politique de conservation.

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
- `stripe_subscription_id` unique, nullable pour le Pass Saison ;
- `stripe_price_id` ;
- `plan_code` ;
- `status` ;
- `current_period_start` et `current_period_end` ;
- `cancel_at_period_end` ;
- `trial_end` nullable ;
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

Une table d’entitlements évite de disperser les conditions `plan === ...` dans tout le code.

### Fonctions serveur à ajouter

- `billing-checkout-create` : vérifie le rôle, l’équipe et le `price_id`, puis crée Checkout.
- `billing-portal-create` : crée une session Customer Portal.
- `billing-status` : retourne le statut et les droits de l’équipe.
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

Le webhook est la source de vérité. Le retour navigateur après Checkout ne doit jamais suffire à activer une offre.

### Variables d’environnement

- `STRIPE_SECRET_KEY` ;
- `STRIPE_WEBHOOK_SECRET` ;
- `STRIPE_PRICE_TEAM_MONTHLY` ;
- `STRIPE_PRICE_TEAM_YEARLY` ;
- `STRIPE_PRICE_TEAM_SEASON` ;
- `STRIPE_PORTAL_CONFIGURATION_ID` facultatif ;
- `PUBLIC_SITE_URL`, déjà présent.

## 8. Limites produit

Les limites doivent être contrôlées côté serveur. Masquer un bouton dans React ne protège rien.

Points de contrôle :

- création d’équipe ;
- ajout d’un membre ;
- import d’une game ;
- création de review ;
- création de composition ;
- accès à l’historique ;
- export.

En cas de passage au gratuit :

- ne supprimer aucune donnée immédiatement ;
- rendre les éléments au-delà de la limite consultables mais non modifiables ;
- permettre l’export et la suppression du compte ;
- laisser le capitaine choisir les éléments actifs si nécessaire.

## 9. E-mails transactionnels

- confirmation d’achat ;
- facture disponible ;
- paiement échoué, avec lien sécurisé vers le portail ;
- rappel avant fin du Pass Saison ;
- confirmation de résiliation ;
- rappel avant expiration ;
- confirmation de changement de formule ;
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

### Hypothèse de départ

Pour une carte standard de l’Espace économique européen, Stripe affiche actuellement 1,5 % + 0,25 € par paiement réussi. À 29 €, le coût de paiement indicatif est donc proche de 0,69 €, avant options de facturation ou de taxe. Le revenu encaissé avant impôts et coûts techniques serait proche de 28,31 €.

### Seuil d’autofinancement indicatif

| Coûts mensuels de NXT5 | Équipes à 29 €/mois nécessaires |
|---:|---:|
| 50 € | 2 |
| 100 € | 4 |
| 200 € | 8 |
| 500 € | 18 |
| 1 000 € | 36 |

Ces nombres couvrent les frais d’encaissement estimés mais pas les impôts, cotisations, remboursements, temps de travail ou coûts variables élevés. Un budget de sécurité de trois à six mois de dépenses doit rester sur le compte du projet.

### Tableau de bord mensuel

- revenu encaissé ;
- revenu récurrent mensuel ;
- revenu annuel engagé ;
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

### Programme fondateur

Proposer aux 20 premières équipes un prix conservé de 19 € TTC par mois tant que leur abonnement reste actif. En échange, organiser un retour produit mensuel. Ne pas promettre un accès « à vie ».

### Vente directe

- contacter des coachs, managers et structures amateur/semi-pro ;
- faire une démonstration de 20 minutes avec leurs propres usages ;
- offrir le Pass Saison à tarif réduit pour un premier split ;
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
- démarrage et réussite de Checkout ;
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

- publier la page Tarifs sans paiement ;
- ajouter « Demander un accès » ou une liste d’attente ;
- présenter l’offre à 10 équipes ;
- valider le prix, la formule saison et la personne qui paie ;
- obtenir au moins trois intentions d’achat avant l’intégration complète.

### Étape 2 — paiement minimum viable, une à deux semaines

- créer les produits et prix Stripe en mode test ;
- ajouter les tables de facturation ;
- implémenter Checkout, webhook, statut et portail ;
- créer les quatre pages d’achat ;
- protéger les limites côté serveur ;
- tester achat, renouvellement, échec, résiliation et remboursement.

### Étape 3 — lancement fondateur, quatre semaines

- vendre à 20 équipes maximum ;
- suivre chaque activation manuellement ;
- corriger les blocages du parcours ;
- mesurer les coûts par équipe ;
- ne construire aucune nouvelle formule pendant cette phase.

### Étape 4 — passage à l’échelle

- automatiser les relances de paiement ;
- ajouter la formule Structure si la demande existe ;
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
- le Pass Saison expire sans renouvellement ;
- un changement de propriétaire ne divulgue aucune facture ;
- une équipe gratuite ne contourne pas les limites via l’API ;
- les pages achat et facturation fonctionnent sur mobile ;
- les montants, taxes et dates sont cohérents entre NXT5 et Stripe.

## 16. Décisions à prendre avant développement

1. Statut juridique et régime de TVA du vendeur.
2. Vente limitée à la France au lancement ou non.
3. Prix affichés TTC ou HT selon la clientèle visée.
4. Durée de grâce après paiement échoué, recommandation : sept jours.
5. Conservation des données après expiration, recommandation : 90 jours en lecture seule.
6. Politique de remboursement du Pass Saison.
7. Limites exactes de l’offre Découverte.
8. Disponibilité ou non du tarif fondateur.

## 17. Recommandation finale

Lancer d’abord Découverte + Pass Équipe mensuel + Pass Saison. Garder l’annuel visible uniquement si des équipes stables le demandent. Le Pass Saison est le meilleur complément au mensuel pour NXT5 : il finance le produit à l’avance, ne crée pas de renouvellement surprise et correspond au rythme d’un roster compétitif.

Le développement du paiement ne doit commencer qu’après trois intentions d’achat réelles. Si personne n’accepte 29 € par équipe et par mois ou 169 € par saison, il faut revoir la promesse ou la cible avant d’ajouter toute l’infrastructure de facturation.
