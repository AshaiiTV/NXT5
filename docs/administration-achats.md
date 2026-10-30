# Administration, comptes et statistiques globales

Évolution locale du 30 octobre 2026. La publication en production doit être vérifiée séparément.

## Navigation et recherche

- `/admin` : synthèse des comptes, équipes, imports et raccourcis opérationnels.
- `/admin/comptes` : annuaire paginé des comptes et des profils joueurs/staff. Recherche par nom,
  pseudonyme, e-mail ou identifiant ; les profils peuvent aussi être retrouvés par Riot ID ou équipe.
  Les filtres distinguent les e-mails vérifiés, les comptes sans équipe et les profils non liés.
- `/admin/comptes?userId=…` : identité, équipes, rôles, profils liés, activité et sessions actives.
  Le nom affiché peut être corrigé ; les sessions d’un autre compte peuvent être révoquées après confirmation.
  Les e-mails, mots de passe et droits administrateur ne sont pas modifiables ici.
- `/admin/equipes?teamId=…` : dossier d’équipe consultable depuis la fiche d’un compte.
- `/admin/journal` : actions, intervenants et dates ; les contenus privés des équipes et métadonnées
  brutes d’audit ne sont pas exposés.
- Usage, fréquentation, publications Discord, rappels et intégrations restent disponibles.

L’administration reste réservée au compte configuré côté serveur. Les nouvelles actions vérifient
la session à nouveau au moment de l’écriture et refusent une révision de compte périmée. Écriture
et audit sont atomiques ; une erreur d’audit annule la modification. Une réponse réseau incertaine
ne déclenche jamais une répétition automatique. Il faut recharger la fiche avant une nouvelle tentative.

## Statistiques globales et réseaux sociaux

`/admin/stats-globales` utilise les imports NXT5, sans transmettre les noms, e-mails, équipes,
Riot IDs ou identifiants de parties aux exports. La période filtre la date d’import, pas la date de jeu.
Les filtres proposent 7/30/90/365 jours ou l’historique, le patch et, pour les champions joués, le poste.

- **Champions joués** : participants des parties importées. Un même identifiant de partie est regroupé
  entre équipes. La part compare les sélections du champion à toutes les sélections du poste choisi.
  Le taux de victoire utilise seulement les résultats connus et affiche ce dénominateur.
- **Bans en partie** : données Riot des parties importées. Seules les parties avec les dix emplacements
  connus sont prises en compte. Un emplacement explicitement passé est accepté ; un emplacement
  inconnu exclut la partie de cette mesure. La présence d’un champion est comptée une fois par partie.
- **Picks et bans en draft** : sources Drafter regroupées par identifiant de source et numéro de partie,
  même quand plusieurs équipes les ont importées. Les picks complets et bans complets ont des
  dénominateurs distincts. Un champion compte au plus une fois dans une draft pour chaque mesure.

Les identités de champions sont vérifiées dans le catalogue public Riot. Une chaîne inconnue est
exclue et signalée dans la couverture ; elle n’est jamais exportée comme nom de champion.
Les matchs et drafts ne sont pas fusionnés dans un dénominateur commun.

Le CSV contient le classement complet. Le PNG propose un post 1080 × 1350 (8 champions) ou une
story 1080 × 1920 (10 champions), avec période, patch, effectif et source. Recherche et tri du tableau
n’altèrent pas le classement exporté : l’export conserve le classement par volume, clairement annoncé.
Ces données décrivent uniquement l’échantillon NXT5 ; elles ne représentent pas tout League of Legends.

## Retraits

Les pages Achats, Demandes d’accès, Comptes et abonnements, Offres et tarifs et Préparer la vente,
leurs API de lecture/écriture, les restrictions Pass, le catalogue commercial et Shopify sont retirés.
Les migrations historiques restent en place. Les anciennes demandes de contact restent soumises
à leur purge de six mois, sans nouvelle collecte ni formulaire actif.

`/calendrier` et `social-calendar` sont retirés. `/planning`, ses disponibilités, ses séances,
son enregistrement et son intégration Discord sont conservés.

## Vérifications

`npm run verify`, `npm run test:layout` et `node tools/admin-redesign-qa.mjs` contrôlent le code,
les droits, les compteurs, les anciennes routes et le rendu responsive. Le dernier script utilise
uniquement des données fictives et vérifie 25 combinaisons de pages et de largeurs de 320 à 1 920 px,
ainsi que les téléchargements PNG et CSV. Il ne mesure pas les données de production.
