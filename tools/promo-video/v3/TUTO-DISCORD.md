# Tutoriel « Ajouter le bot NXT5 à ton serveur Discord » : storyboard

Ce tutoriel YouTube montre le parcours complet, de l’invitation du bot jusqu’à la première partie publiée dans un salon Discord.

- **Format.** Vidéo de 2 min 42 environ (4 864 images), en 1920×1080 à 30 i/s, composition Remotion `TutoDiscord` de ce projet. Le film est décrit comme données dans `src/tuto-discord/script.ts` ; le moteur commun des tutoriels (`src/tuto/engine.ts`, `TutoFilm.tsx`, `parts/`, `shots/`) le minute et le dessine, comme pour `TutoImporter`. Les captures du site sont dans `public/tuto-discord/`, celles de Discord dans `public/tuto-discord/real/`, leurs boîtes dans `src/tuto-discord/captures.json`. Liste des repères sonores et contrôles : `node src/tuto/export-cues.mjs discord --write` (écrit `src/tuto-discord/cues.json`). Même habillage sonore que l’Importer : nappe `public/audio/tuto-bgm.mp3` et clics de souris synthétisés.
- **Décisions du propriétaire.**
  - Rien n’est payant dans NXT5 : le film ne montre et ne dit rien de commercial, ni à l’écran ni dans les sous-titres.
  - L’interface de Discord n’est jamais imitée ni redessinée : uniquement les vraies captures de la séance décrite dans `capture/discord/BRIEF-CAPTURES-DISCORD.md`, ou, en attendant, des cartes d’attente neutres (voir « Captures Discord »). Le film n’a aucun schéma.
  - Sous-titres à l’écran, sans voix.
  - L’autorisation « Administrateur » est nommée dans un sous-titre, puisque le site la mentionne avant l’invitation.
  - La publication manuelle est filmée ; la publication automatique des parties importées ensuite n’est que rappelée en sous-titre (son délai n’est pas garanti : jamais « instantané »).
  - La partie fictive s’appelle « Aurore », comme dans le brief : le message Discord s’intitule « Équipe Démo vs Aurore ».
- **Sources.** Les textes exacts viennent de `src/components/discord/{DiscordSettings,DiscordAccount,DiscordGameShare,discord-shared}.jsx`, `src/pages/workspace/DiscordWorkspace.jsx`, `netlify/functions/discord-interactions.ts`, `netlify/functions/_lib/{discord-bot-account,discord-test,discord-client}.ts` et `shared/discord-command.js`. Les sous-titres citent les libellés visibles : « Ajouter à Discord » (pas « Ajouter le bot »), les onglets « Serveur », « Salons » et « Activation », « Enregistrer les salons », « Exporter sur Discord ». L’ordre du film est celui qu’impose le code : bot invité avant `/nxt lier`, compte lié avant `/nxt connecter`, salons enregistrés avant le test, test avant l’activation, activation avant la publication.
- **Charte.** Charte NXT5 v1.92 (`src/theme.ts`, `src/tuto/style.ts`) : fond nuit, verre violet, Inter, wordmark officiel. Chaque capture du site porte « Données fictives ». Les captures Discord ne portent aucune étiquette, sauf celles qui montrent la partie de démonstration (dc12 à dc14) : « Partie fictive ». La carte « À retenir » porte en petit la mention Riot de l’Importer (le visuel de la partie montre des portraits de champions) et « Discord est une marque de Discord Inc. NXT5 n’est pas affilié à Discord. ». Les touches « Entrée » et « Ctrl + V » sont les pastilles de touches du moteur, pas une interface de Discord.
- **Rythme.** C’est un tutoriel, pas une bande-annonce. Chaque sous-titre reste lisible au moins 2,5 s, à 17 caractères par seconde au plus (contrôle automatique), et chaque clic est précédé d’un mouvement de curseur visible. Le zoom amène le bouton visé en grand avant le clic.
- **Caméra et enchaînements.** Mêmes règles que l’Importer : caméra calme (au plus 35 px par image au centre de l’écran, sans à-coup), recul puis approche pour traverser la page, coupe franche sous l’onde du clic quand la mise en page change, fondu seulement quand rien ne bouge, passage par le noir pour changer d’application. Les cibles des clics et les halos restent dans la zone utile (contrôle automatique). En plus :
  - **Raccords.** Quand un clic insère un bloc sans changer le reste (code de liaison, salon choisi, « Salons enregistrés. », reçu du test, récapitulatif d’activation), la coupe franche est un raccord : la caméra suit exactement le défilement de la nouvelle capture, si bien que tout ce qui n’a pas changé reste immobile. Ces raccords sont cadrés à z 2,4 sur le panneau de l’assistant, bord gauche de l’image entre les onglets et le panneau, barre du haut et menu hors champ. Celui de « Activer la diffusion » est à z 2,45 : c’est le seul cadrage où ni les onglets sous le panneau, ni la barre du haut ne passent dans les bords adoucis.
  - **Listes déroulantes.** Les listes natives ne se capturent pas : le clic sur le champ coupe directement de « Choisir un salon » au salon choisi.
  - **Curseur.** Quand une coupe glisse un autre contrôle sous la flèche, le curseur et son onde partent avec l’ancien écran ; il peut revenir ensuite dans une marge neutre (`back`). Pendant une relecture, il attend hors du texte relu.
  - **Discord.** Une fenêtre Discord entre à z 0,86, avec une pastille de contexte à gauche (« Discord · salon #bot-nxt5 »…), puis la caméra s’approche. Les captures Discord sont à 1x : le zoom y reste à z 1,4 au plus.

## Déroulé

| # | Chapitre | Écran | Animation | Sous-titre |
|---|---|---|---|---|
| 0 | Titre (5 s) | Fond nuit, wordmark | Titre en blur-slide sur deux lignes, « NXT5 » en dégradé | « Ajouter le bot NXT5 à ton serveur Discord » / « De l’invitation à ta première partie publiée. » · « nxt5.org · Bot Discord » |
| 1 | Avant de commencer (7 s) | Carte de vérification | Trois coches qui s’allument | « Un compte NXT5 avec un e-mail vérifié. » · « Propriétaire ou capitaine de l’équipe. » · « Discord : « Gérer le serveur » ou « Administrateur ». » |
| 2a | Étape 1 · Invite le bot (25 s) | Site : Bot Discord (site-01, puis site-07) | Curseur et halo sur « Préparation et partage » › « Bot Discord » (page déjà ouverte : survol, sans clic). Recul, défilement exact de la page jusqu’à l’assistant « Installer le bot », halo sur l’onglet « Serveur », clic sur « Ajouter à Discord » | « Sur nxt5.org, dans « Préparation et partage », ouvre « Bot Discord ». » · « Dans l’onglet « Serveur », clique sur « Ajouter à Discord ». » |
| 2b | | Discord, navigateur : dc01, dc02, dc03 | Pastille « Discord · autorisation du bot ». Survol du serveur choisi, clic sur « Continuer », coupe franche ; projecteur sur « Administrateur » pendant près de 5 s ; clic sur « Autoriser », page de confirmation | « Discord s’ouvre : choisis ton serveur, puis « Continuer ». » · « Le bot demande l’autorisation « Administrateur » : tous les droits, y compris dans les salons privés. » · « Clique sur « Autoriser » : le bot rejoint ton serveur. » |
| 3a | Étape 2 · Lie ton compte Discord (27 s) | Discord : dc04, dc05, dc06 | Pastille « Discord · salon #bot-nxt5 ». Clic dans le champ de message, fondu sur `/nxt lier` tapé (liste des commandes de Discord), touche « Entrée », coupe franche sur la réponse privée du bot (projecteur), clic sur « Ouvrir NXT5 » | « Dans un salon de ton serveur, tape /nxt lier et envoie la commande. » · « Le bot te répond en privé : clique sur « Ouvrir NXT5 ». » |
| 3b | | Site : site-04, site-05 | Pastille « nxt5.org · depuis le lien du bot ». Halo sur « Ton compte NXT5 » et « Ton compte Discord », clic sur « Confirmer mon compte NXT5 », coupe franche (le curseur part avec l’ancien écran), projecteur sur « À terminer dans Discord » et « Compte NXT5 confirmé. » | « Vérifie les deux comptes et clique sur « Confirmer mon compte NXT5 ». » |
| 3c | | Discord : dc06, dc08, dc09 | Clic sur « Vérifier la liaison », nouveau message (le curseur part, puis revient à droite des messages), projecteur sur les deux comptes (masqués), clic sur « Confirmer la liaison », message « Compte lié » | « De retour dans Discord : « Vérifier la liaison », puis « Confirmer la liaison ». » |
| 3d | | Site : site-05, site-06 | Clic sur « J’ai confirmé dans Discord · Vérifier », coupe franche et nouveau cadrage (la carte se replie), projecteur sur « Compte lié » | « Sur NXT5, clique sur « J’ai confirmé dans Discord · Vérifier » : ton compte est lié. » |
| 4a | Étape 3 · Relie l’équipe au serveur (17 s) | Site : site-08, site-09, site-10 | Zoom sur « Créer le code de liaison », clic, raccord ; halo sur `/nxt connecter code:7F3A-92C1-D04E-B58B` et « Valable jusqu’au 18/10/2026 22:22:37 » ; clic sur « Copier la commande », raccord, projecteur sur « Commande copiée. » | « Clique sur « Créer le code de liaison », puis « Copier la commande ». » |
| 4b | | Discord : dc09, dc10, dc11 | Clic dans le champ, « Ctrl + V » (la commande apparaît d’un coup, coupe sur le V), halo sur la commande collée, « Entrée », projecteur sur « Serveur relié à cette équipe NXT5. » | « Colle la commande dans ton serveur Discord et envoie-la. » |
| 4c | | Site : site-11 | Zoom sur l’en-tête du bot, projecteur sur « Serveur : Horizon Esport » et « Serveur relié » | « Sur NXT5, le serveur apparaît : « Serveur relié ». » |
| 5 | Étape 4 · Choisis les salons (18 s) | Site : site-11, 13, 14, 15, 16, 17 | Halo sur l’onglet « Salons ». Clic sur « Salon des commandes de l’équipe », raccord sur #bot-nxt5 ; « Associer ce salon », projecteur sur « Associé » et « Salon des commandes enregistré. ». Descente vers « Usage 2 · Les publications » (le curseur suit) : #résultats, « Ajouter ce salon », la ligne « #résultats Automatique » avec « Publier automatiquement les nouvelles parties » ; « Enregistrer les salons », raccord, projecteur sur « Salons enregistrés. » ; clic sur « Passer au test et à l’activation » | « Onglet « Salons » : choisis le salon des commandes, puis « Associer ce salon ». » · « Choisis le salon des résultats, « Ajouter ce salon », puis « Enregistrer les salons ». » · « Puis « Passer au test et à l’activation ». » |
| 6a | Étape 5 · Teste et active (25 s) | Site : site-18, site-20 | Halo sur l’onglet « Activation », zoom sur « Salon du message de test » (#résultats), clic sur « Envoyer le message de test », raccord, projecteur sur « Test reçu sur Discord » | « Onglet « Activation » : clique sur « Envoyer le message de test ». » |
| 6b | | Discord : dc12 | Pastille « Discord · salon #résultats », projecteur sur le message de test | « Le message de test arrive dans le salon, visible par ses membres. » |
| 6c | | Site : site-20, site-21, site-22 | Halo sur le reçu, clic sur « Activer la diffusion » (raccord), relecture du récapitulatif « Activer pour Équipe Démo » (curseur sous la boîte), clic sur « Confirmer l’activation », coupe franche vers la vue d’ensemble : projecteur sur « Tout est en place », puis sur « Diffusion active » et « #résultats Automatique » | « Sur NXT5, « Test reçu sur Discord » : clique sur « Activer la diffusion ». » · « Relis le récapitulatif, puis clique sur « Confirmer l’activation ». » · « « Diffusion active » : ton équipe peut utiliser le bot. » |
| 7a | Étape 6 · Publie une partie (19 s) | Site : partie « Aurore » (site-23), fenêtre « Exporter sur Discord » (site-24 à site-27) | Halo sur « Aurore · Victoire », clic sur « Exporter sur Discord », coupe et nouveau cadrage sur la fenêtre entière ; halo sur « Destination Discord » (#résultats, déjà choisi) ; clic sur « Préparer l’aperçu », coupe et nouveau cadrage (le curseur part avec l’ancien écran, puis revient à droite de la fenêtre), projecteur sur « Équipe Démo vs Aurore », « Victoire · 22–11 kills · 25:00 », « Scrim » ; défilement exact de l’aperçu jusqu’à « Publier dans #résultats », clic, défilement : projecteur sur « Publié sur Discord. » | « Ouvre une partie et clique sur « Exporter sur Discord ». » · « Clique sur « Préparer l’aperçu ». » · « Vérifie l’aperçu, puis clique sur « Publier dans #résultats ». » |
| 7b | | Discord : dc13 | Pastille « Discord · salon #résultats », halo sur le titre du message, clic sur le visuel | « Ta partie est dans le salon. » |
| 8 | C’est fait (9 s) | Discord : dc14 | Lent rapprochement du visuel ouvert en grand | « C’est fait : ta partie est publiée sur Discord. » · « Les nouvelles parties importées sont ensuite publiées automatiquement. » |
| 9 | À retenir (8 s) | Carte récapitulative, wordmark, mentions légales en petit en bas (Riot, puis Discord) | Trois rappels | « Lie ton compte avec /nxt lier avant /nxt connecter. » · « Le code de liaison est valable 10 minutes, une seule fois. » · « Toute personne qui voit le salon voit les messages publiés. » · nxt5.org |

Les sous-titres suivent la typographie française du site : apostrophe typographique et espace insécable avant « ? », « ! », « : », et entre les guillemets « ».

## Captures Discord

Les captures Discord (dc01 à dc14, sans dc07) viennent de la séance décrite dans `capture/discord/BRIEF-CAPTURES-DISCORD.md`. Tant qu’elles ne sont pas livrées, le film montre des **cartes d’attente** :

- `public/tuto-discord/real/placeholder/dcNN.png`, en 1920×1032 (fenêtre Discord agrandie sur un écran 1920×1080 à 100 %), générées par `node tools/promo-video/v3/capture/discord/make-placeholders.cjs` : fond sombre neutre, « CAPTURE DISCORD À VENIR · dcNN », l’état attendu par le brief, et les cibles supposées en pointillés. Aucune interface de Discord n’y est dessinée.
- Leurs entrées `dc…` de `src/tuto-discord/captures.json` portent `placeholder: true` et des boîtes **supposées**.
- Le rendu entoure chaque plan qui en montre une de hachures jaunes, avec l’étiquette « PLACEHOLDER · DCnn ». `export-cues.mjs discord` les liste (`placeholders`) et le signale. **Un film qui en contient ne doit jamais être publié.**

Le film ne vise les écrans Discord que par des boîtes (`DCnn.clé`). Remplacer une carte d’attente par la vraie capture ne change donc que les données :

1. La séance livre `public/tuto-discord/real/<nom>.png` (masquée) et `manifest.json`.
2. Dans `src/tuto-discord/captures.json`, pour chaque entrée `dcNN-…` : `file` = `tuto-discord/real/<nom>.png`, `css` = taille de la PNG en pixels (`{ "w": 1920, "h": 1032 }` pour la fenêtre Discord, 1920×1080 pour les pages du navigateur en plein écran dc01 à dc03), supprimer `placeholder`, `expected` et `brief`, puis mesurer chaque boîte ci-dessous en pixels de la PNG. Les coordonnées notées par la séance dans `manifest.json` (`nextTarget`) donnent déjà le bouton suivant. `make-placeholders.cjs` ne touche jamais une entrée sans `placeholder`.
3. Lancer `node src/tuto/export-cues.mjs discord --write` : netteté (la hauteur de chaque capture règle son échelle), vitesse de caméra, cadrage des clics et des halos ; la liste `placeholders` doit disparaître. Corriger au besoin un cadrage (`z`, `ay`) ou un décalage dans `script.ts`.
4. Rendre des images fixes de chaque plan (`npx remotion still src/index.ts TutoDiscord --frame=N`) et vérifier curseur, halos et sous-titres. Les noms affichés (serveur, titre du message, code) doivent aussi correspondre à ceux du site : relancer `capture/discord/run-site.sh`, qui les reprend du manifeste.
5. Quand toutes les captures sont réelles, supprimer `public/tuto-discord/real/placeholder/`.

| Capture | Boîtes visées par le film |
|---|---|
| dc01-oauth-serveur | `oauthCard`, `serverSelect`, `continueButton` |
| dc02-oauth-autorisations | `oauthCard`, `permissions`, `adminPermission`, `authorizeButton` |
| dc03-oauth-autorise | `confirmation` |
| dc04-salon-bot-nxt5 | `messageField` |
| dc05-commande-lier | `commandLier`, `messageField` |
| dc06-reponse-lier | `botReply`, `openButton`, `verifyButton`, `messageField` |
| dc08-verifier-comptes | `botReply`, `accounts`, `confirmButton` |
| dc09-compte-lie | `linkedReply`, `messageField` |
| dc10-commande-connecter | `command`, `messageField` |
| dc11-serveur-relie | `connectedReply` |
| dc12-message-test | `testMessage` |
| dc13-partie-publiee | `gameMessage`, `gameTitle`, `gameImage` |
| dc14-visuel-agrandi | `viewerImage` |

Si un écran réel diffère du brief (bot déjà présent, avertissement de lien externe dc07, captcha, message d’erreur), c’est le plan correspondant de `script.ts` qui s’adapte ; le manifeste le signale dans `observations`.

## Points ouverts

- **Bot en production.** Le tutoriel suppose le bot actif sur nxt5.org ; sinon les spectateurs verraient « Service indisponible ». À confirmer avant publication.
- **Comportement réel de Discord.** Messages successifs du bot (dc06 → dc08 → dc09), place des boutons, avertissement de lien externe : le montage suit les vraies captures dès qu’elles arrivent.
- **Couverture.** Captures du site sur ordinateur uniquement, données fictives et API interceptées ; ni états d’erreur ni publication automatique filmés. Son non masterisé.
