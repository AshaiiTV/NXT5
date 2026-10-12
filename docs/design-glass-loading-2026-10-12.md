# Chargement Nexus en verre violet — 12 octobre 2026

L’écran de chargement de l’espace connecté place l’emblème officiel NXT5 au centre d’une scène de verre violet. Les cinq rôles League of Legends convergent vers lui ; le statut réel, le compteur et la progression apparaissent directement sous la scène. La charte unique reste celle indiquée dans [AGENTS.md](../AGENTS.md).

L’emblème flotte au-dessus de grands plans de verre aux bords fondus. La matière appartient au décor ; l’information de chargement forme une zone de lecture ouverte sous la scène.

## Composition

- Le wordmark officiel, la scène et la progression suivent un axe central. La phase active devient le titre `h1`, accompagnée d’un texte court.
- Le sol est dessiné en SVG : plans translucides en perspective, arêtes cyan/lavande/fuchsia, profondeur et fondus latéraux et inférieurs. Le décor WebP de l’accueil et des voiles bleu nuit donnent de la profondeur tout en préservant la lecture.
- TOP / JGL / MID / ADC / SUP forment un éventail de pictogrammes et de noms, sans boîtes individuelles. Leurs trajectoires et signaux lumineux rejoignent l’emblème. Les pictogrammes locaux proviennent de `RoleIcon`.
- Le symbole utilise le PNG officiel complet et ses variantes WebP de 256 et 512 px. Sa transparence, ses trois branches et ses proportions sont conservées. Le WebP de 512 px pèse 43 460 octets.
- Sur téléphone, la scène et les espacements se resserrent autour du statut. En paysage bas, la scène devient compacte, le wordmark passe en haut à gauche et les détails secondaires ainsi que la signature peuvent disparaître.

Sources : [AppLoadingScreen.jsx](../src/components/loading/AppLoadingScreen.jsx), [AppLoadingScreen.css](../src/components/loading/AppLoadingScreen.css) et [BrandAssets.jsx](../src/components/brand/BrandAssets.jsx).

## Mouvement et chargement réel

L’arrivée de la scène, de l’emblème et des rôles utilise CSS. Pendant l’attente, l’emblème flotte légèrement et les signaux parcourent les trajectoires SVG. Le sol, ses reflets et l’atmosphère restent fixes. Aucune dépendance, boucle JavaScript permanente ou moteur 3D n’est ajouté. Le composant décoratif reste monté pendant les changements de phase et de compteur.

Les modes mouvement réduit et performance affichent la composition complète sans animation ni transition ; le mode performance retire également les filtres. Le statut et la progression restent compréhensibles dans ces modes.

Le cycle réel **Ouverture / Connexion / Synchronisation**, les annonces accessibles et les valeurs issues des parties reçues gardent leur fonctionnement. Les valeurs connues sont bornées entre zéro et le total ; sans total exploitable, la barre reste indéterminée. Le compteur de phase indique une étape, sans prétendre mesurer le pourcentage du chargement. Aucun délai ni pourcentage simulé n’est ajouté.

Le statut est annoncé par une zone `role="status"` polie et atomique. La barre expose les valeurs connues et son libellé ; les étapes restent ordonnées et identifient l’étape courante. La scène décorative est masquée aux technologies d’assistance. Les sorties de chargement après réussite ou erreur, la reprise et le pré-rendu des routes publiques conservent leur fonctionnement.

## Validation de la composition Nexus

`npm run verify` a réussi sur cette révision : **209 suites, 3 915 tests**, typage, **3 570 messages** explicites couverts en anglais et espagnol, build et **13 pages prérendues**. Le journal de cette passe est `artifacts/glass-loading/nexus-verify.log`. Les dépendances sont inchangées depuis l’audit conforme à la politique du dépôt, avec son exception temporaire de build préexistante.

La validation du composant réel compilé sous la CSP du site couvre **162 combinaisons** : trois phases, FR/EN/ES, modes normal/mouvement réduit/performance et six formats (1440 × 1000, 1000 × 700, 768 × 1024, 390 × 844, 320 × 740 et 844 × 390). Toutes les vues gardent le titre, le compteur, la barre, les rôles et les étapes dans le viewport, sans erreur JavaScript/CSP, image manquante ou débordement.

Les **24 transitions de progression** contrôlent le passage entre phases, 0 → 7 → 18 sur 18, les valeurs hors limites, le total nul et le maintien de la scène. Les **630 mesures sur 54 scénarios d’animation** couvrent l’arrivée et le cycle de flottement de six secondes : la distance en deux dimensions entre l’emblème et les rôles reste d’au moins **27,59 px**, supérieure aux 24 px requis. Les modes mouvement réduit et performance sont statiques. Les captures finales ont été inspectées, notamment les fondus latéraux du sol et les petits formats.

La relecture a corrigé le compteur anglais et espagnol en « GAMES RECEIVED » et « PARTIDAS RECIBIDAS », ainsi que la formulation accessible anglaise du ratio. Après cette retouche, le contrôle des 3 570 messages, les 18 tests d’internationalisation et le build ont de nouveau réussi ; les captures EN/ES sur téléphone font l’objet d’un contrôle ciblé.

Un contrôle du build avec les réécritures Netlify vérifie également le véritable écran de connexion et l’accueil public, sur ordinateur et téléphone : emblème 512 px identique au fichier local, aucune erreur JS/CSP ou image manquante, progression visible et accueil public sans écran de chargement.

Ces vérifications utilisent des données fictives et interceptent les API avant le réseau. Elles ne lisent ni ne modifient les données privées de production. Les preuves finales sont conservées localement sous `artifacts/glass-loading/`, notamment `nexus-final-checks.json`, `nexus-final-cycle-checks.json`, les captures `nexus-final-*` et les rapports `live-smoke-*` ; ce dossier n’est pas embarqué dans le site.

La [PR #172](https://github.com/AshaiiTV/NXT5/pull/172) porte cette réalisation. La charte canonique et les preuves locales consignent le commit et les contrôles de publication après vérification de l’aperçu et de la production.
