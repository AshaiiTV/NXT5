# NXT5 promo v3 — design spec (mode autonome, skill video-shotcraft)

## Produit et contraintes (stage 0)

- **Produit.** NXT5, l’espace de travail des équipes et coachs League of Legends : analyse des parties, débriefs, draft et champions, planning.
- **Audience et format.** Joueurs et équipes LoL francophones, sur YouTube en 16:9. Durée d’environ 40 s, en 1920×1080 à 30 fps.
- **Charte.** Charte graphique v1.92 du 13 octobre 2026, la source unique (copie de travail hors dépôt). Elle impose :
  - fond nuit `#111827` et verre violet ;
  - lumière cyan, violet et fuchsia ;
  - Inter seule ;
  - fichiers de marque officiels uniquement (wordmark, emblème) ;
  - le 5 en verre rendu par `glass-scene.js` ;
  - aucune promesse ni chiffre inventé ;
  - données d’exemple signalées comme fictives.
- **Données.** Démo publique de nxt5.org (équipe fictive « Horizon », scrims fictifs). Chaque capture porte « Données fictives ».
- **Texte.** Aucune mention de gratuité ni de prix.
- **Retours utilisateur intégrés.**
  - Textes trop rapides : chaque titre tient au moins 1,5 s une fois posé (R1, R3).
  - Motion jugé mauvais : je reprends les recettes du skill et leurs démos réglées.
  - Ennui : un seul héros par plan, chaque plan dit une chose nouvelle.
  - Scène des rôles supprimée.
  - Musique : un vrai morceau produit.

## Musique (music-beat-sync)

- **Morceau.** `g-eazy-nba-type.mp3` (« G Eazy NBA type », Arulo, licence Mixkit Stock Music Free, commercial OK). C'est le choix de l'utilisateur (« G-Eazy est cool »). Analyse de cat-walk conservée pour référence.
- **Grille.** 130,003 BPM, T = 0,46153 s. Elle est ajustée sur les onsets forts, en croches : erreur absolue moyenne 4,7 ms, aucune dérive (`analysis/geazy5.py` → `geazy130.json`).
- **Tempo affiché.** Le « 86 BPM » annoncé correspond au motif de kick trap 3-3-2 (noire pointée de 0,692 s). Le tempogramme et les intervalles entre onsets donnent 130.
- **Extrait.** Le film commence à 9,0085 s de la musique, soit 16 beats avant le drop. k désigne le beat du film.

| k | Musique | Événement |
|---|---|---|
| 0–8 | 9,0–12,7 s | Intro calme (−31 dB) |
| 8–16 | 12,7–16,4 s | Montée (−27 puis −18 dB) |
| 16 | 16,39 s | **Drop** : saut d’énergie mesuré à 16,376 s. Slam #1 |
| 44–48 | 29,3–31,2 s | Mesure creuse (−21 dB) |
| 48 | 31,16 s | **Retour** : slam #2 |
| 76 | 44,08 s | Entrée du breakdown : atterrissage du wordmark, slam #3 |

Les slams sont espacés de 32 et 28 beats.

## Direction visuelle (stage 1)

La charte stricte existe et les images clés v2 ont été validées (« c’est mieux ») : j’ai sauté la styleframe pour cette raison.

**Tokens de mouvement.** Premium esport, entre « 精致高端 » et « 活力大胆 » :

- durée principale 22f ;
- easing `bezier(0.16,1,0.3,1)` ;
- dépassement 1,04 seulement à l’atterrissage ;
- jamais de shake ;
- au plus 3 impacts plein cadre.

## Correspondance fonctionnalités → plans (stage 2)

| Fonctionnalité | Carte du skill | Raison |
|---|---|---|
| Accroche (défaite) | spotlight-hero-card | Héros unique, arc complet d’au moins 3 s (Q5) |
| Marque (le 5) | light-play-moves (halation-bloom) + blur-slide | Atterrissage lumineux du sculpté sur le drop |
| Analyse | input-trigger-moves (cursor-performance) | Vraie interaction : le curseur clique les moments 12:00 → 21:00 → 33:45 |
| Draft | deck-deal-flyin | Les 5 cartes champions distribuées dans les 5 emplacements |
| Planning | row-embed | Le programme de séance s’insère ligne à ligne |
| Respiration | paper-title-card (réhabillée nuit et verre) | Carte d’amorce avant le débrief (C2) |
| Débriefs | document-typewriter-reveal | Le débrief s’écrit lui-même (texture réelle, révélation ligne par ligne) |
| Clôture | outro-group-photo-launch | Les éléments déjà montrés entourent le wordmark, sommet d’énergie (Q8) |

## Storyboard (stage 3)

Une frame = 30 fps. `beatF(k) = round(k × 0,46153 × 30)`.

| # | k (beats) | Frames | Plan | Animation clé |
|---|---|---|---|---|
| 1 | 0–16 | 0–222 | Liste des parties de la démo | Le projecteur verrouille la ligne « Défaite · Scrim 1 », poussée à 45°, lévitation, tracé lumineux, retour. « Défaite. » puis « Tu sais vraiment pourquoi ? ». Fondu au noir avant le drop |
| 2 | 16–24 | 222–332 | Le 5 en verre | Slam #1 : le 5 entre en tournant avec une halation, puis « Comprends tes parties. Prépare la suite. » et le wordmark, tenu au moins 1 s |
| 3 | 24–34 | 332–471 | Revue d’équipe (courbe d’or) | Le curseur clique 12:00 → 21:00 → 33:45 et la vraie carte change d’état. « Revois chaque moment clé. » |
| 4 | 34–44 | 471–609 | Draft | Les 5 cartes champions sont distribuées en accélérant dans les emplacements, puis 0,5 s de repos. « Pense ta draft à cinq. » (l’en-tête de la vraie carte dit déjà « Cinq picks. Une intention. ») |
| 5 | 44–48 | 609–665 | Carte de respiration (mesure creuse) | « Et après la partie ? » |
| 6 | 48–60 | 665–831 | Débrief | Slam #2 : le débrief s’écrit étape par étape. « Note ce qui doit changer. » |
| 7 | 60–68 | 831–942 | Planning | Les lignes du programme s’insèrent, puis 5/5 disponibles. « Planifie la prochaine séance. » (la carte s’appelle déjà « Le rendez-vous du cinq ») |
| 8 | 68–84 | 942–1169 | Clôture | Les éléments convergent autour du wordmark, montée, atterrissage sur k76 (frame 1052, slam #3), scintillement, « Joue. Analyse. Recommence. », nxt5.org, « Essaie la démo ». Maintien jusqu’à la fin, fondu |

Réservations de maintien :

- marque et wordmark tenus au moins 1 s ;
- 0,5 s de repos après la distribution des cartes ;
- chaque titre tenu au moins 1,5 s.

## Écarts assumés (aesthetic-rules)

- **Bouton « Essaie la démo ».** Il suit la charte §6 : rayon de 2 px, dégradé primaire, texte `#020611`, sans halo au repos. Ce n’est donc pas une pilule.
- **Q9 dans la clôture.** La recette outro-group-photo-launch pose les éléments sur une scène, pas dans une page. Chaque pièce atterrit dans un emplacement fixe de la composition, et seule la ligne « Défaite » part de sa vraie place.
- **Débrief.** Le texte du document fait 16 px CSS. Il faut donc un zoom d’au moins 2 pour le lire en 32 px, ce qui ne laisse pas de colonne de titre à gauche. Le titre passe en bandeau bas (même style : sur-titre cyan, mot clé en spectre).

## Son (stage 6)

- **Musique.** `bgm.wav` est coupé 42,3 ms plus tard que la grille. Cela absorbe les 2032 échantillons de pré-roll AAC ajoutés par le rendu, mesurés par `analysis/sync_check.py`. Mesure faite sur le rendu : la musique tombe à 0,0 image de chaque beat de contrôle (k4, 16, 30, 48, 64, 76).
- **Effets.** Ils sont listés dans un seul tableau, `src/sfx.ts`, calés relativement à chaque plan. Chaque calage corrige le pic propre de l’échantillon (`analysis/sfx_peaks.json`) et le décalage de sortie (1,27 image).
- **Vocabulaire.** whoosh, impact, riser, sparkle et transition, plus des bruitages réels : clics, clavier, cartes. Les trois slams (k16, k48, k76) sont les seuls pics.
- **Master** (`master.sh`). Gain statique vers −14 LUFS, puis limiteur à −2,9 dBFS qui ne touche que les slams. Résultat : −14,5 LUFS et −2 dBTP. La version sans musique reçoit le même gain.
