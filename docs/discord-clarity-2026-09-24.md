# Bot Discord — refonte de lecture du 24 septembre 2026

La page distingue désormais le compte personnel (« Toi sur Discord »), le serveur de l’équipe, les commandes et les publications. Le compte lié reste compact ; la liaison personnelle propose une commande copiable et un guide replié. Les deux confirmations de compte sont conservées.

L’installation affiche un seul panneau à la fois, avec trois repères Serveur / Salons / Activation. Les destinations distinguent « Où utiliser le bot ? » et « Où recevoir les résultats ? ». Le test fictif et l’autorisation des publications restent deux actions explicites. Après installation, une vue d’ensemble montre les deux usages et leur destination, avec une navigation vers les salons, accès, activité et aide.

Le serveur relié ne signifie pas que les publications sont actives. Aucun salon enregistré, erreur d’actualisation et permission d’envoi manquante donnent un état explicite à corriger. Les commandes copiées sont complètes. Les brouillons, reçus de test et validations existants restent conservés entre les vues ; le changement d’équipe réinitialise leur contexte. Les retours et poursuites déplacent le focus vers la navigation visible. Le staff garde l’accès à l’activité avant activation et après déliaison.

## Direction artistique

Composants `Surface`, `Button`, `Badge`, `SelectInput`, Inter et tokens NXT5 réutilisés. Surfaces bleu nuit, séparateurs sobres, accents cyan et violet, boutons de 2 px. Texte de lecture à 14–16 px, champs mobiles à 16 px et commandes accessibles au clavier. La charte canonique a été actualisée à son emplacement unique du dépôt principal ; aucune copie n’est créée dans ce checkout.

## Vérification

- TypeScript et compilation Vite validés.
- 105 tests ciblés passent après intégration des dernières évolutions de `main` (PR #74 et #75) : interface Discord, compte personnel, droits et changement d’équipe.
- Suite complète : 108 suites et 1 855 tests réussis, un test historique de base de données ayant dépassé son délai de 15 s. La suite concernée (`review-backfill`, 9 tests) réussit ensuite intégralement en isolation avec un délai autorisé de 30 s ; aucun changement de ses assertions ni de la configuration du dépôt. Le premier passage au délai par défaut avait également rencontré des dépassements dans les migrations.
- Contrôle navigateur des vrais composants avec le cadre complet : 360, 390, 768, 1024 et 1440 px. Fixtures locales, états de connexion/compte, droits, erreurs, navigation, formulaires, noms longs. Aucun appel vers un vrai serveur Discord et aucune publication réelle.
- Captures et résultats détaillés locaux dans `artifacts/discord-clarity/`, non inclus dans le commit. Scripts du banc local dans `tmp/nxt5-discord-clarity-preview` à la racine de l’espace de travail.

Limite préexistante hors de cette refonte : avec mouvement réduit, l’ouverture clavier du menu mobile global peut laisser le focus sur le document plutôt que sur le bouton de fermeture. La navigation propre à Bot Discord et ses retours de focus ont été contrôlés séparément. Les fixtures ne remplacent pas un test de compréhension avec des utilisateurs ni une validation sur un serveur Discord réel.
