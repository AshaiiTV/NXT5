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
| 4 | 34–44 | 471–609 | Draft | Les 5 cartes champions sont distribuées en accélérant dans les emplacements, puis 0,5 s de repos. « Cinq picks. Une intention. » |
| 5 | 44–48 | 609–665 | Carte de respiration (mesure creuse) | « Et après la partie ? » |
| 6 | 48–60 | 665–831 | Débrief | Slam #2 : le débrief s’écrit étape par étape. « Note ce qui doit changer. » |
| 7 | 60–68 | 831–942 | Planning | Les lignes du programme s’insèrent, puis 5/5 disponibles. « Le cinq au rendez-vous. » |
| 8 | 68–84 | 942–1169 | Clôture | Les éléments convergent autour du wordmark, montée, atterrissage sur k76 (frame 1052, slam #3), scintillement, « Joue. Analyse. Recommence. », nxt5.org, « Essaie la démo ». Maintien jusqu’à la fin, fondu |

Réservations de maintien :

- marque et wordmark tenus au moins 1 s ;
- 0,5 s de repos après la distribution des cartes ;
- chaque titre tenu au moins 1,5 s.
