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

Depuis la v3.2 (retrait du plan marque et du planning), le film est un montage de mesures entières du morceau, raccordées sur des barres (`MUSIC_SEGMENTS` dans `timeline.ts`, construit par `prepare-audio.py`). Le tableau donne les temps **du film** (k film = beat k8 à la frame 0).

| k film | Frames | Musique | Événement |
|---|---|---|---|
| 8–16 | 0–111 | Montée, puis un quasi-silence (sortie ≈ f105–110) | Accroche, plongée dans la fenêtre (C1) |
| 16 | 111 | **Drop** | Slam #1 : la revue arrive sur le drop |
| 24 | 222 | Coup fort | Accent sur « +4 000 or » |
| 36–40 | 388–443 | Mesure creuse | Carte de respiration |
| 40 | 443 | **Retour** | Slam #2 : le débrief |
| 52 | 609 | Pleine énergie | Retour dans la liste (C5) |
| 56–60 | 665–720 | Montée (mesure 39) | Assemblage de la clôture |
| 60 | 720 | **Second drop** | Lancement du wordmark, slam #3 |

Les slams (k16, k40, k60) sont espacés de 24 et 20 beats.

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
| ~~Marque (le 5)~~ | — | Retiré en v3.2 (« trop figé », demande de l’utilisateur) |
| Analyse | input-trigger-moves (cursor-performance) | Vraie interaction : le curseur clique les moments 12:00 → 21:00 → 33:45 |
| Draft | deck-deal-flyin | Les 5 cartes champions distribuées dans les 5 emplacements |
| ~~Planning~~ | — | Retiré en v3.2 (« la page avec les 5 rôles », demande de l’utilisateur) ; il ne reste ni dans la clôture ni ailleurs |
| Respiration | paper-title-card (réhabillée nuit et verre) | Carte d’amorce avant le débrief (C2) |
| Débriefs | document-typewriter-reveal | Le débrief s’écrit lui-même (texture réelle, révélation ligne par ligne) |
| Clôture | outro-group-photo-launch | Les éléments déjà montrés entourent le wordmark, sommet d’énergie (Q8) |

## Storyboard (stage 3)

Une frame = 30 fps. `beatF(k) = round((k − 8) × 0,46153 × 30)`.

| # | k (film) | Frames | Plan | Animation clé |
|---|---|---|---|---|
| 1 | 8–16 | 0–111 | Liste des parties de la démo | Le projecteur est déjà sur la ligne « Victoire · Scrim 3 », qui se soulève. « Victoire. » puis « Tu sais vraiment pourquoi ? ». Même une victoire se comprend : c’est la partie analysée dans tout le film. Les légendes sortent (f100–104), puis la caméra plonge dans la ligne, qui s’ouvre en fenêtre sur la revue du même match (C1) |
| 2 | 16–26 | 111–249 | Revue d’équipe (courbe d’or) | Slam #1 sur le drop : la carte arrive surpoussée (×1,16, monde ×1,2) et recule à son cadrage en 18 images. Le curseur clique 21:00 puis 33:45 et la vraie carte change d’état. Accent sur « +4 000 or » (k24). « Revois chaque moment clé. » |
| 3 | 26–36 | 249–388 | Draft | Entrée en fouetté (C2). Les 5 cartes champions sont distribuées en accélérant dans les emplacements. Le plateau se verrouille, puis la caméra plonge sur les cinq champions (60 % de la largeur au temps fort), avant une légère dérive. « Pense ta draft à cinq. » |
| 4 | 36–40 | 388–443 | Carte de respiration (mesure creuse) | Relais de mise au point (C3). « Et après la partie ? » |
| 5 | 40–52 | 443–609 | Débrief | La plaque de verre devient la carte (C4). Slam #2 : « 1. Le fait observé » s’imprime sur le coup, puis le débrief s’écrit étape par étape. Un surlignage cyan souligne l’action à mener. « Note ce qui doit changer. » |
| 6 | 52–76 | 609–948 | Clôture | La page se replie dans la ligne « Victoire » (C5), tenue avec la liste pleine jusqu’à f618. La ligne et la revue atterrissent ensemble (k53), puis le plateau de draft, le débrief, Ahri, Gnar, Jinx et la puce « 33:45 · Fin de partie » autour du wordmark pendant la montée. Lancement sur le second drop (k60, f720, slam #3), « Joue. Analyse. Recommence. », « Essaie la démo », nxt5.org. Carte finale tenue, fondu (fin f948) |

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
- **Entrée du wordmark.** Le wordmark officiel entre avec un éclat de halation dans la clôture. Le fichier n’est jamais modifié, seulement sa lumière et sa position (charte §4).

- **Accroche compressée.** La recette spotlight-hero-card tient en 111 frames (rapports de la démo conservés) : un seul tour de faisceau, 5 frames de repos après le retour. Les légendes restent pendant le retour pour tenir 1,5 s.
- **Draft.** Cinq cartes seulement : c’est la composition réelle de l’équipe, pas un paquet.
- **Lumière.** Une halation (clôture), l’éclair de bord au slam #2 et une lumière d’élément par couture (le bord cyan de la fenêtre en C1). Le reflet de l’analyse a été retiré.
- **Maintiens vivants.** Pendant les repos, la caméra dérive en transformation d’écran, avec un zoom CSS constant pour garder le texte net. Le texte reste fixe.
- **Étiquette « Données fictives ».** 32 px, à 80 px du bas : au-dessus de la barre de progression YouTube et à la taille minimale du texte secondaire (Q11). Elle reste au même endroit dans tous les plans.
- **Couleur de la victoire.** `#A7F3D0`, prélevée sur le libellé « Victoire » de la démo.

- **Bouton « Essaie la démo ».** Il suit la charte §6 : rayon de 2 px, dégradé primaire, texte `#020611`, sans halo au repos. Ce n’est donc pas une pilule.
- **Q9 dans la clôture.** La recette outro-group-photo-launch pose les éléments sur une scène, pas dans une page. Chaque pièce atterrit dans un emplacement fixe de la composition, et seule la ligne « Victoire » part de sa vraie place.
- **Débrief.** Le texte du document fait 16 px CSS. Il faut donc un zoom d’au moins 2 pour le lire en 32 px, ce qui ne laisse pas de colonne de titre à gauche. Le titre passe en bandeau bas (même style : sur-titre cyan, mot clé en spectre).

## Coutures (v3.5, `src/seams.tsx`)

Retour utilisateur : « Les transitions sont mauvaises ». Aucune coupe sèche ne reste. Chaque couture suit une carte du skill et son image clé tombe sur le temps. Le minutage des plans ne change pas : Main rend chaque plan à son image locale (`<ShotAt>`), et une couture compose les deux voisins.

| Couture | Temps | Carte | Ce qu’on voit |
|---|---|---|---|
| C1 | f111, k16 (drop, slam #1) | shot-transitions F, portail en profondeur | Les légendes sortent (f100–104). Dès f99, la caméra plonge dans la ligne « Victoire · Scrim 3 » sur une courbe tardive qui accélère encore (fenêtre et caméra en u⁴, bascule de face en u³) : presque immobile jusqu’à f103, l’essentiel du trajet tombe dans le quasi-silence de la musique (f105–110). La ligne s’ouvre en deux sur la revue du même match, vue à travers la fenêtre en espace écran (deux plans de parallaxe : la fenêtre bien plus vite que la carte derrière). La page autour s’enfonce dans la nuit et se floute. Le bord cyan (seule lumière) culmine f104–108 et sort du cadre entre f109 et f110. Derrière, la carte fonce vers l’objectif (×0,42 → 1 en échelle log, filé de zoom à demi-obturateur sur f105–110) et arrive **surpoussée sur le drop** (f111 = image 0 de l’analyse, ×1,16 sur son cadrage, monde ×1,2), puis recule à son cadrage (clé caméra 0 → 18, easing de marque). Le pas 110 → 111 est le plus grand zoom de la couture (+25 % pour la carte), suivi d’un renversement. |
| C2 | f249, k26 | shot-transitions E (whip-pan) | Fouetté de 8 images vers la droite, flou directionnel pendant le fouetté seulement, mi-course sur le temps. Les plaques ne portent plus leur étiquette : une seule « Données fictives » fixe. |
| C3 | f388, k36 (mesure creuse) | shot-transitions C (relais de mise au point) | Le titre du draft sort d’abord (sur-titre compris). Dès f379, la rangée de champions quitte le plan de netteté et baisse d’un tiers de diaphragme (8 px, −35 % en f385), avant le fondu (f381–397) : aucune lettre de la question n’apparaît sur un draft net. La carte de respiration devient nette, à mi-présence sur le temps. L’étiquette reste nette tant que le draft est visible à plus de 15 %. |
| C4 | f443, k40 (retour, slam #2) | transition-travel A (conteneur partagé) | Les quatre coins de la plaque de verre voyagent jusqu’à la carte du débrief (bord gauche, bord haut incliné). La page grandit dedans (×0,85 → 1) et le conteneur ne montre jamais que des pixels de la carte. La question reste nette jusqu’à f439, puis part en flou de zoom (f439–441) sur un verre resté entier : aucun texte de la page ne transparaît sous les mots. Le verre s’efface entre f441 et f442 ; la page apparaît en f442, encore floue de 3 px, nette en f443 (le débrief lui-même). Le bord haut du conteneur prend de l’avance (t^0,55), si bien qu’en f442 l’en-tête et la ligne au-dessus sont entiers. L’atterrissage du débrief (×1,16 → 1) fait le dépassement. |
| C5 | f609, k52 | transition-travel A (retour) | La légende du débrief sort d’abord (f589–599). Le conteneur part de la carte elle-même (de son bord gauche au bord droit du cadre) : il ne montre que des pixels de la carte, et la bande de nuit à sa gauche se fond dans la liste (t 0 → 0,35). La page se replie sur l’action surlignée (f600–609, vitesse maximale f605–607). L’action s’efface (t 0,70 → 0,85) avant que la face de la ligne n’arrive (t 0,85 → 1) : les deux ne se superposent jamais. La ligne se pose dans la liste sur f609 ; la liste attend à 0,9 et remonte à 1 de f607 à f611 (rituel de la carte). Ligne et liste restent pleines jusqu’à f615–618, puis la ligne descend au pied de la scène (atterrissage avec la revue sur k53). C’est la paire de C1 (entrer, revenir). |

Écarts assumés :

- **Durées.** Les cartes visent 25 à 45 images ; les coutures en prennent 8 à 20 pour garder le minutage aux temps et les maintiens de légende (≥ 1,5 s). C1 suit le « lent puis vite » du portail (puissances 3 à 4 sur 12 images, au lieu d’une bezier sur 40) ; C5 garde bezier(0,8, 0, 0,5, 1) sur 9 images.
- **C1, impact.** Le slam #1 est l’un des trois impacts plein cadre permis : la carte et le monde arrivent surpoussés sur le drop puis reculent, sans oscillation ni tremblement. La différence d’image (luminance moyenne) reste plus forte sur f105–109, quand le bord de la fenêtre balaie le cadre, que sur le drop lui-même ; c’est le pas de zoom et le renversement qui portent le coup sur f111.
- **Fouetté.** L’écart de 1,5 écran laissait deux images noires au milieu sur la palette nuit (mesuré). Les deux scènes sont accolées : vitesse de pointe 576 px/image, au-dessus des 300 de la carte.
- **Avant-plan.** Remotion n’affiche aucune `<Img>` à un temps local négatif. Un plan entrant attend donc sur sa propre image 0. Analyse masque son titre et son étiquette pendant cette attente (`preRoll`). Dans les coutures, les plans portent `hideTag` et la couture dessine la seule étiquette, toujours au même endroit.
- **Lumière.** Une seule par couture, au niveau de l’élément : le bord cyan de C1 (les autres coutures n’en ajoutent pas). Aucun nouvel impact plein cadre : les trois slams restent f111, f443 et f720.
- **C4, image f441.** La question en flou de zoom passe sur le verre (et non plus sur la page) ; la page n’apparaît qu’en f442.

## Son (stage 6)

- **Musique.** `bgm.wav` est coupé 42,3 ms plus tard que la grille. Cela absorbe les 2032 échantillons de pré-roll AAC ajoutés par le rendu, mesurés par `analysis/sync_check.py`. Mesure faite sur le rendu : la musique tombe à 0,0 image de chaque beat de contrôle (k9 à k80, raccord compris ; `analysis/music_check.py`).
- **Effets.** Ils sont listés dans un seul tableau, `src/sfx.ts`, calés relativement à chaque plan. Chaque calage corrige le pic propre de l’échantillon (`analysis/sfx_peaks.json`) et le décalage de sortie (1,27 image).
- **Vocabulaire.** whoosh, impact, riser, sparkle et transition, plus des bruitages réels : clics, clavier, cartes. Les trois slams (film k16, k40, k60) sont les pics du mix et le slam final reste le plus fort.
- **Coutures (v3.5).** Chaque couture a son son, calé sur son image clé (pics mesurés sur le rendu, sortie AAC comprise) :
  - C1 : riser filtré qui monte avec la plongée (pic ≈ f107,5), coupé vers f108,3. La musique est alors dans son quasi-silence (−46 dB en f109), puis `hit-fast-exciting` + `bass-hit-short` sur le drop (−13 / −11 dB en f110–111) : la grammaire du slam #3 ;
  - C2 : `whoosh-fast`, pic et arrêt net sur la mi-course du fouetté (f249) ;
  - C3 : `transition-soft`, pic sur la mi-présence (f388) ; l’ancien `swoosh-quick` de la carte est retiré ;
  - C4 : riser sous la plaque qui grandit (pic f438,5, coupé vers f440), `swoosh-quick` quand le verre s’efface (f442), puis les deux coups du slam #2 (f443) ;
  - C5 : `swoosh-quick` sur le repli (pic f605) et `transition-snap` sur la pose dans la liste (f609).
  Retirés : `air-woosh-deep` (« plongée au noir », f109) et le `transition-soft` d’entrée de la revue (f119), dont les mouvements n’existent plus.
- **Second drop.** La musique laisse environ 5 images de silence avant k76. Le riser (copie filtrée au-dessus de 200 Hz, la partie qui monte seulement) s’arrête 5 images avant le drop avec un fondu. L’impact est coupé dans son attaque (`trimBefore` 15) et son départ est calé sur le kick de la musique. Résultat mesuré : environ −35 dB sur les 3 images qui précèdent, puis un saut de 30 dB (revues n° 2 et 3). La musique s’éteint avant le temps k92 pour qu’aucun coup ne tombe sur le noir final.
- **Master** (`master.sh`). Gain statique vers −14 LUFS, puis limiteur à −2,9 dBFS qui attrape surtout les slams et les impacts. Résultat (v3.5, 14 octobre) : −14,4 LUFS et −2,0 dBTP ; énergie sur 150 ms au slam #1 −6,6 dB, au slam #2 −7,6 dB, au slam #3 −5,5 dB (le plus fort). La version sans musique reçoit le même gain (−17,2 LUFS).
