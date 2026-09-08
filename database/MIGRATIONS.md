# Migrations de NXT5

Utiliser Node 24, installer les dépendances avec `npm ci`, puis lancer `npm run db:migrate`. La connexion vient de `MIGRATION_DATABASE_URL`, avec repli sur `DATABASE_URL`. Les valeurs restent dans l'environnement et ne doivent pas être commitées.

Le runner utilise une connexion dédiée, une transaction PostgreSQL et `pg_advisory_xact_lock` pour sérialiser les déploiements concurrents. Le schéma de référence et les compléments sont appliqués une seule fois, puis enregistrés avec une empreinte SHA-256 dans `app_schema_migrations`. Une erreur annule les changements et leurs marqueurs. Une empreinte différente sur une migration déjà appliquée bloque la livraison : ajouter un nouveau fichier et une entrée dans `tools/migration-runner.mjs`, au lieu de modifier une migration publiée. `database/schema.sql` est désormais la première migration et doit également rester immuable.

Les fonctions ne lancent plus de DDL ou de migration de données. Elles vérifient le marqueur requis, avec cache limité au processus, et répondent 503 si la base n'est pas prête. Les catégories personnalisées, y compris « Match officiel », sont conservées.

Sur Netlify, le contexte production exécute `npm run verify && npm run db:migrate` avant publication. Donner au build de production accès à la connexion de migration. Les previews et branches exécutent seulement les contrôles web ; le script refuse une invocation sous un contexte Netlify autre que production. Pour une recette, préparer une base isolée depuis un environnement local, puis fournir sa connexion aux seules fonctions de cette recette. Ne pas exposer les identifiants de production aux PR.

Le runner limite l'attente d'un verrou à 30 secondes et chaque instruction à 120 secondes. Une migration de grande table peut faire attendre les requêtes : évaluer sa durée en recette avant une évolution lourde. Les tests PostgreSQL embarqués vérifient création, upgrade, conservation du planning, idempotence, contrôle des empreintes et annulation ; ils ne mesurent pas la contention sur plusieurs connexions Neon.

La variable `PLATFORM_ADMIN_USER_ID` permet de fixer l'administration à un identifiant immuable. Il est recommandé de la configurer ; la compatibilité avec la configuration d'administration existante est conservée.

La migration `20260908_account_subscriptions_discovery_default.sql` attribue Découverte (`free`, sans dates de fin) aux comptes qui n'ont aucune ligne dans `account_subscriptions`. Elle ne modifie aucune attribution existante : formule, dates, retrait, notes et révision sont conservés. Un trigger sur la création d'un utilisateur attribue ensuite Découverte dans la même transaction. Les attributions automatiques n'ajoutent pas de faux administrateur ni d'entrée d'attribution manuelle dans l'historique. L'administration peut remplacer Découverte par un Pass via la révision courante du compte.
