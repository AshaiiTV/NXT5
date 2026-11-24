# Corrections de l’audit NXT5 — 28 septembre 2026

Base : `d31a75f`, branche `codex/audit-corrections-20260928`. Les corrections portent sur le site web ; l’application Importer n’est pas modifiée.

## Ergonomie

- Les modifications des débriefs sont conservées en mémoire par compte et équipe, après fermeture et navigation interne. Une édition intacte ne déclenche aucun avertissement. Rechargement, remplacement, suppression et déconnexion sont protégés quand il reste des modifications. La sauvegarde bloque la fermeture et les saisies concurrentes.
- Les dialogues natifs partagés rendent l’arrière-plan inactif, contiennent le focus et le rendent au déclencheur. Retour ferme les opérations ; seuls les imports et éditions modifiés demandent confirmation d’abandon.
- Les onglets exposent leurs panneaux et se parcourent aux flèches, Début et Fin. La navigation administrative entre pages utilise des liens. Le contenu principal reçoit le focus au changement de rubrique.
- Le planning propose une journée sélectionnable sur téléphone et conserve la semaine sur grand écran, avec une seule entrée clavier par grille.

## Direction artistique

- L’accueil et Fonctionnalités montrent un bilan fictif calculé à partir des mêmes données que la démonstration, avec une observation et une question de débrief.
- Fonctionnalités est raccourcie avec des précisions repliables. La palette, les composants, les logos complets et les accents existants sont conservés.
- Les labels d’authentification sont harmonisés à 14 px.
- La charte unique a été actualisée en version 1.52 à son emplacement canonique dans le checkout principal, indiqué dans `AGENTS.md`. Aucune copie de charte n’est ajoutée ici.

## Sécurité

- Invitations à 128 bits, quotas IP/compte, rotation et révocation explicites. L’interface copie le lien complet et accepte les jetons longs. Les verrous suivent l’ordre équipe puis invitation ; l’admission revalide le code avant écriture.
- Connexion limitée par compte, avec budget commun pseudo/e-mail, en plus du quota IP : 8 essais sur 5 minutes, 20 sur une heure.
- Notifications de débrief dédupliquées sur 5 minutes, plafonnées par compte et équipe, sans empêcher l’enregistrement du débrief.
- Inscription : réponse HTTP 202 neutre pour une adresse nouvelle ou existante, sans session automatique. L’utilisateur vérifie son e-mail puis se connecte. Les réponses brutes du fournisseur d’e-mail sont retirées des journaux.

## Pertinence

- `/demo` donne accès sans compte à trois parties fictives, aux filtres, à leurs courbes d’analyse et à des exemples de débrief.
- Le premier fichier peut être chargé avec un effectif vide. Les profils proposés doivent être vérifiés puis créés explicitement ; cette création reste distincte de la confirmation de l’import. Les profils existants sont réutilisés sans écrasement.
- Gratuité actuelle et prérequis Windows/Mac sont visibles avant inscription. Deux guides publics sont pré-rendus et inclus au sitemap.
- `/games` rejoint la mesure d’audience. `first_import` et `first_review` sont émis après réussite serveur et seulement avec consentement. Les jalons sont durables par équipe ; aucun identifiant d’équipe, de compte, de joueur ou de partie n’est envoyé à l’audience. Le rapport montre des comptes agrégés, pas un parcours nominatif ni une rétention par équipe.

## Livraison et limites

Deux migrations sont enregistrées dans le runner : `20260928_audience_activation.sql` et `20260928_team_activation_milestones.sql`. Le build de production existant exécute `db:migrate` avant publication. Un environnement de preview doit disposer d’une base isolée migrée avant de tester les nouvelles écritures ; aucune migration de production n’a été exécutée pendant ce travail.

Les brouillons restent en mémoire de session, sans données métier dans le stockage du navigateur : ils ne survivent pas à un rechargement confirmé. Les réponses d’inscription sont neutres, sans garantie de temps de réponse strictement identique. Les quotas de notification n’implémentent pas de digest différé.

Les contrôles UI locaux utilisent les vrais composants avec des données fictives et des API simulées : import vide → profils → confirmation, récupération de débrief, focus et planning clavier, démonstration et vues mobiles. L’accès en ligne reste bloqué par la chaîne de certificats de la passerelle Cisco de cet environnement. Les e-mails réels, OAuth, la concurrence entre connexions PostgreSQL distinctes et la configuration d’infrastructure n’ont pas été certifiés.

## Validation

- `npm run verify` réussi : TypeScript, 127 suites / 2 239 tests Vitest, build Vite et pré-rendu des 13 pages publiques. Les moteurs PostgreSQL WASM sont limités à deux workers ; la suite rejouant les migrations conserve ses assertions avec un délai de 30 secondes.
- Audit npm : aucune vulnérabilité signalée le 28 septembre 2026.
- Police Inter chargée vérifiée sur accueil, connexion et composeur ; labels de connexion mesurés à 14 px. Contrôles mobiles à 360/390 px et vérifications de largeur à 768/1024 px ; planning et débrief également inspectés sur bureau. Pas de débordement global dans les vues vérifiées.
- `git diff --check` propre.
