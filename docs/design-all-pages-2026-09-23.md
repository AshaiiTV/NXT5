# Refonte de toutes les pages NXT5 — 23 septembre 2026

Cette passe complète la refonte du socle publiée dans la PR #64. Commencée sur `af09e80`, elle intègre désormais la base `bac16c5` et la connexion Google de la PR #60. Elle reprend les vues exposées par cette version, leurs contrôles et leurs principaux états, y compris les nouveaux parcours de connexion sociale. Les calculs, droits, API, règles de publication et de paiement restent inchangés.

## Inventaire de couverture

| Famille | Routes et sous-vues parcourues | Travail effectué |
| --- | --- | --- |
| Entrée publique | `/`, `/connexion`, `/creer-un-compte`, récupération et réinitialisation du mot de passe, page inconnue | Wordmark et header communs, récupération/404 dans le même cadre, message de lien incomplet compréhensible et action de reprise. Accueil/authentification de la première passe revérifiés. |
| Connexion sociale | `/connexion`, `/creer-un-compte?social=complete` et alias `/inscription` ; retours de connexion | Méthodes proposées selon leur disponibilité, fin d’inscription avec pseudo, e-mail de récupération et consentement, notices de retour. Dessins et styles officiels des boutons Google et Apple conservés ; autres fournisseurs affichés selon la configuration du serveur. |
| Vérification | `/verified` : succès, lien expiré, lien invalide ; transition `/verify-email` relue | Carte et titres harmonisés. La redirection de vérification et ses règles ne changent pas. |
| Informations publiques | `/mentions-legales`, `/conditions`, `/reglement`, `/confidentialite`, `/cookies`, `/contact`, `/reseaux` | Titres de page 26–34 px, navigation commune, largeur de lecture, niveaux de texte, surfaces et liens. Contenu juridique conservé. |
| Équipe | `/equipes`, `/gestion-equipe`, création/rejoindre sans équipe | Roster direct conservé, gestion ouverte, métriques et invitations alignées, formulaires et selects lisibles ; correction du demi-écran vide dans le démarrage sans équipe. |
| Games | `/games`, détail `?match=…`, groupes, import et menus de gestion | Résumé avant le détail, données lisibles, vrai tableau de comparaison des rôles, chronologie repliable, contrôles d’import/dialogues. Valeur KDA absente remplacée par les données disponibles ou un tiret. |
| Reviews | `/rapports`, bibliothèque, file « À traiter », lecture et éditeur | Titres, contenu long, formulaire, commandes, games liées, actions et états réorganisés ; brouillons et règles de visibilité conservés. |
| Profil | `/mon-profil`, `/champions`, `/pool`, `/historique`, `/coaching` sous ce chemin | Synthèse, diagnostic, champions/duels/équipements, pool, historique, objectifs et notes. Les formulaires et la progression par game reprennent les mêmes repères. |
| Tendances | `/tendances` : coach, évolution, comparaison, draft, objectifs | Filtres, diagnostic, courbe et inspecteur, comparaisons, objectifs, détails et fenêtres harmonisés. |
| Détails du draft | `/tendances/draft/pick-repere`, `/confort`, `/profil`, `/compositions`, `/duos`, `/a-revoir`, `/roles` | Les sept destinations existantes ont été parcourues ; labels, listes et détails restent lisibles en largeur étroite. |
| Draft | `/draft/pool`, `/draft/compositions` ; builder, banque, compositions enregistrées, counters et lexique | Portraits avec noms visibles, commandes tactiles, banque à deux colonnes de catégories sur mobile, aide au clic et au glisser-déposer, champs et états. |
| Planning | `/planning`, semaines, disponibilités et édition des événements | Contrôles et menus lisibles, états de sauvegarde clarifiés ; grille, gestion des présences et comportement tactile conservés. |
| Discord | `/bot-discord` ; aperçu, trois étapes, salons/options, accès, activité, aide, compte personnel | Parcours progressif conservé, compte personnel et formulaires simplifiés, labels et états lisibles, commandes adaptées au mobile. |
| Compte | `/parametres` : abonnement, identité, sécurité, connexions associées, rendu, notifications | Hiérarchie des sections, options visuelles, notifications en lignes, états d’abonnement, récupération et vérification d’adresse harmonisés. Comptes associés avec ou sans mot de passe NXT5, première création de mot de passe et formulaire de dissociation/annulation intégrés à la même présentation. |
| Guide | `/guide` et ses 12 sections | Sommaire desktop, sélecteur natif mobile, étapes ouvertes et textes courants ; chaque section a été parcourue. |
| Assistant et éléments partagés | Assistant, cookies, écran de chargement, fenêtres de compte | Actions de 44 px, champ mobile 16 px, rayons cohérents, messages/états lisibles. Illustration de chargement conservée ; phases et progression réelle inchangées. |

Les alias existants (`/inscription`, `/integration`, `/statistiques`, `/champion-pool`, `/compositions-types`, `/draft`, `/profil`, `/tarifs`) conservent leur routage vers les vues communes. Ils n’ont pas de design autonome.

## Administration : les douze routes

Toutes ont été parcourues à 360, 390, 768, 1024 et 1440 px :

- `/admin` : vue d’ensemble, métriques, priorités et graphiques.
- `/admin/equipes` : annuaire, filtres et détail d’une équipe.
- `/admin/usage` : adoption des fonctionnalités et indicateurs.
- `/admin/frequentation` : filtres, graphique, sources, tableaux et carte horaire.
- `/admin/bot-discord` : métriques, période, graphique et lieux d’usage.
- `/admin/achats` : historique, formulaire et bilan repliable.
- `/admin/demandes-acces` : liste, suivi et confirmation de suppression.
- `/admin/abonnements` : liste, fiche, attribution et confirmation de retrait.
- `/admin/tarifs` : offres, comparatif et formulaire interne.
- `/admin/preparer-vente` : état de préparation et documents.
- `/admin/rappels` : métriques et historique.
- `/admin/integrations` : Shopify, Discord, configuration et liens.

Navigation administrative unique et protections de brouillons conservées. Les tableaux larges défilent dans leur propre région. Les indicateurs ne sont plus noyés dans plusieurs niveaux de cartes.

## Validation

- `npm run verify` : **98 suites, 1 738 tests**, TypeScript et build Vite réussis après intégration de `bac16c5` et les derniers correctifs (journal `nxt5-all-pages-integrated-verify.log`).
- Contrôle CUA dans le navigateur : plus de **260 chargements de routes/états**, couvrant au moins 75 URL distinctes avec paramètres et les largeurs 360, 390, 768, 1024 et 1440 px. Aucun débordement horizontal global ni erreur de rendu React constatés dans ces contrôles.
- Parcours systématique des pages publiques en 390/1440, de l’espace équipe en 360/390/1440, des 12 rubriques du guide en 390/1440 et des 12 routes admin aux cinq largeurs. Contrôle complémentaire des grandes familles de l’espace équipe en 768/1024.
- Inspection de captures des familles de pages et de leurs contenus après défilement. Contrôles interactifs : détail champion, objectif joueur, édition review, import, lexique/pick de composition, comparatif de rôle au clavier, chronologie, étapes/salons/accès/aide Discord, suivi de demande, fiche d’abonnement et préférences cookies.
- Le comparatif mobile a été corrigé après inspection : largeur du tableau égale à celle de sa région (314 px dans le contrôle à 390 px), sans colonne tronquée. La banque de champions mobile a aussi été corrigée après inspection.
- États sans games/reviews/pool, première équipe, lien invalide/expiré, champs désactivés et erreur de service contrôlés. Les tests existants couvrent les permissions, confirmations, requêtes et autres états de formulaire.
- Connexion sociale : captures de la connexion et de la complétion d’inscription à 390/1440 px, complétion également à 360 px ; compte lié à 390 px avec formulaire de dissociation ouvert puis annulé. Compte sans mot de passe à 360 px : aide et contrôles désactivés vérifiés. Erreur de service de connexion et retour de demande expirée capturés à 360 px ; erreur des connexions associées contrôlée dans le DOM à cette largeur. Aucun parcours OAuth externe ni aucune dissociation réelle exécutés.
- Les tests sociaux couvrent aussi la disponibilité des fournisseurs, les destinations et invitations, le consentement, la collision d’adresse, les retours d’erreur, les restrictions sans mot de passe et l’annulation de dissociation avec retour du focus. Cette couverture automatisée complète les états effectivement inspectés dans le navigateur.

Les vues connectées ont été montées avec les composants réels et des données entièrement fictives, sans mutation externe. Le harness local `__visual` et ses fixtures ne font partie ni du commit ni du bundle livré. Les écrans sociaux et leurs états utilisent eux aussi des réponses fictives : aucun parcours OAuth réel chez un fournisseur, aucune création de compte et aucune dissociation réelle ne sont revendiqués par cette QA. La présence d’un fournisseur dans les fixtures ne signifie pas qu’il est activé en production. Certains portraits utilisent leur repli local dans cet environnement ; les assets de marque, de rôle et d’objectifs ont été contrôlés. Les validations visuelles ne constituent pas un test de tous les comptes réels ni de toutes les combinaisons de données et permissions.

Le carnet matchup et `/admin/exports` mentionnés dans la charte consolidée ne sont pas présents dans la version de `main` servant de base. Cette passe ne crée pas ces fonctionnalités et ne prétend pas les avoir déployées.

La charte canonique unique du workspace est mise à jour en version 1.37 ; aucune copie ni PDF supplémentaire n’est créé par cette tâche.
