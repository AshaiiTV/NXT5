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
- **Extrait.** Le beat k du film correspond à la musique 9,0085 + k × T. Le film s’ouvre sur k8 (12,70 s, début de la montée) : le drop arrive à 3,7 s.
- **Raccord.** À k72, la musique est raccordée sur une barre de mesure à la mesure 39 (73,622 s, une montée). Le second drop du morceau (75,469 s) tombe ainsi sur k76, l’atterrissage du wordmark. Avant le raccord, k76 tombait dans le creux du morceau (revue indépendante n° 1). `prepare-audio.py` construit `bgm.wav` avec un fondu de 10 ms au raccord.

| k | Musique | Événement |
|---|---|---|
| 8–16 | 12,7–16,4 s | Montée (−27 puis −18 dB), accroche |
| 16 | 16,39 s | **Drop** : slam #1 |
| 32 | 23,78 s | Coup fort (3ᵉ de l’extrait après k76 et k64) : accent sur « +4 000 or » |
| 44–48 | 29,3–31,2 s | Mesure creuse (−21 dB), carte de respiration |
| 48 | 31,16 s | **Retour** : slam #2 |
| 72–76 | 73,6–75,5 s (raccord) | Montée sous l’assemblage de la clôture |
| 76 | 75,47 s | **Second drop** : lancement du wordmark, slam #3 |
| 76–92 | 75,5–82,9 s | Pleine énergie jusqu’à la fin |

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

Une frame = 30 fps. `beatF(k) = round((k − 8) × 0,46153 × 30)`.

| # | k (beats) | Frames | Plan | Animation clé |
|---|---|---|---|---|
| 1 | 8–16 | 0–111 | Liste des parties de la démo | Le projecteur est déjà sur la ligne « Victoire · Scrim 3 », qui se soulève. « Victoire. » puis « Tu sais vraiment pourquoi ? ». Même une victoire se comprend : c’est la partie analysée dans tout le film. Retour, puis plongée au noir avant le drop |
| 2 | 16–24 | 111–222 | Le 5 en verre | Slam #1 : le 5 entre en tournant avec une halation, puis « Comprends tes parties. Prépare la suite. » et le wordmark. Le 5 flotte pendant le maintien |
| 3 | 24–34 | 222–360 | Revue d’équipe (courbe d’or) | Le curseur clique 21:00 puis 33:45 et la vraie carte change d’état. Accent sur « +4 000 or » au k32. « Revois chaque moment clé. » |
| 4 | 34–44 | 360–498 | Draft | Les 5 cartes champions sont distribuées en accélérant dans les emplacements, puis repos en légère dérive. « Pense ta draft à cinq. » (la carte dit déjà « Cinq picks. Une intention. ») |
| 5 | 44–48 | 498–554 | Carte de respiration (mesure creuse) | « Et après la partie ? » |
| 6 | 48–60 | 554–720 | Débrief | Slam #2 : « 1. Le fait observé » s’imprime sur le coup, puis le débrief s’écrit étape par étape. « Note ce qui doit changer. » |
| 7 | 60–68 | 720–831 | Planning | Les lignes du programme s’insèrent, puis poussée sur « 5 / 5 disponibles » (lisible). « Planifie la prochaine séance. » |
| 8 | 68–92 | 831–1163 | Clôture | La ligne « Victoire » ouvre, les éléments convergent autour du wordmark pendant la montée, lancement sur le second drop (k76, frame 942, slam #3), « Joue. Analyse. Recommence. », « Essaie la démo », nxt5.org. Carte finale tenue 5,5 s (écran de fin YouTube), fondu |

Réservations de maintien :

- marque et wordmark tenus au moins 1 s ;
- 0,5 s de repos après la distribution des cartes ;
- chaque titre tenu au moins 1,5 s.

## Écarts assumés (aesthetic-rules)

- **« Énergie LoL / Persona ».** C’est la demande de l’utilisateur. Elle se traduit par :
  - une musique trap à 130 BPM et trois slams sur ses vrais temps forts ;
  - des titres « snap » qui claquent mot par mot sur les croches (Inter 800, échelle 1,18 → 1 en 5 images, sans flou), ce qui reste au niveau des éléments (R4) ;
  - des coupes sèches sur les temps et des champions montrés en grand au temps fort k43.

  La charte (nuit, verre violet, Inter seule) reste la limite : aucune typographie ni couleur empruntée à Persona.
- **Rotation d’entrée du 5 en verre.** Le 5 entre en tournant depuis l’arrière (pose de `glass-scene.js` animée), alors que la charte §9 décrit une pose stable. La pose officielle est atteinte en 0,75 s, puis le 5 flotte. Les images f111 à f118 (rotation rapide, sous la halation) montrent des faces étirées par le moteur : c’est une limite connue.
- **Entrée du wordmark.** Le wordmark officiel entre en fondu et en montée dans la marque, puis avec un éclat de halation dans la clôture. Le fichier n’est jamais modifié, seulement sa lumière et sa position (charte §4).

- **Accroche compressée.** La recette spotlight-hero-card tient en 111 frames (rapports de la démo conservés) : un seul tour de faisceau, 5 frames de repos après le retour. Les légendes restent pendant le retour pour tenir 1,5 s.
- **Draft.** Cinq cartes seulement : c’est la composition réelle de l’équipe, pas un paquet.
- **Lumière.** Deux halations (marque, clôture). S’y ajoutent l’éclair de bord au slam #2 et les coutures de row-embed, qui sont le bruitage visuel de la recette. Le reflet de l’analyse a été retiré.
- **Maintiens vivants.** Pendant les repos, la caméra dérive en transformation d’écran, avec un zoom CSS constant pour garder le texte net. Le texte reste fixe.
- **Couleur de la victoire.** `#A7F3D0`, prélevée sur le libellé « Victoire » de la démo.

- **Bouton « Essaie la démo ».** Il suit la charte §6 : rayon de 2 px, dégradé primaire, texte `#020611`, sans halo au repos. Ce n’est donc pas une pilule.
- **Q9 dans la clôture.** La recette outro-group-photo-launch pose les éléments sur une scène, pas dans une page. Chaque pièce atterrit dans un emplacement fixe de la composition, et seule la ligne « Défaite » part de sa vraie place.
- **Débrief.** Le texte du document fait 16 px CSS. Il faut donc un zoom d’au moins 2 pour le lire en 32 px, ce qui ne laisse pas de colonne de titre à gauche. Le titre passe en bandeau bas (même style : sur-titre cyan, mot clé en spectre).

## Son (stage 6)

- **Musique.** `bgm.wav` est coupé 42,3 ms plus tard que la grille. Cela absorbe les 2032 échantillons de pré-roll AAC ajoutés par le rendu, mesurés par `analysis/sync_check.py`. Mesure faite sur le rendu : la musique tombe à 0,0 image de chaque beat de contrôle (k9 à k80, raccord compris ; `analysis/music_check.py`).
- **Effets.** Ils sont listés dans un seul tableau, `src/sfx.ts`, calés relativement à chaque plan. Chaque calage corrige le pic propre de l’échantillon (`analysis/sfx_peaks.json`) et le décalage de sortie (1,27 image).
- **Vocabulaire.** whoosh, impact, riser, sparkle et transition, plus des bruitages réels : clics, clavier, cartes. Les trois slams (k16, k48, k76) sont les pics du mix.
- **Second drop.** La musique laisse environ 5 images de silence avant k76. Le riser (copie filtrée au-dessus de 200 Hz) s’arrête 3 images avant le drop, avec un fondu, et l’impact démarre sur son attaque (`trimBefore`). Le silence suivi du coup reste ainsi audible (revue n° 2, N1). La musique s’éteint avant le temps k92 pour qu’aucun coup ne tombe sur le noir final.
- **Master** (`master.sh`). Gain statique vers −14 LUFS, puis limiteur à −2,9 dBFS qui ne touche que les slams. Résultat : −14,3 LUFS et −2,2 dBTP. La version sans musique reçoit le même gain.
