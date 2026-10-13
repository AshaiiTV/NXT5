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

- **Morceau.** `cat-walk.mp3` (Arulo, licence Mixkit Stock Music Free, commercial OK).
- **Grille.** Calée sur les kicks : 130,00 BPM, T = 0,46155 s, t0 = 0,0179 s. Erreur absolue moyenne 2,9 ms, aucune dérive (`analysis/catwalk_grid.json`).
- **Extrait.** Le film commence au beat musical 48 (22,172 s). k désigne le beat du film (k = beat musical − 48).

Structure de l’extrait :

| Beat musical | k | Événement |
|---|---|---|
| 48–63 | 0–15 | Énergie moyenne, creux sur le beat 63 |
| 64 | 16 | **Drop** (+11 dB) : slam #1 |
| 96–99 | 48–51 | Mesure de respiration (creux, −23,8 dB au beat 99) |
| 100 | 52 | **Retour** : slam #2 |
| 128 | 80 | Entrée du breakdown : atterrissage du wordmark, slam #3 |

Les trois slams sont espacés de 36 et 28 beats (minimum 16, R4).

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

| # | k (beats) | Temps | Plan | Animation clé |
|---|---|---|---|---|
| 1 | 0–16 | 0–7,4 s | Liste des parties de la démo | Le projecteur verrouille la ligne « Défaite · Scrim 1 », poussée à 45°, lévitation, tracé lumineux, retour. « Défaite. » (k2), « Tu sais vraiment pourquoi ? » (k8). Fondu au noir sur le creux du beat 63 |
| 2 | 16–24 | 7,4–11,1 s | Le 5 en verre | Slam #1 : le 5 entre en tournant, halation, wordmark officiel, « Comprends tes parties. Prépare la suite. », maintien d’au moins 1 s |
| 3 | 24–32 | 11,1–14,8 s | Revue d’équipe (courbe d’or) | Le curseur clique 12:00 → 21:00 → 33:45 ; la vraie carte change d’état. « Revois chaque moment clé. » |
| 4 | 32–40 | 14,8–18,5 s | Draft | 5 cartes champions distribuées en accélérant dans les emplacements, carte remplie puis tenue 0,5 s. « Cinq picks. Une intention. » |
| 5 | 40–48 | 18,5–22,2 s | Planning | Les lignes du programme s’insèrent, puis 5/5 disponibles. « Le cinq au rendez-vous. » |
| 6 | 48–52 | 22,2–24,0 s | Carte de respiration | « Et après la partie ? » |
| 7 | 52–66 | 24,0–30,5 s | Débrief | Slam #2 : le débrief s’écrit étape par étape. « Note ce qui doit changer. » |
| 8 | 66–88 | 30,5–40,6 s | Clôture | Les éléments convergent autour du wordmark, montée (k72), impact (k80, slam #3), scintillement. « Joue. Analyse. Recommence. », nxt5.org, « Essaie la démo », maintien et fondu final |

Réservations de maintien :

- marque et wordmark tenus au moins 1 s ;
- 0,5 s de repos après la distribution des cartes ;
- chaque titre tenu au moins 1,5 s.
