# Brief : captures Discord réelles du tutoriel « Ajouter le bot NXT5 à ton serveur Discord »

Ce brief guide une séance de captures sur l’ordinateur Windows du propriétaire de NXT5, avec ses vrais comptes, sur le serveur Discord NXT. Le propriétaire est présent pendant toute la séance.

Le montage se fait ailleurs, à partir des fichiers livrés ici. Le tutoriel complet sera décrit dans `tools/promo-video/v3/TUTO-DISCORD.md`. Pour cette séance, le tableau « Liste » ci-dessous fait référence.

## Qui fait quoi

| Action | Qui la fait |
|---|---|
| Clics dans l’**application Discord** | La session Claude Desktop qui a le contrôle de l’ordinateur. Exception : le clic sur « Ouvrir NXT5 » dans un message du bot, qui ouvre le navigateur, est fait par le propriétaire. |
| Tout ce qui se passe dans le **navigateur** (page d’autorisation de Discord, toutes les étapes sur nxt5.org, F11) | Le propriétaire, ou Claude in Chrome s’il est connecté au Chrome du propriétaire. Jamais le contrôle de l’ordinateur. |
| `snap.ps1`, `mask.ps1`, git | Une session Claude Code dont le shell tourne sur ce PC, dans le dépôt : Claude Desktop, ou `claude` / `claude remote-control` lancé dans le dossier. Sans cette session, le propriétaire lance les mêmes commandes dans une fenêtre PowerShell ouverte à la racine du dépôt. |

Si la session ne peut pas cliquer dans Discord, le propriétaire fait les clics en suivant le tableau, et la session se charge des captures.

## Ce qu’on attend de la séance

- **Une quinzaine de captures PNG** des vrais écrans, en définition réelle de l’écran et sans pointeur de souris. Elles couvrent la page d’autorisation du bot dans le navigateur, puis l’application Discord.
- **Le parcours réel complet**, sur nxt5.org et sur le serveur Discord NXT, dans une catégorie dédiée.
- **Des captures masquées.** Les zones privées sont couvertes d’un aplat avant toute publication. Les captures brutes restent sur le PC.
- **Un manifeste rempli** : `tools/promo-video/v3/public/tuto-discord/real/manifest.json`, créé à partir de `manifest.template.json` (dans ce dossier). Il donne les noms exacts affichés, le code de liaison et les observations. Le montage aligne les captures du site sur ces valeurs.
- **La livraison sur la branche** `claude/clever-meitner-votyvi`.

Comptez 30 à 45 minutes. Deux délais de 10 minutes courent pendant la séance :
- **Le lien personnel** court de l’envoi de `/nxt lier` (capture 6) jusqu’au clic sur « Confirmer la liaison » (capture 9).
- **Le code de liaison** court de « Créer le code de liaison » jusqu’à l’envoi de `/nxt connecter` (capture 11).

Avant chacune de ces deux séquences, annoncer en une seule fois au propriétaire toutes les écritures qu’elle contient. Ensuite, l’enchaîner sans pause et sans nouvelle question.

## Règles

- **Rien n’est payant dans NXT5.** Ne capturer, ne citer et ne décrire aucun prix, offre, abonnement, essai ou gratuité. Ne pas ouvrir `/tarifs` ni `/fonctionnalites`. Ne faire aucune capture du site nxt5.org : ses écrans sont déjà filmés avec des données fictives.
- **Connexions.** Si discord.com ou nxt5.org demande une connexion, c’est le propriétaire qui se connecte. Claude ne saisit jamais d’identifiant ni de mot de passe, et ne capture ni la page de connexion ni son QR code.
- **Captchas.** Si un captcha ou une vérification apparaît, c’est le propriétaire qui le résout.
- **Écritures en production, toutes listées ici :**
  - **Sur Discord :**
    - la catégorie privée `Tuto NXT5` et ses deux salons ;
    - l’autorisation du bot NXT5 sur le serveur NXT, avec la permission Administrateur. Discord crée un rôle géré, et si le bot n’était pas encore sur le serveur, Discord peut annoncer son arrivée dans le salon système ;
    - les commandes `/nxt lier` et `/nxt connecter` ;
    - les messages du bot dans `#bot-nxt5` et `#résultats` (réponses privées, message de test, partie publiée) ;
    - seulement si la capture 15 est faite, le message public de `/nxt voir` ;
    - les réglages du client Discord du propriétaire, notés avant la séance et rétablis après.
  - **Sur nxt5.org :**
    - l’équipe « Équipe Démo » ;
    - l’équipe adverse « Aurore » ;
    - les cinq profils de joueurs fictifs proposés par l’import ;
    - l’import de la partie ;
    - « Délier mon compte » si nécessaire. C’est la seule suppression autorisée ;
    - la liaison du compte ;
    - le code et la liaison de l’équipe au serveur ;
    - le salon des commandes et le salon de publication ;
    - le message de test ;
    - l’activation ;
    - la publication de la partie.
  - **« Mettre à jour les autorisations »** : seulement avec l’accord du propriétaire.
  - Rien d’autre. Annoncer chaque écriture au propriétaire avant de la faire.
- **Aucune autre suppression.** Ne supprimer aucun message, salon, rôle, équipe ou partie. Un éventuel nettoyage se décide avec le propriétaire après la séance.
- **Confidentialité.** Le dépôt est public. Le choix du propriétaire est le suivant : vrais comptes, et masquage avant tout commit.
  - Toujours masquer :
    - l’identifiant du compte NXT5 (ligne « Compte NXT5 : … » de la capture 8). C’est un identifiant de connexion ; ne jamais l’écrire nulle part, pas même dans le manifeste ;
    - la colonne des serveurs, à gauche ;
    - le panneau utilisateur, en bas à gauche ;
    - le nom et l’avatar du propriétaire partout où ils apparaissent : en-têtes « … a utilisé /nxt … », ligne « Discord : … » de la capture 8, « Connecté en tant que … » de la page d’autorisation ;
    - le paramètre `?lier=` dans l’adresse de l’avertissement de lien externe (capture 7) ;
    - tout nom ou avatar d’une autre personne.
  - Les captures brutes vont dans `capture/discord/raw-local/`, ignoré par Git. Seul `mask.ps1` publie une capture, masquée, dans `public/tuto-discord/real/`.
  - Masquer la liste des membres du serveur. Replier les autres catégories, puis faire clic droit sur le serveur → « Marquer comme lu ». Si un salon vocal occupé reste visible, refaire la capture plus tard.
  - Pendant la séance, activer le statut « Ne pas déranger » dans Discord et l’assistant de concentration de Windows.
  - Ne pas capturer de messages privés, d’adresse e-mail, de lien d’invitation de serveur ni de page de paramètres du compte.
- **Exactitude.** Une capture montre l’écran tel qu’il est ; on n’y ajoute que les aplats de masquage. Si un écran diffère de ce qui est attendu ci-dessous, le capturer quand même et décrire l’écart dans le manifeste.

## Préparation (aucune capture)

### 1. Dépôt

Dans le clone local de NXT5 (utiliser des barres obliques `/` dans tous les chemins, elles marchent dans PowerShell comme dans Git Bash) :

```powershell
git fetch origin claude/clever-meitner-votyvi
git status --short
```

- **Copie de travail propre :** `git switch claude/clever-meitner-votyvi`, puis `git pull --ff-only origin claude/clever-meitner-votyvi`. Si l’une des deux commandes est refusée, passer au cas suivant.
- **Modifications locales présentes, ou commande refusée :** ne rien toucher dans ce clone. Créer un worktree neuf avec `git worktree add -b tuto-discord-captures ../NXT5-tuto-discord origin/claude/clever-meitner-votyvi`, puis travailler dans `../NXT5-tuto-discord`.

Vérifier que ces fichiers existent. Si l’un manque, s’arrêter : la branche n’est pas à jour.
- `tools/promo-video/v3/capture/discord/snap.ps1`
- `tools/promo-video/v3/capture/discord/mask.ps1`
- `tools/promo-video/v3/capture/discord/manifest.template.json`
- `tools/promo-video/v3/capture/discord/fixtures/nxt5-EUW1_7861632138.json`

Vérifier aussi que `git check-ignore tools/promo-video/v3/capture/discord/raw-local/x.png` affiche bien le chemin, ce qui confirme que le dossier des captures brutes est ignoré par Git.

### 2. Autorisations de la session Claude Code

Chaque demande d’autorisation ramène la fenêtre de Claude au premier plan, et `snap.ps1` refuse alors la capture. Avant la première capture, autoriser durablement les deux scripts : répondre « Toujours autoriser » ou ajouter dans `.claude/settings.local.json` :
- `Bash(powershell -NoProfile -ExecutionPolicy Bypass -File tools/promo-video/v3/capture/discord/snap.ps1:*)`
- la même règle pour `mask.ps1`.

Si l’erreur « … appartient à « claude » … » apparaît malgré tout, relancer avec `-Delay 6` et, pendant l’attente, cliquer dans la barre de titre de la fenêtre visée.

### 3. Écran, navigateur et Discord

- **Écran :** placer Discord et le navigateur sur le même écran, de 1920×1080 ou plus. Noter la définition et la mise à l’échelle Windows (100 % de préférence) dans le manifeste.
- **Navigateur :** le navigateur par défaut de Windows, connecté à nxt5.org et à discord.com avec les comptes du propriétaire. « Ouvrir NXT5 » s’ouvre dans le navigateur par défaut, d’où cette exigence.
- **Application Discord pour Windows**, en fenêtre agrandie (pas en plein écran).
  - Noter d’abord les réglages actuels, pour les rétablir après la séance.
  - Langue : Français.
  - Paramètres utilisateur → Apparence : thème sombre, zoom 100 %, affichage des messages « Cosy », taille de police par défaut.
  - Statut : « Ne pas déranger ».
- **Sur le serveur NXT**, avec le compte du propriétaire (qui doit avoir « Gérer le serveur » ou « Administrateur ») :
  - Créer une catégorie nommée `Tuto NXT5` et activer « Catégorie privée ».
  - À l’écran « Ajouter des membres ou des rôles », cliquer sur « Passer » : seuls les administrateurs la verront.
  - Y créer deux salons textuels nommés exactement `bot-nxt5` et `résultats` (avec l’accent).
  - Replier les autres catégories, marquer le serveur comme lu et masquer la liste des membres (icône en haut à droite).

### 4. Équipe et partie de démonstration sur nxt5.org

Toutes les données du site restent fictives, pour correspondre aux captures du site déjà faites.

1. **Équipe.**
   - **Cas normal :** dans le menu des équipes en haut, choisir « Créer ou rejoindre une équipe », puis « Créer mon équipe ». Sans aucune équipe, « Créer mon équipe » s’affiche directement dans « Mon équipe ».
   - Remplir le formulaire « Créer une équipe » : « Nom de l’équipe » = `Équipe Démo`, « Tag » = `DEMO`, « Région » = EUW, sans ajouter de joueurs. Cliquer sur « Créer l’équipe », puis basculer sur cette équipe.
   - **Si « Équipe Démo » existe déjà :** ouvrir d’abord son « Bot Discord ». Si un serveur y est relié, ou si « Diffusion active » s’affiche, s’arrêter et demander au propriétaire. Sinon, la réutiliser.
2. **Import de la partie fictive.** Aller dans Parties → « Importer une partie » → « Choisir mon fichier », et choisir `tools/promo-video/v3/capture/discord/fixtures/nxt5-EUW1_7861632138.json`. Ce fichier est fictif.
   - « Choisis ton équipe » : cliquer sur « Côté bleu ».
   - « Créer les profils manquants depuis le fichier » : cette étape est obligatoire pour une équipe sans joueurs. Vérifier les propositions (Kairo#NXT5 TOP, Lynx#NXT5 JGL, Vesper#NXT5 MID, Orion#NXT5 ADC, Sora#NXT5 SUP), puis cliquer sur « Créer les profils proposés ». Ces profils restent dans l’équipe même si l’import est annulé.
   - Vérifier dans « Notre équipe » que chaque poste a son profil, et que les cinq postes adverses sont attribués.
   - « Nom de la partie » : remplacer la proposition par `Aurore`. NXT5 affiche ce nom comme adversaire : le message Discord s’intitulera « Équipe Démo vs Aurore ».
   - « Tags (au moins un) » : cliquer sur « Scrim ».
   - « Équipe adverse (facultatif) » : choisir `Aurore` si elle existe. Sinon, cliquer sur « Nouvelle équipe » et saisir `Aurore` dans « Nom de l’équipe adverse » ; elle est créée à la confirmation.
   - Cliquer sur « Confirmer l’import ».
   - **Cet import se fait avant l’activation de la diffusion.** Fait après, la partie serait publiée automatiquement.
3. **Compte déjà lié ?** Dans « Bot Discord », regarder la carte « Toi sur Discord ».
   - **Si elle affiche « Compte lié » :** cliquer sur « Gérer », puis « Délier mon compte », puis « Confirmer la déliaison ». Annoncer d’abord cette écriture : elle coupe les accès Discord du compte jusqu’à la nouvelle liaison, faite pendant la séance.
   - **Si elle affiche « Compte non lié » mais que `/nxt lier` répond « Ton compte Discord » (capture 6) :** le compte Discord est lié à un autre compte NXT5. S’arrêter et demander au propriétaire.
   - Noter le résultat dans le manifeste (`accountWasLinked`).

## Captures

### Commandes

Capture brute, depuis la racine du dépôt ou du worktree :

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/promo-video/v3/capture/discord/snap.ps1 -Name <nom> -Expect Discord
```

- **Page d’autorisation dans le navigateur** : passer en plein écran (F11) et attendre 5 secondes que la bulle « quitter le plein écran » disparaisse. Puis lancer `-Mode screen -Expect chrome` (ou `msedge`, ou `firefox`) avec `-Delay 6`.
- **Avant chaque capture :**
  - mettre la bonne fenêtre au premier plan ;
  - ranger la souris loin du contenu, sans survol ni info-bulle ;
  - vider le champ de message, sauf si la capture le demande.
- **Après chaque commande ou bouton dans Discord :**
  - attendre que le texte « … réfléchit… » soit remplacé par la réponse ;
  - chaque bouton du bot ajoute un nouveau message privé sous le précédent ;
  - si la première pression sur Entrée ne fait que choisir la commande dans la liste, appuyer une seconde fois.
- **Si une capture ne convient pas :** la refaire avec `-Force`.

Masquage, puis publication de la capture masquée (rectangles en pixels de la PNG brute, au format `x,y,largeur,hauteur:raison`, séparés par `;`) :

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/promo-video/v3/capture/discord/mask.ps1 -Name <nom> -Rects "0,0,72,1032:colonne des serveurs;..."
```

- Ouvrir la PNG brute de `raw-local/` et repérer les zones à masquer (voir « Confidentialité »). Une image réduite à l’affichage donne des coordonnées à multiplier par le facteur de réduction.
- Prévoir une marge de 6 px autour de chaque zone.
- Ouvrir le résultat dans `public/tuto-discord/real/` et vérifier que plus rien de privé ne dépasse. Sinon, relancer avec des rectangles corrigés et `-Force`.
- Une capture sans zone privée (par exemple la page « Autorisé » sans nom visible) se publie avec `-None`, après vérification.

### Liste

Les textes entre guillemets viennent du code ; en cas de différence, c’est le vrai écran qui fait foi. Les lignes sans nom de capture sont des étapes sur nxt5.org, qui ne sont pas capturées.

| # | Nom | Où | État exact à capturer |
|---|---|---|---|
| 1 | `dc01-oauth-serveur` | Navigateur, F11 | Sur nxt5.org (équipe « Équipe Démo »), aller dans « Bot Discord », onglet « Serveur », puis cliquer sur « Ajouter à Discord ». La page d’autorisation de Discord s’ouvre. Choisir le serveur NXT dans la liste des serveurs. Capturer avec la liste refermée, avant « Continuer ». La liste ouverte des autres serveurs ne doit jamais être capturée. |
| 2 | `dc02-oauth-autorisations` | Navigateur, F11 | Après « Continuer » : la liste des autorisations demandées, avec « Administrateur », et le bouton « Autoriser », avant le clic. |
| 3 | `dc03-oauth-autorise` | Navigateur, F11 | Après « Autoriser » (et un éventuel captcha résolu par le propriétaire) : la page de confirmation de Discord. Si le bot était déjà sur le serveur et que la page diffère, capturer ce qui s’affiche et le noter. |
| 4 | `dc04-salon-bot-nxt5` | Discord | Plan d’ensemble : serveur NXT, catégorie `Tuto NXT5` dépliée avec `#bot-nxt5` et `#résultats`, salon `#bot-nxt5` ouvert, champ de message vide. |
| — | — | — | *Annoncer en une fois les écritures des captures 5 à 9, puis les enchaîner sans pause (lien personnel valable 10 minutes).* |
| 5 | `dc05-commande-lier` | Discord | Dans `#bot-nxt5`, taper `/nxt lier` sans valider. La liste des commandes de Discord montre la commande et sa description « Associer ton compte Discord à NXT5. ». |
| 6 | `dc06-reponse-lier` | Discord | Après validation : la réponse privée du bot « Lier ton compte NXT5 », avec ses trois étapes et les boutons « Ouvrir NXT5 » et « Vérifier la liaison ». Si le bot répond « Ton compte Discord », voir la préparation, partie 4, point 3. |
| 7 | `dc07-lien-externe` | Discord | Le propriétaire clique sur « Ouvrir NXT5 ». **Seulement si** Discord affiche un avertissement de lien externe : le capturer, sans cocher la case qui fait confiance au domaine, puis continuer vers nxt5.org. Masquer ensuite le paramètre `?lier=…` de l’adresse. S’il n’y a pas d’avertissement, pas de capture : noter `externalLinkWarning: false`. |
| — | — | Navigateur | Sur nxt5.org (page « Bot Discord » ouverte par le lien), vérifier les deux comptes puis cliquer sur « Confirmer mon compte NXT5 ». Pas de capture. |
| 8 | `dc08-verifier-comptes` | Discord | De retour dans Discord, cliquer sur « Vérifier la liaison ». Capturer le nouveau message « Vérifie les deux comptes », avec « Discord : … », « Compte NXT5 : … » et les boutons « Confirmer la liaison » et « Annuler ». Si « Confirmation NXT5 attendue » s’affiche, la confirmation sur le site n’a pas été faite : la faire, puis recommencer. **Toujours masquer les deux noms.** |
| 9 | `dc09-compte-lie` | Discord | Après « Confirmer la liaison » : le nouveau message « Compte lié ». |
| — | — | — | *Annoncer en une fois les écritures du code et des captures 10 et 11, puis les enchaîner sans pause (code valable 10 minutes).* |
| — | — | Navigateur | Sur nxt5.org, dans « Bot Discord », onglet « Serveur » :<ol><li>cliquer sur « J’ai confirmé dans Discord · Vérifier » si la carte le propose ;</li><li>dans « 2. Relier cette équipe au serveur », cliquer sur « Créer le code de liaison », puis « Copier la commande » ;</li><li>recopier dans le manifeste la commande exacte (`/nxt connecter code:…`) et le texte « Valable jusqu’au … » tel qu’il s’affiche.</li></ol> |
| 10 | `dc10-commande-connecter` | Discord | Dans `#bot-nxt5`, coller la commande (Ctrl + V) sans valider. Capturer le champ tel que Discord l’affiche, avec la commande `/nxt connecter` et son code. |
| 11 | `dc11-serveur-relie` | Discord | Après validation : la réponse du bot « Serveur relié à cette équipe NXT5. Retourne dans Bot Discord… ». |
| — | — | Navigateur | Sur nxt5.org, attendre « Serveur relié » ou cliquer sur « Vérifier la connexion ». Ensuite :<ol><li>**Salons.** Dans « Salon des commandes de l’équipe », choisir `#bot-nxt5`, puis cliquer sur « Associer ce salon ».</li><li>Dans « Choisir un salon du serveur », choisir `#résultats`, puis cliquer sur « Ajouter ce salon », sans rien changer d’autre.</li><li>Cliquer sur « Enregistrer les salons », puis sur « Passer au test et à l’activation ».</li><li>**Test.** Dans « Salon du message de test », choisir `#résultats`, puis cliquer sur « Envoyer le message de test ».</li><li>Attendre « Test reçu sur Discord ».</li></ol> |
| 12 | `dc12-message-test` | Discord | Salon `#résultats` ouvert : le message de test du bot en entier (« Test de connexion NXT5 — données fictives… », embed « TEST NXT5 · Exemple fictif » et son image), avec le nom et l’avatar du bot. Si l’image dépasse en bas, faire défiler pour qu’elle tienne et noter ce défilement. |
| — | — | Navigateur | Sur nxt5.org :<ol><li>cliquer sur « Activer la diffusion », lire le récapitulatif, puis cliquer sur « Confirmer l’activation » ;</li><li>attendre « Diffusion active » ;</li><li>aller dans Parties, ouvrir la partie « Aurore » et cliquer sur « Exporter sur Discord » ;</li><li>cliquer sur « Préparer l’aperçu », puis « Publier dans #résultats » ;</li><li>attendre « Publié sur Discord. ».</li></ol> |
| 13 | `dc13-partie-publiee` | Discord | Salon `#résultats` : le message de la partie en entier (titre « Équipe Démo vs Aurore », ligne « Victoire · 22–11 kills · 25:00 », ligne « Scrim », visuel, bouton « Voir la game sur NXT5 »). Le message de test peut rester visible au-dessus. Recopier le titre exact dans le manifeste (`names.publicationTitle`). |
| 14 | `dc14-visuel-agrandi` | Discord | Cliquer sur le visuel de la partie : la visionneuse d’images de Discord l’affiche en grand. Capturer, puis fermer avec Échap. |
| 15 | `dc15-nxt-voir` | Discord | **Facultatif, écriture publique à annoncer.** Dans `#bot-nxt5`, lancer `/nxt voir` avec `sujet` = « Dernière partie » (cette option est obligatoire). Le bot publie la fiche de la dernière partie dans le salon, visible par ceux qui y ont accès, puis répond en privé « Résultat envoyé dans le salon de ton équipe. ». Capturer les deux. |

## Manifeste

Copier `tools/promo-video/v3/capture/discord/manifest.template.json` vers `tools/promo-video/v3/public/tuto-discord/real/manifest.json`, puis le remplir :

- **Noms exacts, tels qu’ils s’affichent :**
  - le nom du serveur ;
  - le nom et l’avatar du bot (décrire l’avatar en une phrase) ;
  - le titre du message publié ;
  - la commande de liaison et le texte « Valable jusqu’au … ».
  - Ne jamais écrire le nom du compte NXT5 ni le nom Discord du propriétaire.
- **Pour chaque capture :**
  - ce qu’elle montre ;
  - tout écart avec la colonne « État exact » ;
  - si possible, la position en pixels de la PNG du bouton ou du champ cliqué ensuite. Sinon, laisser vide : le montage la mesurera.
- **Observations :**
  - le bot était-il déjà sur le serveur ;
  - le compte était-il déjà lié ;
  - l’avertissement de lien externe ;
  - le captcha ;
  - chaque message d’erreur rencontré, avec son texte exact.

## Contrôle et livraison

1. Ouvrir chaque PNG de `public/tuto-discord/real/` et vérifier :
   - il n’y a ni pointeur, ni info-bulle, ni notification ;
   - il n’y a ni message privé, ni contenu d’un autre salon ;
   - la liste des membres est masquée ;
   - aucune adresse e-mail n’apparaît ;
   - aucun nom ni avatar d’une personne autre que le bot n’apparaît sans aplat ;
   - l’identifiant NXT5 est masqué ;
   - aucun prix, aucune offre, aucun abonnement n’apparaît ;
   - les textes du bot sont lisibles.
2. Faire valider la liste par le propriétaire avant le commit, puisque le dépôt est public. `git status` ne doit montrer aucun fichier de `raw-local/`.
3. Commit et push :

```powershell
git add tools/promo-video/v3/public/tuto-discord/real
git status --short
git commit -m "Tuto Discord : captures Discord réelles masquées et manifeste"
git pull --rebase origin claude/clever-meitner-votyvi
git push origin HEAD:claude/clever-meitner-votyvi
```

4. Rétablir les réglages Discord notés au début.
5. Ne supprimer ni la catégorie ni les messages. Le propriétaire décidera plus tard s’il garde la diffusion active pour `Équipe Démo` :
   - Pour arrêter les publications sans rien supprimer : « Bot Discord » → « Aide et réglages » → « Mettre en pause ».
   - Pour délier l’équipe : « Bot Discord » → « Aide et réglages » → « Délier cette équipe » → « Confirmer la déliaison ». Cette action ne retire pas le bot du serveur.
   - Les captures brutes de `raw-local/` restent sur le PC. Le propriétaire peut les supprimer ou les garder.

## Si quelque chose bloque

- **`/nxt` n’apparaît pas dans Discord, ou le site affiche « Service indisponible » ou « Le bot Discord n’est pas encore disponible… » :** le bot n’est pas actif en production. Arrêter la séance et ne pas capturer le site.
  - Recopier le message exact dans `observations.errors`.
  - Si l’erreur s’affiche dans Discord, la capturer avec `-Name dc00-erreur-<mot> -Expect Discord`. Ne la publier qu’avec l’accord du propriétaire, et masquée.
- **« Cette commande est réservée aux responsables du serveur. »** : le compte n’a ni « Gérer le serveur » ni « Administrateur » sur le serveur NXT.
- **« Ce code est expiré, déjà utilisé ou n’est plus autorisé… »** : recréer un code sur le site (« Créer le code de liaison »), puis refaire les captures 10 et 11.
- **« Ce lien personnel a expiré ou a déjà été utilisé. Relance /nxt lier. »** : relancer `/nxt lier` et refaire les captures 5 à 9.
- **Un salon manque dans les listes du site, ou porte « · envoi impossible » (salon des commandes) ou « · autorisation manquante » (salons de publication) :**
  1. dans « Où recevoir les résultats ? », ouvrir « Le bot ne voit pas un salon ? » ;
  2. cliquer sur « Mettre à jour les autorisations » (avec l’accord du propriétaire) et valider dans Discord ;
  3. revenir sur le site et cliquer sur « Actualiser les salons ».
