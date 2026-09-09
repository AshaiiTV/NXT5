# NXT5 — préparation des accès Découverte et Pass Équipe

Décision du 9 septembre 2026. Cette préparation n’active aucun abonnement, essai chronométré, paiement ou blocage. **Tous les accès actuels restent inchangés avant lancement**, selon les rôles et autorisations existants.

## Offre retenue

| Situation après lancement | Accès aux outils |
| --- | --- |
| Découverte, pendant 14 jours | Accès complet, sans carte bancaire |
| Pass Équipe valide, à 9,90 € TTC/mois/équipe | Accès complet pour continuer après l’essai |
| Aucun essai ni Pass valide | Pass requis pour continuer à utiliser les outils |

Tous les outils suivent cette règle : imports, reviews, exports produit, tendances, compositions, Champion Pool, planning, statistiques, roster, profils joueurs et autres vues de l’espace équipe. L’essai et le Pass n’appliquent aucun quota commercial de dix imports. La proposition couvre une équipe et jusqu’à 15 membres. Les protections techniques contre les abus et les autorisations de rôle restent distinctes.

Les parcours de compte, de connexion, de sécurité, de confidentialité, d’export RGPD et de suppression du compte restent accessibles indépendamment du Pass. Les exports produit, qui font partie des outils d’analyse, ne remplacent pas les parcours de droits sur les données. La facturation et la souscription doivent rester accessibles aux rôles autorisés pour régulariser un accès expiré.

Il n’y a ni niveau gratuit permanent ni prélèvement automatique à la fin des 14 jours. Le futur passage au Pass demandera une souscription explicite. Une expiration ne supprime aucune donnée ; la politique de conservation doit être définie avant lancement.

## Ce qui est préparé

Le catalogue [pass-access.js](../src/app/pass-access.js) contient :

- `DISCOVERY_TRIAL_DAYS = 14`, durée d’affichage de la proposition ;
- `SUBSCRIPTION_RESTRICTIONS_ENABLED = false`, constante explicite qui garde la politique réelle ouverte avant lancement ;
- `PASS_FEATURES`, les noms et bénéfices utilisés dans les messages contextualisés ;
- `getPassFeatureAccess`, qui autorise toujours les outils tant que les restrictions restent désactivées ;
- `getPlannedPassFeatureAccess`, politique future isolée : accès si `hasTeamPass` ou `hasActiveTrial` vaut strictement `true`.

Cette politique future ne lit aucune date, ne démarre aucun essai et ne déduit aucun droit des abonnements manuels de profil. Les variables d’environnement, paramètres d’URL et valeurs de stockage navigateur ne permettent pas d’activer la constante.

Le composant [PassFeatureGate](../src/components/subscriptions/PassFeatureGate.jsx) conserve ses enfants lorsque l’accès est autorisé. Son état fermé utilise `PassFeaturePreview` : formes décoratives floutées, nom de l’outil, message expliquant les 14 jours puis le Pass, prix et bouton « Prendre le Pass Équipe ». Le décor ne contient aucune donnée réelle protégée. Quand cet état sera utilisé après lancement, le contenu protégé ne devra être ni monté ni chargé pour un accès refusé.

## Prévisualisation interne

La page [Tarifs](../src/pages/public/PricingPage.jsx), à `/tarifs`, reste réservée à l’administrateur plateforme. Ses détails de prévisualisation, repérés par `data-pass-preview`, permettent de sélectionner un outil et de voir son futur message Pass sans modifier les droits de l’équipe.

Le bouton de cet aperçu sélectionne le Pass Équipe dans le formulaire commercial existant. Il ne lance ni paiement ni essai et n’envoie aucune demande à lui seul. L’aperçu n’active pas le masquage dans les outils réels et ne stocke aucun état d’activation.

## Avant une future activation

Le flou est une présentation, pas une protection des données. **Ne pas activer les restrictions en changeant seulement la constante.** Le futur lancement doit comprendre :

1. Un démarrage d’essai explicite et autorisé, avec début et échéance de 14 jours enregistrés côté serveur, idempotence et audit. Définir l’éligibilité et le traitement des équipes existantes, sans réinitialisation à partir d’une visite, d’un changement de navigateur ou de propriétaire.
2. Une source de droits propre à chaque équipe : essai serveur valide, souscription payante confirmée côté serveur ou dérogation d’équipe explicite et auditée. Les [attributions manuelles de profil](abonnements-manuels.md) restent distinctes et ne sont jamais converties ou rattachées automatiquement.
3. Des contrôles serveur sur la lecture et l’écriture des outils, résistants aux appels API directs, avec maintien des contrôles d’appartenance et de rôle. Préserver les endpoints de compte, de sécurité et de droits sur les données.
4. Un raccordement du navigateur aux droits serveur, avec états de chargement, erreur, absence d’équipe, essai actif, Pass actif et expiration. Ne pas charger les données protégées avant autorisation et ne pas se fier à une date ou à un statut modifiable côté navigateur.
5. Le parcours de souscription, le traitement des webhooks, l’expiration et la conservation des données, puis une recette complète avant une décision explicite de lancement.

L’architecture du paiement à développer est détaillée dans le [brief d’intégration](brief-integration-paiement-ia.md). Cette livraison ne crée aucun de ces nouveaux contrôles serveur et ne modifie pas les règles des abonnements manuels.

## Vérifications

- Avant lancement, un compte sans attribution, avec attribution expirée ou révoquée conserve ses accès habituels ; toutes les fonctions et plus de dix imports restent utilisables selon ses rôles.
- La politique future donne les mêmes droits à un essai valide et au Pass, puis demande le Pass pour tous les outils sans droit valide, y compris Champion Pool et planning.
- La prévisualisation utilise uniquement des formes décoratives, fonctionne au clavier et sur mobile, et son bouton ne déclenche ni achat ni démarrage d’essai.
- Compte, sécurité, confidentialité et droits sur les données restent hors du périmètre payant.
