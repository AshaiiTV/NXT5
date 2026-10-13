# Vérification locale des lectures de partie

Depuis le checkout : `node tools/match-reading-qa.mjs`.

Ouvrir `http://127.0.0.1:5198/games?qa=full&open=both`.
Le serveur écoute seulement sur l’interface locale, ne charge aucun fichier `.env` et ne joint aucun backend NXT5.
Les données sont entièrement inventées. Le cadre utilise les vrais `AmbientBackground`, `Sidebar`, `Topbar` et `MatchDataPanel`.

Scénarios `qa` : `full`, `compact`, `no-timeline`, `partial`, `long-names`.
Le scénario complet possède 10 participants, 27 relevés, plusieurs fenêtres de combat, objectifs et structures, dont plus de six événements avant 14 minutes.
`compact` conserve les événements sans inventer de relevés d’or. `partial` retire un participant, des mesures et des relevés ; il conserve aussi un zéro mesuré en vision.

Paramètres supplémentaires :

- `open=points`, `open=timeline` ou `open=both` ouvre les volets natifs après montage ; sans paramètre ils restent repliés.
- `lang=fr`, `lang=en` ou `lang=es` utilise les traductions réelles.
- `sidebar=collapsed` ouvre le menu réduit.
- `performance=1` active le mode performance.

Vérifier 360, 390, 768, 1024 et 1440 px, les deux volets et les noms longs. Vérifier clavier/focus, états sans chronologie, chronologie résumée et chiffres absents.

Les portraits publics sont désactivés par défaut pour exercer les replis natifs.
`NXT5_QA_PUBLIC_ASSETS=1 node tools/match-reading-qa.mjs` autorise uniquement les images de Data Dragon et CommunityDragon via un proxy local sans transmettre de cookies ni d’identifiants.
`NXT5_QA_PORT` permet de changer le port (5198 par défaut).
