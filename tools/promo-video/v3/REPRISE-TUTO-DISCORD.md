# Reprise : tutoriel « Ajouter le bot NXT5 à ton serveur Discord »

Note de reprise pour une session Claude lancée sur le PC Windows du propriétaire. La session précédente tournait dans le cloud : elle n’avait ni compte Discord ni accès à un écran, d’où cette reprise. Toutes les informations utiles sont dans le dépôt, sur la branche `claude/clever-meitner-votyvi`. Commencer par `git pull origin claude/clever-meitner-votyvi`.

## Objectif

Une vidéo YouTube tutoriel en français, au même format que celle de l’Importer (`TUTO-IMPORTER.md`, composition `TutoImporter`) : 1920×1080 à 30 i/s, sous-titres sans voix, captures réelles, curseur, zoom et bruitages, livrée en deux versions (avec et sans musique), avec sa miniature, son kit YouTube et des zips de moins de 30 Mio.

## Décisions du propriétaire

- **Rien n’est payant dans NXT5.** Aucun prix, offre, Pass, abonnement, essai ni « gratuit » / « Découverte », ni dans la vidéo, ni dans le kit, ni dans les captures. Ne jamais filmer `/tarifs` ou `/fonctionnalites`.
- **Vrais visuels Discord**, pris sur le serveur Discord NXT, dans une catégorie privée `Tuto NXT5` (salons `bot-nxt5` et `résultats`).
- **Vrais comptes du propriétaire, avec masquage avant tout commit.** Le dépôt est public. Toujours masquer :
  - l’identifiant du compte NXT5 (un identifiant de connexion) ;
  - le nom et l’avatar du propriétaire ;
  - la colonne des serveurs et le panneau utilisateur.
- **Données du site fictives :** équipe « Équipe Démo », partie fictive nommée « Aurore ». NXT5 affiche le nom de la partie comme adversaire, d’où le titre « Équipe Démo vs Aurore ».
- **Mentions légales sur la carte finale :** la ligne Riot de l’Importer, plus « Discord est une marque de Discord Inc. NXT5 n’est pas affilié à Discord. ».
- **Charte NXT5 v1.92**, documentée dans `docs/charte-graphique.md` (voir `AGENTS.md`).

## Où en est le travail

**Déjà fait :**
- **Moteur de tutoriel partagé.** `src/tuto/engine.ts`, `TutoFilm.tsx` et `FilmContext.ts` servent aux deux films. `TutoImporter` en sort identique au pixel près.
- **Captures du site.** 28 PNG dans `public/tuto-discord/site-*.png`, avec leurs cadres dans `src/tuto-discord/captures.json`. Le script est `capture/discord/run-site.sh`, et tous les noms viennent de `capture/discord/names.json`.
- **Film `TutoDiscord`** (`src/tuto-discord/`, storyboard `TUTO-DISCORD.md`) : 2 min 47 environ (5 024 images), 6 étapes.
- **Version de secours pour Discord.** En attendant les vraies captures, les passages Discord sont 7 illustrations dans la charte NXT5 (`src/tuto-discord/Schematics.tsx`, marquées « Illustration ») : autorisation du bot en deux temps, `/nxt lier`, vérification et confirmation de la liaison, `/nxt connecter`, message de test, partie publiée, visuel en grand. Elles citent mot pour mot les textes du bot et montrent les vraies images publiées. Elles ont été relues et corrigées, et le film peut déjà être rendu tel quel. Les vraies captures les remplacent : procédure « Revenir à une vraie capture » de `TUTO-DISCORD.md` (les plans de capture d’origine sont au commit `cd159d0`).

**Reste à faire, dans l’ordre :**
1. **Les captures Discord réelles.** Suivre `capture/discord/BRIEF-CAPTURES-DISCORD.md` à la lettre : qui fait quoi, écritures annoncées, masquage avec `mask.ps1`, manifeste, push.
   - Le contrôle de l’ordinateur (Claude Desktop) clique dans l’application Discord.
   - Le propriétaire fait les étapes dans le navigateur et le clic sur « Ouvrir NXT5 ».
   - `snap.ps1`, `mask.ps1` et git passent par le shell de la session Claude Code sur ce PC.
   - Si une séance précédente a déjà rempli `capture/discord/raw-local/`, réutiliser ces captures brutes : les masquer, les vérifier, remplir le manifeste et pousser.
2. **L’intégration.**
   - Relancer la capture du site : `run-site.sh` recopie dans `names.json` le nom du serveur, la commande de liaison et sa date depuis `public/tuto-discord/real/manifest.json`. Il faut `SITE_ROOT` vers une copie du site avec ses `node_modules` (`npm ci` à la racine du dépôt). Le rendu des aperçus a besoin du réseau (icônes Data Dragon).
   - Remplacer chaque illustration Discord par la vraie capture, en suivant la procédure « Revenir à une vraie capture » de `TUTO-DISCORD.md` : alias dans le script, cadres mesurés sur la PNG (`captures.json`, application `discord` en densité 1), même taille pour toutes les captures d’un plan.
   - Recouvrir les aplats magenta de `masks.json` par un cache soigné dans la charte.
   - Retirer le marquage provisoire.
3. **Les contrôles.** `npx tsc --noEmit`, `node src/tuto/export-cues.mjs discord --write`, puis `node src/tuto/export-cues.mjs importer`, dont la sortie doit rester identique à `src/tuto/cues.json`.
   - Faire des images fixes de chaque plan et les regarder.
   - Respecter les vérifications d’interface d’`AGENTS.md`.
   - Ne pas modifier `src/tuto/` sans comparer des images de `TutoImporter` rendues avant et après.
4. **Le son.** Même musique et mêmes clics que l’Importer (`src/tuto/TutoAudio.tsx`). Les bruitages suivent `src/tuto-discord/cues.json` ; il faut l’écouter et l’ajuster.
5. **Le rendu.** Deux versions :
   - `npx remotion render src/index.ts TutoDiscord out/nxt5-tuto-discord-raw.mp4`
   - la même commande avec `--props=props-nobgm.json` pour la version sans musique.
   - Puis `./master-tuto.sh` à −16 LUFS, avec un seul gain pour les deux fichiers (lancer le script depuis Git Bash).
6. **La relecture finale indépendante** par un autre agent, sur le MP4 réel : images extraites, synchronisation des clics, sons, textes et noms. Corriger, puis relire.
7. **Les livrables.**
   - Une miniature `TutoDiscordThumbnail`, sur le modèle de `src/tuto/TutoThumbnail.tsx`, enregistrée dans `src/Root.tsx`.
   - Un kit `TUTO-DISCORD-YOUTUBE.md` sur le modèle de `TUTO-YOUTUBE.md` : titre, description avec les mentions légales, chapitres tirés des temps réels, tags sans marque déposée.
   - Des zips de moins de 30 Mio.
8. **Commit et push** sur `claude/clever-meitner-votyvi`, sans pull request.

## Outils sur le PC

- Node 22 ou plus récent ; `npm ci` dans `tools/promo-video/v3`.
- ffmpeg ; Python 3 avec Pillow pour les scripts d’analyse.
- Chemins avec `/`.
- Les scripts `.ps1` sont en UTF-8 avec BOM pour Windows PowerShell 5.1.
