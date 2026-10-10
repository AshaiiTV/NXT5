# Internationalisation NXT5 — 10 octobre 2026

## Fonctionnalité livrée

Sélecteur FR / EN / ES dans les en-têtes public, connecté et administration. Traductions locales chargées à la demande ; aucun service de traduction appelé par le site. Préférence conservée sur l’appareil et synchronisée entre onglets. Le changement conserve les états React, filtres et saisies.

Les libellés, formulaires, erreurs connues, analyses, dates, nombres et exports suivent la langue. L’assistant reçoit le code de langue ; le proxy Riot accepte uniquement les trois locales prévues. Les noms, notes et valeurs métier sont préservés. La recherche des parties reconnaît aussi les résultats, côtés et mois anglais/espagnols.

## Vérification

- `npm run i18n:check` : 3 197 clés explicites couvertes en anglais et espagnol, paramètres d’interpolation valides.
- `npm run verify` réussi sur la version intégrée à `main` : TypeScript, 188 suites / 3 227 tests, build et 13 pages pré-rendues vérifiées.
- `node tools/audit-dependencies.mjs` réussi selon la politique du dépôt.
- Régressions ciblées : langue différée, concurrence et échec/reprise ; formulaires et noms d’équipe préservés ; vues publiques/connectées/admin EN/ES ; formats, runes/objets et assistant ; recherche multilingue.
- `git diff --check` sans erreur de whitespace.
- Liens locaux du guide de maintenance vérifiés.

La version à publier est intégrée à `main` (`28d798c`) dans un checkout isolé. Les dernières évolutions des débriefs, de la draft, des analyses, du chargement et du profil restent présentes. Les autres chantiers locaux ne sont pas inclus.

## Navigateur

Contrôles avec le navigateur intégré, sur serveur local Vite puis sur le build de production servi localement :

- accueil et connexion FR / EN / ES ; titres du document et attribut `lang` adaptés ;
- passage EN → ES dans l’analyse de démonstration sans quitter l’onglet d’analyse ;
- restauration de l’anglais après rechargement du build compilé ;
- retour au français au clavier via le sélecteur natif ;
- absence de débordement horizontal aux largeurs 320, 390, 768, 1024 et 1440 px ;
- aucun avertissement ni erreur JavaScript relevé sur le rechargement final compilé.

Les services Netlify ne sont pas lancés dans l’aperçu statique : les préférences de confidentialité et les connexions sociales affichent donc leur indisponibilité traduite. Aucun compte réel n’a été créé ou modifié. Les vues privées sont vérifiées avec des données de test.

Les captures `home-en-preview.png` et `home-es-preview.png` montrent l’en-tête et la section d’accueil lors des premiers contrôles. Le build final intégré a également été contrôlé en FR/EN/ES, avec restauration de l’espagnol après rechargement. Le redimensionnement temporaire du navigateur est réinitialisé après contrôle.

## Maintenance et limites

Voir [le guide d’internationalisation](../../docs/internationalisation.md). Base de traductions automatisée et formulations revues sur les parcours principaux ; la vérification n’est pas une relecture linguistique exhaustive. Le HTML pré-rendu et les URL canoniques restent français. L’application Importer native, les services externes et les contenus déjà publiés hors site conservent leur langue propre.

Ces contrôles précèdent la publication GitHub → Netlify. Aucune migration de schéma ni modification de compte n’est ajoutée par cette fonctionnalité.
