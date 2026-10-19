# Tutoriel NXT5 Importer 0.3.8 : parcours utilisateur et plan de capture

Ce plan fusionne les trois rapports. J'ai revérifié ces points dans le code :
- Windows est livré en exécutable portable : `importer-app/package.json:36-47` cible `portable` et le bloc `nsis` (:48-56) n'est pas utilisé.
- Les textes du site et de l'Importer cités pour les étapes 10, 12 et 14 sont confirmés à `importer-app/src/renderer.html:220`, `importer-app/src/renderer.js:499`, `importer-app/src/core.js:469` et `importer-app/src/main.js:453`.
- Les captures existantes sont lisibles et les fichiers d'erreurs sont vides (`[]`).

**Ce que la vidéo doit montrer.** L'Importer n'envoie rien sur nxt5.org. Il crée seulement un fichier `.json` local. L'import en ligne se fait ensuite sur le site : Parties → Importer une partie → Choisir mon fichier. Le seul lien de téléchargement est dans la fenêtre d'import du site. Il faut donc un compte connecté, un e-mail vérifié, une équipe sélectionnée et un rôle propriétaire ou staff.

## A. Parcours ordonné

**0. Prérequis (introduction ou carton)**
- **Écran :** facultatif, le guide public `/guides/importer-premier-scrim`, consultable sans compte.
- **Action :** énoncer les conditions.
  - Un compte NXT5 dont l'e-mail est vérifié. Sinon, `EmailVerificationGate` remplace toute l'application (`src/AppContent.jsx:274`).
  - Une équipe, avec le rôle propriétaire ou capitaine, coach, assistant, analyste, manager ou board (`src/pages/workspace/workspace-shared.jsx:300-314`, `netlify/functions/matches-import-file.ts:84-96`).
  - Un ordinateur Windows 64 bits ou un Mac, avec League of Legends installé.
- **Texte exact :** « Un ordinateur Windows (64 bits) ou Mac, le client League of Legends ouvert et une partie accessible depuis ce client. Le propriétaire de l'équipe ou son staff autorisé réalise l'import. Tu peux consulter les résultats ensuite sur mobile. » (`src/pages/public/PublicGuides.jsx:17`)
- **Astuces :**
  - Un simple joueur voit « Le capitaine ou le staff peut importer les parties de ton équipe. » (`src/pages/workspace/GameWorkspace.jsx:1540`).
  - Sans équipe : « Crée ou rejoins une équipe pour y retrouver tes parties. » (`src/pages/workspace/GameWorkspace.jsx:1539`).

**1. Ouvrir Parties, puis « Importer une partie » (site)**
- **Écran :** nxt5.org, `/games`.
- **Action :** cliquer sur « Parties » dans le menu latéral, puis sur « Importer une partie ». L'URL devient `/games?import=1`.
- **Textes exacts :**
  - Menu : « Parties », avec l'indication « Importer et revoir une partie » (`src/app/constants.jsx:25`).
  - Sous-titre de la page : « Ouvre une partie pour comprendre ce qui s'est passé et préparer la prochaine session. » (`src/pages/workspace/GameWorkspace.jsx:1621`).
  - Bouton : « Importer une partie » (`src/pages/workspace/GameWorkspace.jsx:1541`).
- **Résultat :** la fenêtre « Importer une partie » s'ouvre (`src/pages/workspace/GameWorkspace.jsx:1624`). On y voit :
  - le titre « Ajoute le fichier de ta partie » (`src/pages/workspace/ImporterDownloadPanel.jsx:34`) ;
  - le texte « Choisis le fichier .json créé par NXT5 Importer. Tu pourras vérifier les équipes et les joueurs avant l'enregistrement. » (`ImporterDownloadPanel.jsx:35`) ;
  - le bouton « Choisir mon fichier » (`ImporterDownloadPanel.jsx:40`) ;
  - une section repliée « Pas encore de fichier ? Obtenir NXT5 Importer » (`ImporterDownloadPanel.jsx:47`).
- **Astuce :** au premier passage, une bannière de cookies apparaît (« Tes choix de cookies »).

**2. Télécharger NXT5 Importer**
- **Écran :** la même fenêtre, avec la section dépliée.
- **Action :** déplier « Pas encore de fichier ? Obtenir NXT5 Importer », choisir le système dans « Version de l'application », puis cliquer sur « Télécharger ».
- **Textes exacts :**
  - « Ouvre League of Legends sur ton ordinateur, puis utilise NXT5 Importer pour exporter ta partie. Reviens ici avec le fichier .json obtenu. » (`src/pages/workspace/ImporterDownloadPanel.jsx:48`)
  - « Version de l'application » (`ImporterDownloadPanel.jsx:51`), avec les choix « Windows (64 bits) », « Mac Apple Silicon » et « Mac Intel » (`ImporterDownloadPanel.jsx:10-12`).
  - Le bouton « Télécharger » (`ImporterDownloadPanel.jsx:55-56`) et le lien « Aide à l'ouverture sur Windows et Mac » (`ImporterDownloadPanel.jsx:58`).
- **Résultat :** le navigateur passe par `/.netlify/functions/importer-download?platform=…&arch=…`, qui redirige (302) vers la release GitHub `nxt5-match-exporter-latest`. Au 2026-10-19, les fichiers sont :
  - `NXT5-Importer-Windows-0.3.8.exe`, environ 102 Mo ;
  - `NXT5-Importer-Mac-arm64-0.3.8.zip`, environ 131 Mo ;
  - `NXT5-Importer-Mac-x64-0.3.8.zip`, environ 135 Mo.
- **En même temps,** la fenêtre d'aide « Ouvrir NXT5 Importer » s'ouvre (`src/components/importer/ImporterOpeningHelp.jsx:31`, déclenchée sans `preventDefault`).
- **Astuces :**
  - Sur Mac, bien choisir entre Apple Silicon et Intel. Le choix par défaut du site est Windows.
  - Il n'existe pas de version Windows ARM.
  - Erreurs possibles, affichées en JSON brut dans le navigateur : « Release NXT5 Importer introuvable. » et « Téléchargement temporairement indisponible. Réessaie dans quelques instants. » (`netlify/functions/importer-download.ts:55-99`).

**3. Fenêtre d'aide à l'ouverture (site)**
- **Action :** lire l'onglet « Windows » ou « macOS », présélectionné selon le choix précédent, puis cliquer sur « J'ai compris ».
- **Textes exacts :**
  - Windows : « Microsoft Defender SmartScreen », « Windows a protégé votre ordinateur », « Ouvre le fichier .exe de NXT5 Importer téléchargé. », « Si « Windows a protégé votre ordinateur » apparaît, clique sur Informations complémentaires. », « Vérifie que le fichier correspond à NXT5 Importer, puis clique sur Exécuter quand même, si ce bouton est proposé. » (`src/components/importer/ImporterOpeningHelp.jsx:38-51`)
  - macOS : « Apple ne peut pas vérifier l'app », « Extrais le fichier ZIP, puis ouvre NXT5 Importer. », « Si l'alerte de vérification Apple apparaît, ferme le message. », « Ouvre Réglages Système → Confidentialité et sécurité. », « Dans la section Sécurité, clique sur Ouvrir quand même, puis confirme avec Ouvrir. Authentifie-toi si macOS le demande. » (`ImporterOpeningHelp.jsx:38-47`)
  - Note macOS : « macOS mémorise cette autorisation pour l'application. Une autre version peut demander une nouvelle validation. » (`ImporterOpeningHelp.jsx:53`)
- **Astuce :** le lien « Mon message est différent ou le bouton manque » mène à « Contacter NXT5 » (`ImporterOpeningHelp.jsx:57-60`).

**4. « Installer » et lancer l'Importer pour la première fois (système)**
- **Windows :** il n'y a pas d'installateur. L'`.exe` portable se lance par double-clic depuis l'endroit où il a été enregistré, sans raccourci de bureau ni de menu Démarrer. SmartScreen peut afficher « Informations complémentaires » puis « Exécuter quand même ».
- **Mac :** extraire le zip, qui contient « NXT5 Importer.app », puis l'ouvrir. L'app n'est pas notarisée : passer par Réglages Système → Confidentialité et sécurité → « Ouvrir quand même » → « Ouvrir ».
- **Résultat :** la fenêtre de l'Importer s'ouvre en 1180×800, sans barre de menu et en instance unique (`importer-app/src/main.js:461-482`).
- **Astuces :**
  - La CI ne signe aucun binaire.
  - Chaque nouvelle version Mac peut redemander l'autorisation.
  - L'emplacement recommandé pour ranger l'app est **inconnu**.

**5. Ouvrir League of Legends, puis l'Importer (vue « Exporter »)**
- **Action :** lancer le client LoL **avant** l'Importer.
- **Textes exacts :**
  - Onglets : « Exporter », « Historique », « Paramètres ».
  - Bloc d'accueil : « Le match est fini. » / « L'analyse commence. »
  - Carte d'export : « Nouvel export », « Exporte ta partie. », « Un identifiant. Un fichier prêt pour NXT5. »
  - Bandeau en 3 étapes : « 01 Copie l'identifiant / Depuis l'historique de ta game. », « 02 Exporte le match / Un fichier, toutes les données disponibles. », « 03 Retrouve ta partie sur NXT5 / Dans NXT5 : Parties → Importer une partie → Choisir mon fichier. »
  - Pied de page : « v0.3.8 ».
  - Sources : `importer-app/src/renderer.html:66-169,230-240,326-348`.
- **Indicateur du client :** « Recherche du client… », puis « Client LoL connecté » (point vert) ou « Client LoL non détecté » (`importer-app/src/renderer.js:204,211-212`).
- **Astuces :**
  - Le statut n'est **pas** rafraîchi en continu. Si LoL est ouvert après l'Importer, il faut cliquer sur l'icône d'actualisation « Vérifier le client » (`importer-app/src/renderer.html:114-115`).
  - Le détail de l'erreur n'est visible qu'en infobulle : « Client LoL introuvable. Ouvre League of Legends ou indique son dossier dans les Paramètres. » (`importer-app/src/network.js:192`).

**5b. Si le client n'est pas détecté : Paramètres**
- **Action :** ouvrir « Besoin d'un coup de main ? », puis « Configurer le client », ou aller directement dans Paramètres. Cliquer sur « Choisir le dossier », puis « Choisir un dossier » ou « Choisir le lockfile ». « Rétablir la détection automatique » annule ce réglage.
- **Textes exacts :**
  - « Client League of Legends », « Détection automatique des installations habituelles. »
  - « Si League est installé ailleurs, sélectionne son dossier ou son fichier « lockfile ». »
  - Fenêtre native : « Localiser League of Legends ».
  - Messages : « Emplacement du client enregistré. » et « Détection automatique rétablie. »
  - Sources : `importer-app/src/renderer.html:306-322,398-434`, `importer-app/src/main.js:523-562`.

**6. Copier l'identifiant de la partie dans le client LoL**
- **Action :** copier l'ID d'une partie depuis l'historique du client.
- **Écran et bouton exacts :** **INCONNUS**, rien dans le dépôt ne les décrit. La vidéo les montre en schéma générique (décision du 19 octobre 2026, point C1).
- **Texte de l'Importer :** « Copie l'identifiant depuis l'historique du client LoL. Pour un numéro sans préfixe, choisis le serveur de la partie. » (`importer-app/src/renderer.html:311-314`)
- **Limite :** l'Importer n'affiche pas de liste des parties récentes. On ne peut donc pas montrer un choix dans une liste.

**7. Saisir l'ID et le serveur**
- **Action :** coller l'ID dans « Identifiant du match », par exemple « Ex. EUW1_7861632138 ».
  - Un ID complet reconnaît la région tout seul : « La région est reconnue pour un ID complet. »
  - Pour un numéro seul, choisir « Serveur de jeu ». La valeur par défaut est « Europe Ouest · EUW », et le choix est mémorisé.
  - Sources : `importer-app/src/renderer.html:241-283`, `importer-app/src/core.js:44-67`.
- **Erreurs de saisie :**
  - Champ vide : « Ajoute l'identifiant de la game à exporter. »
  - ID invalide : « Utilise un numéro de game ou un ID complet, comme EUW1_7861632138. »
  - Sources : `importer-app/src/renderer.js:295-296`.

**8. Exporter**
- **Action :** cliquer sur « Exporter la game », ou faire Ctrl+Entrée (⌘+Entrée sur Mac).
- **Textes exacts :** « Aucune clé Riot. Ton fichier reste sur cet appareil. », puis le bouton passe à « Export en cours… » (`importer-app/src/renderer.html:285-294`, `importer-app/src/renderer.js:312`).
- **Carte de progression :**
  - Titre « Préparation de ton export », avec les étapes « 1 Match », « 2 Timeline », « 3 Fichier », « 4 Terminé ».
  - Messages : « Récupération de la partie auprès de Riot… », puis, si l'appel distant échoue, « Recherche de la partie dans le client League of Legends… ».
  - Pied : « {N} s écoulées · La disponibilité des données dépend de Riot et du client LoL. »
  - Bouton « Annuler », désactivé à partir de l'étape d'enregistrement.
  - Sources : `importer-app/src/renderer.html:172-192`, `importer-app/src/renderer.js:375-385`.
- **Astuces :**
  - L'export interroge d'abord nxt5.org, qui va chercher la partie chez Riot. Si cela échoue, il lit la partie dans le client local.
  - Une partie qui vient de finir peut ne pas encore être disponible chez Riot.
  - L'export distant est limité à 12 par minute (`netlify/functions/riot-match-export.ts:6`).

**9. Fenêtre native d'enregistrement**
- **Textes exacts :** titre « Enregistrer le JSON NXT5 », filtre « NXT5 JSON », nom pré-rempli `nxt5-EUW1_7861632138.json` (`importer-app/src/main.js:450-456`, `importer-app/src/core.js:469`).
- **Résultat :** le dossier proposé est Téléchargements la première fois, puis le dernier dossier utilisé. Si l'utilisateur annule : « Export annulé. Aucun nouveau fichier enregistré. »

**10. Écran de réussite**
- **Textes exacts :**
  - « Export enregistré » / « Ta game est prête. »
  - Pastilles : « 10 joueurs », « 25 min 00 », « Timeline incluse » ou « Sans timeline », « Riot via NXT5 » ou « Client LoL ».
  - Boutons « Voir le fichier » et « Ouvrir NXT5 ».
  - Indication : « Dans NXT5 : Parties → Importer une partie → Choisir mon fichier. »
  - Sources : `importer-app/src/renderer.html:193-222`.
- **Avertissement possible, en jaune :** « Partie récupérée depuis le client LoL. Certaines statistiques peuvent être moins détaillées. » (`importer-app/src/core.js:647`)
- **Astuce importante :** « Ouvrir NXT5 » ouvre `https://nxt5.org/integration`, c'est-à-dire la page Parties **avec la fenêtre d'import fermée** (`importer-app/src/renderer.js:499`, `src/app/routing.js:20`). Il faut ensuite recliquer sur « Importer une partie ».

**11. (Facultatif) Historique et erreurs dans l'Importer**
- **Historique :** « Exports récents », « Réexporter », « Voir le fichier », « Les 30 derniers exports sont conservés ici. … » (`importer-app/src/renderer.html:351-397`).
- **Erreurs fréquentes :**
  - « Client LoL introuvable. … »
  - « Le client LoL ne répond pas. Ouvre son historique de parties puis réessaie. »
  - « Game ID introuvable côté Riot. IDs testés : … »
  - Sources : `importer-app/src/core.js:82-125`, `importer-app/src/network.js:192-232`, `importer-app/src/main.js:438-445`.

**12. Charger le fichier sur le site**
- **Action :** dans Parties, cliquer sur « Importer une partie », puis « Choisir mon fichier », et choisir `nxt5-….json` dans le sélecteur du système.
- **Textes exacts :**
  - « Chargement… », puis une carte de progression « Upload du JSON · x Ko / y Ko » et « JSON envoyé, analyse NXT5 en cours » (`src/pages/workspace/GameOperations.jsx:199-215`).
  - Message : « Fichier chargé » (`GameOperations.jsx:654-656`).
  - Panneau : « Fichier chargé », « Rien n'est encore enregistré. », bouton « Changer de fichier » (`src/pages/workspace/ImporterDownloadPanel.jsx:32-40`).
- **Erreurs :**
  - Plus de 5 Mo : « Choisis un fichier JSON de 5 Mo maximum. » (`GameOperations.jsx:633`)
  - JSON invalide : « Le fichier choisi n'est pas un JSON valide. Génère-le avec NXT5 Importer. » (`GameOperations.jsx:660`)
- **Astuce :** charger le fichier n'enregistre rien.

**13. Choisir le côté de son équipe**
- **Textes exacts :**
  - « Choisis ton équipe » (`src/pages/workspace/GameOperations.jsx:709`).
  - Si l'équipe est reconnue : « Ton équipe a été reconnue grâce aux cinq Riot ID. Vérifie les postes et les profils avant de confirmer. » (`GameOperations.jsx:710`)
  - Cartes « Côté bleu » / « Côté rouge », avec le badge « Victoire » ou « Défaite » (`GameOperations.jsx:712-715`).
- **Astuce :** la reconnaissance automatique ne marche que si les 5 Riot ID (Nom#TAG) d'un côté correspondent à 5 profils de l'équipe.

**14. (Si besoin) Créer les profils manquants**
- **Textes exacts :** « Créer les profils manquants depuis le fichier », puis le bouton « Créer les profils proposés », puis le message « Profils prêts » (`src/pages/workspace/GameOperations.jsx:599,719-723`).
- **Astuce :** ces profils restent dans l'équipe même si l'utilisateur ferme la fenêtre sans importer.

**15. Vérifier « Notre équipe » et « Équipe adverse »**
- **Textes exacts :**
  - Colonnes « Poste », « Champion joué », « Profil lié » (`src/pages/workspace/GameOperations.jsx:728`).
  - « Vérifie les postes adverses. Un poste déjà pris est échangé. » (`GameOperations.jsx:752`)
- **Messages qui bloquent la confirmation** (`GameOperations.jsx:686-693`) :
  - « Associe les cinq postes à cinq profils joueurs différents de ton équipe. »
  - « Attribue un poste à chaque champion adverse pour confirmer l'import. »

**16. Nom, tags et adversaire**
- **Champs :**
  - « Nom de la partie », pré-rempli **avec le Game ID**. Le renommer, par exemple « Scrim Aurore · partie 1 » (`src/pages/public/PublicGuides.jsx:23`).
  - « Tags (au moins un) » : les tags de l'équipe (ici « Scrim ») sont proposés, mais **aucun n'est choisi** au chargement du fichier (`categoryIds: []`, `GameOperations.jsx:647`). Tant qu'aucun tag n'est choisi, le champ affiche « Ajoute au moins un tag à la partie. » et le pied de la fenêtre reste sur « À compléter » (`GameOperations.jsx:194,691,780`). Il faut cliquer sur un tag, par exemple « Scrim ».
  - « Équipe adverse (facultatif) », avec le bouton « Nouvelle équipe ».
  - Sources : `src/pages/workspace/GameOperations.jsx:186-194,369-379,774`.

**17. Confirmer l'import**
- **Textes exacts :**
  - Statut « Prêt à importer » / « Confirme pour enregistrer la partie et ouvrir son bilan. »
  - Bouton « Confirmer l'import », qui devient « Enregistrement… ».
  - Message de réussite : « Partie importée » / « Le côté, les joueurs et les postes ont été enregistrés. Le bilan de la partie est prêt à consulter. »
  - Sources : `src/pages/workspace/GameOperations.jsx:617,779-783`.
- **Effets réels à connaître :**
  - Un e-mail « [NXT5] Nouveau match importé — {gameId} » part vers les membres de l'équipe.
  - Discord et le journal d'audit sont aussi mis à jour (`netlify/functions/matches-import-file.ts:44-62,140-151`).

**18. La partie apparaît dans l'espace NXT5**
- **Résultat :** l'utilisateur arrive sur `/games?match=<id>`. Le titre de la partie s'affiche avec « Victoire » ou « Défaite », « Durée : … » et « Notre équipe : côté bleu ». On y trouve aussi « Préparer le débrief » et « Détails de la partie ».
- **Retour à la liste :** « Retour aux parties » mène à « Toutes les parties », où la nouvelle ligne porte le tag « Scrim » et la mention « À revoir ».
- **Sources :** `src/pages/workspace/GameWorkspace.jsx:1329-1360,1630,1650`.

**19. (Fin facultative) Mises à jour**
- **Textes exacts :** le bandeau « La prochaine version t'attend. » propose « Télécharger », qui ouvre le navigateur. Dans Paramètres : « Version & mises à jour » et « Vérifier les mises à jour » (`importer-app/src/renderer.html:133-141,435-458`).
- **Astuce :** la mise à jour n'est pas automatique. L'utilisateur remplace l'app lui-même.

## B. Plan de capture

Toutes les captures sont dans `/tmp/claude-0/-home-user-NXT5/20b1d35b-3d4e-52a6-83ec-cbf1368523e2/scratchpad/importer-tuto/capture-test/`. Les images retenues sont nettes : 2360×1600 pour l'Importer et 2880×1800 pour le site.

| Étape | Méthode | Fichier existant | Remarque |
|---|---|---|---|
| 0 Guide public | Playwright sur le site, sans compte (local ou en ligne) | à faire | Page statique, sans risque |
| 1 Parties | Site Vite local + API interceptées | `site-shots/s01-parties-vide.png`, `s02-dialogue-import.png` | Refuser les cookies avant la prise |
| 2 Téléchargement | Même méthode, `importer-download` interceptée | `site-shots/s03-obtenir-importer.png` | La barre de téléchargement du navigateur n'est **pas capturable** : à illustrer |
| 3 Aide | Même méthode | `site-shots/s04-aide-ouverture.png`, `s04b-aide-ouverture-macos.png` | Prêt |
| 4 SmartScreen, Gatekeeper, Explorateur, Finder | **Non capturable ici** | aucune | Vraie machine Windows et vrai Mac, ou illustration |
| 5 Accueil Importer, client connecté | Electron réel sous Xvfb, fixture smoke, 2x | `shots-2x/01-accueil-client-connecte.png` | Pas de cadre de fenêtre sous Xvfb |
| 5 Client non détecté, puis reconnecté | Electron réel (lockfile renommé, puis vrai clic d'actualisation) | `shots-2x/02-client-non-detecte.png`, `05-client-reconnecte.png` | Infobulle non capturée |
| 5b Paramètres | Repli Chromium avec `platform: win32` | `fallback-shots/f02-parametres-windows.png` | Ne pas utiliser `shots-2x/04-parametres.png`, qui affiche « linux · Intel / x64 » et « Vérification indisponible » |
| 5b Sélecteur « Localiser League of Legends » | **Non capturable** (fenêtre native simulée) | aucune | Illustration |
| 6 Client LoL | **Non capturable** | aucune | Enregistrement réel du client nécessaire |
| 7 Saisie | Electron réel | `shots-2x/07-id-invalide.png`, `08-id-saisi.png` | Prêt |
| 8 Progression | Electron réel, ou repli Chromium pour tenir chaque étape | `shots-2x/09-progression.png`, `fallback-shots/f03-progression-timeline.png` | Le repli permet de montrer les 4 étapes |
| 9 Enregistrement | **Non capturable** (fenêtre simulée) | aucune | Illustration ou vraie machine |
| 10 Réussite | Repli Chromium win32 (`fallback-shots/f04-resultat.png`), ou image mise en scène `shots-2x/10b-…MISE-EN-SCENE.png` | — | Ne pas utiliser `shots-2x/10-resultat.png`, qui affiche un chemin `/tmp`. Toute image mise en scène doit être signalée comme telle |
| 11 Historique | Electron réel | `shots-2x/06-historique-vide.png`, `11-historique.png` | Ne pas montrer `12-erreur-service.png`, dont le texte « Service fixture indisponible. » vient du test |
| 12 Chargement du fichier | Site + `setInputFiles` | `site-shots/s05-apercu-fichier.png` | Le sélecteur de fichiers du système n'est pas capturable. Le pourcentage d'envoi n'est pas réaliste |
| 13 à 16 Revue | Site | `site-shots/s05b`, `s06-notre-equipe`, `s07-equipe-adverse`, `s08-nom-et-tags` | **À refaire**, voir le premier correctif ci-dessous |
| 14 Profils manquants | Site, avec un effectif incomplet dans les données de test | à faire | Prévoir le jeu de données |
| 17 Confirmation | Site | `site-shots/s09-pret-a-importer.png` | À refaire pour la même raison |
| 18 Partie dans l'espace | Site | `site-shots/s10-apres-import.png`, `s11-liste-parties-avec-import.png` | Prêt |
| 19 Bandeau de mise à jour | Repli Chromium avec une mise à jour simulée | à faire | Facile |

**Vidéo :**
- ffmpeg x11grab sur Xvfb en 2360×1600 à 30 i/s fonctionne (`x11grab-test.mp4`). Ajouter `-draw_mouse 0` si nécessaire et placer la fenêtre en (0,0).
- Le site se filme avec Playwright en 1440×900, facteur 2.
- Les scripts sont dans le même dossier : `capture-importer.cjs`, `capture-renderer-fallback.cjs` et `capture-site.cjs`.

**Correctifs à faire avant les captures finales :**
1. La réponse simulée d'`opponents-drafts` (`list-opponents`) ne renvoie pas `canEdit: true`. Résultat : `s08` et `s09` affichent « Seul le staff peut associer une équipe adverse. » et « Nouvelle équipe » est désactivé, alors que l'utilisateur est propriétaire (`src/pages/workspace/GameOperations.jsx:357,375,382`). Ajouter `canEdit: true` et refaire `s08` et `s09`.
2. `s09` affiche « Fiddle Sticks ». Vérifier ce libellé ou changer de champion dans les données de test.
3. Attendre 600 ms après chaque changement de vue dans l'Importer, et 1,6 s après l'aperçu sur le site.
4. Ne pas utiliser Ctrl+3 pour une image fixe : le titre garde un contour de focus.
5. En 390 px, le message « Fichier chargé » masque une partie de la revue.
6. La charte du dépôt (AGENTS.md) demande aussi des captures sur téléphone et en 320 px. Le lanceur flottant de l'assistant ne doit pas masquer le contenu.
7. Toutes les captures sont faites en local, sur les sources 0.3.8. Ni le binaire publié ni nxt5.org en ligne n'ont été utilisés pour les imports.

## C. Points à faire confirmer par le propriétaire

1. **Où copier le Game ID dans le client LoL.** L'écran et le bouton exacts ne sont pas documentés dans le dépôt.
   - **Décision du propriétaire (19 octobre 2026) : schéma générique.** La vidéo (5a) montre un historique schématique, étiqueté « Illustration », sans reproduire l'interface de Riot : une partie sélectionnée, une icône de copie sans libellé, puis la pastille presse-papiers « EUW1_7861632138 » (l'exemple que donne l'Importer lui-même).
   - **Le texte reprend l'aide de l'Importer.** Le sous-titre 5a, « Dans l’historique du client LoL, copie l’identifiant de la partie. », suit « Copie l'identifiant depuis l'historique du client LoL. Pour un numéro sans préfixe, choisis le serveur de la partie. » (`importer-app/src/renderer.html:311-314`).
   - **Les deux formats sont couverts.** ID complet ou numéro seul plus serveur : le sous-titre 5b dit « Colle-le dans « Identifiant du match ». Si tu n’as que le numéro, choisis aussi le serveur. » et le rappel 2 du récapitulatif dit « Numéro seul ? Choisis le serveur de la partie. ».
   - **Ce n'est plus bloquant pour la publication**, mais le propriétaire doit encore revérifier sur un vrai client que l'historique propose bien une action de copie, et où. S'il n'y en a pas, retirer le clic de copie du schéma 5a et reformuler le sous-titre, par exemple « Repère l’identifiant de la partie dans l’historique du client LoL. », dans `src/tuto/script.ts` et `TUTO-IMPORTER.md`.
2. **Le client doit-il seulement être lancé, ou aussi connecté au compte ?** Le statut n'appelle que `/riotclient/region-locale`.
3. **Le scrim personnalisé passe-t-il par Riot ?** On ne sait pas si un scrim personnalisé est renvoyé par Riot (pastille « Riot via NXT5 ») ou s'il passe toujours par le client (« Client LoL » et avertissement jaune). Il faut choisir le cas montré dans la vidéo.
   - **En attendant la réponse**, la vidéo (6c) n'entoure que « 10 joueurs · 25 min 00 · Timeline incluse ». La pastille « Riot via NXT5 » reste visible dans la capture, mais n'est pas mise en avant. Une fois le cas confirmé, noter ici la réponse et, si besoin, refaire la capture du résultat avec la bonne source.
4. **`RIOT_EXPORT_TOKEN` est-il défini en production ?** Si oui, chaque export distant reçoit une erreur 401, et le message mal encodé « Export Riot non autorisÃ©. » apparaît (`netlify/functions/riot-match-export.ts:72`).
5. **Comportement réel de SmartScreen et Gatekeeper sur 0.3.8**, sans signature : ils peuvent ne pas apparaître ou avoir un autre texte. Il faut de vraies captures Windows et Mac.
6. **Plateforme principale de la vidéo :** Windows, Mac, ou les deux.
7. **Où ranger l'app :** dossier conseillé pour l'`.exe`, et faut-il déplacer l'app Mac dans Applications ? Le temps du premier lancement est aussi inconnu.
8. **Début du tutoriel :** faut-il filmer la création du compte, la vérification de l'e-mail (contenu non cartographié) et la création de l'équipe, ou annoncer ces étapes comme déjà faites ? Le téléchargement est inaccessible sans elles.
9. **Lien de téléchargement à montrer :** le bouton du site (derrière la connexion) ou la release GitHub publique (https://github.com/AshaiiTV/NXT5/releases/tag/nxt5-match-exporter-latest), qui liste aussi des dizaines d'anciennes versions.
10. **Version et noms de fichiers à l'écran :** 0.3.8 à ce jour. Une nouvelle publication avant la sortie de la vidéo changerait le nom du fichier.
11. **Fenêtres système et navigateur :** enregistrement, sélecteur de fichiers, barre de téléchargement. Faut-il les filmer sur une vraie machine ou les illustrer ?
12. **Messages réels du serveur à l'import** (« Analyse à compléter ») et vrais pourcentages d'envoi : impossibles à reproduire avec des réponses simulées.
13. **Remplacement manuel de l'app lors d'une mise à jour :** la procédure à expliquer n'est pas documentée.

**Défauts réels à signaler sans les montrer :**
- Quand Riot et le client échouent tous les deux, les deux erreurs s'affichent sur une seule ligne, car le saut de ligne n'est pas rendu (`importer-app/src/core.js:644`, `importer-app/src/styles.css:191`).
- « Reessaie » est écrit sans accent dans `src/api/client.js:89`.
- L'image du guide `/assets/guides/import-associer-joueurs.png` et `importer-app/docs/images/exporter.png` montrent d'anciennes interfaces.