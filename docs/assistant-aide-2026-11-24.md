# Assistant et aide du bot Discord — 24 novembre 2026

Branche : `claude/assistant-aide-20261124`. Remplace la PR #69 (`codex/assistant-refresh-20260923`), restée 222 commits en retard et en conflit.

## Repris de #69, adapté à `main`

- L’assistant connaît le bot Discord actuel : cinq commandes (`/nxt help`, `lier`, `profil`, `voir`, `connecter`), salon des commandes par équipe, rôles de **Accès aux commandes**, protections de liaison (#302 : nom d’utilisateur affiché, avertissement, e-mail d’avis, e-mail vérifié requis) et limite de 30 s des réponses publiques de `/nxt voir`.
- L’assistant connaît **Paramètres → Connexions associées**, le changement d’e-mail confirmé par lien (#303), **Rester connecté** et le **Mode performance**.
- Soutien facultatif : nouvelle fiche `support` (`/soutenir`, Ko-fi, aucun accès débloqué).
- Documents `docs/assistant/*` actualisés, nouveau `discord-compte-soutien.md`.

## Ajouté (absent de #69)

- Fiche `draft-room` pour la **Salle de draft** (`/draft/salle`, chemin autorisé) : création, liens adverse et spectateur sans compte, capitaines prêts, Standard/Fearless, correction et suppression. Le panneau envoie la rubrique `draft-room` sur cette page (`assistantSectionForRoute`), le guide n’ayant pas de rubrique dédiée.
- FAQ sur la collecte automatique réservée aux customs (Importer 0.4.9).
- Profil : libellés actuels (Champions joués, Champion pool, carte et Wrapped en tête de Synthèse, Parties par page).
- Aide `/nxt help` : vocabulaire « partie » et « débrief », sujets de `/nxt voir` précisés (`draft` = compositions enregistrées), règle des 30 s, avertissement de liaison, étape « Tester et activer », rappel de ce qui se fait sur le site (dont la Salle de draft), fiche « Sécurité » de `/nxt lier`.
- Traductions anglaises et espagnoles des fiches et des questions proposées.

## Abandonné de #69

- `route-suggestions.js` : `main` choisit déjà les questions par rubrique du guide (`guideSectionForRoute`).
- Transmission des FAQ au modèle dans `assistant-chat.ts` : déjà présente sur `main`.
- Guide Discord en six pages, fiches `compte lier`, `equipe choisir`, `review creer`… : ces commandes ne sont plus proposées (catalogue à cinq commandes).
- Modifications des messages de `discord-bot-account.ts` et `discord-bot-read.ts` : remplacées par celles de #302.
- Textes sur « Mon abonnement », Tendances à cinq rubriques, reviews à modèles, Importer non notarisé : ne correspondent plus au site actuel.

Le plafond journalier des appels facturés (#92) et le reste de `assistant-chat.ts` sont inchangés. Aucun appel à l’IA ni à Discord n’a été fait pour tester.

## Vérification

`npm run verify` ; tests ajoutés dans `assistant-knowledge.test.ts` et `discord-bot-help.test.ts`. Les nouveaux textes de `/nxt help` prennent effet au déploiement, sans réenregistrer `/nxt`.
