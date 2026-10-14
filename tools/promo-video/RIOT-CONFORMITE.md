# Conformité Riot : promo NXT5 « Victoire. Pourquoi ? » (v3), miniature et kit YouTube

Pages Riot récupérées le 2026-10-14. Versions en vigueur à cette date :

| Texte | Version | URL |
|---|---|---|
| Legal Jibber Jabber (LJJ), en anglais | « Last Updated: August 2018 » | https://www.riotgames.com/en/legal |
| LJJ en français, « Jargon juridique » | « Dernière mise à jour : août 2018 » | https://www.riotgames.com/fr/mentions-legales |
| Terms of Service (ToS) | « Last Modified: December 1, 2024 » | https://www.riotgames.com/en/terms-of-service |
| Developer General Policies (GP) | « LAST UPDATED: MAY 29, 2025 » | https://developer.riotgames.com/policies/general |
| Index Game-Specific | « LAST UPDATED: AUGUST 21, 2026 » | https://developer.riotgames.com/policies/game-specific |
| Politique LoL, qui suit cet index | non datée | https://developer.riotgames.com/docs/lol |
| API Terms | « LAST UPDATED: DECEMBER 9, 2013 » | https://developer.riotgames.com/terms |

Ce rapport ne constitue pas un avis juridique. Il confronte les livrables aux textes publiés par Riot. Il ne tranche pas sur le droit des marques européen ou français.

---

## 1. Verdict global : conforme sous conditions, mais pas publiable en l'état

1. La vidéo et la miniature ne contiennent ni logo Riot ou LoL, ni séquence de jeu, ni musique Riot. L'art des champions provient de Data Dragon, que Riot autorise « in the development and marketing of your product ». Cette autorisation suppose un produit enregistré et conforme, doté d'une clé API accordée à NXT5 (exception 3 de LJJ). Rien dans le dépôt ne prouve ce statut.
2. Trois écarts sont à corriger :
   - les tags et hashtags reprennent des marques Riot, ce que LJJ §5 interdit ;
   - les icônes de rôle et les icônes Dragon/Nashor sont extraites du client via CommunityDragon, donc hors de la liste « Only … Press kit / Game-Specific static data » ;
   - monétiser la vidéo par la publicité YouTube n'est autorisé par aucun texte Riot pour une entreprise qui fait la promotion de son produit.
3. Une fois ces corrections faites et le statut au Developer Portal confirmé, la vidéo peut être publiée **sans monétisation**. Sans cette confirmation, seule une version sans IP Riot est défendable. La monétisation doit attendre un accord écrit de Riot.

---

## 2. Tableau de conformité

Abréviations utilisées :
- **LJJ** = riotgames.com/en/legal
- **GP** = developer.riotgames.com/policies/general
- **LoL** = developer.riotgames.com/docs/lol
- **API** = developer.riotgames.com/terms
- **ToS** = riotgames.com/en/terms-of-service

| Élément | Règle Riot (citation exacte + URL) | Statut | Correction |
|---|---|---|---|
| **Base de tout usage commercial** : statut de NXT5 au Developer Portal | LJJ §2, exception 3 : « We permit commercial Projects that both (1) comply with our API Terms and API Policies; and (2) use a currently valid Riot API key that we granted to you specifically for your Project. »<br>GP : « All products must be registered in, and audited by Riot Games through the Developer Portal » | **Incertain** (non documenté dans le dépôt ; RSO toujours en attente, `docs/social-provider-configuration.md:42`) | Obtenir une preuve : produit enregistré, clé de production propre à NXT5, statut Approved ou Acknowledged, description couvrant les fonctions montrées. Sans cette preuve, publier uniquement une version sans IP Riot. |
| **Cartes de champions du plan Draft** : Gnar, Vi, Ahri, Jinx, Braum, environ 205×323 px, 56 % de la largeur aux images 468–497, plus le gros plan sur Gnar aux images 360–395 | GP : « Use the following assets in the development and marketing of your product: Data Dragon […] Press Kit »<br>LoL : « Only the following Riot IP assets may be used in the development and marketing of your product: Press kit […] Game-Specific static data »<br>LoL : « Data Dragon is our way of centralizing League of Legends game data and assets, including champions […] All of which can be used by third-party developers. » | **OK si le statut est confirmé.** Provenance Data Dragon documentée : images « loading », converties en WebP 240×436, `docs/home-release/champion-assets.json`. | Garder le manifeste comme preuve. Le Press Kit (riotgames.com/en/press) ne contient que des logos : la seule base pour l'art des champions est Data Dragon. |
| **Cartes de champions de l'outro** : Ahri, Gnar, Jinx, environ 9,5 s, pendant la fenêtre d'écran de fin | Mêmes règles | **OK si le statut est confirmé** | Même condition. Préparer une version de secours sans ces cartes. |
| **Portraits de champions** : liste /demo et carte review | Mêmes règles | **OK**. La démo n'a pas de `championId`, donc la première source chargée est Data Dragon. **Écart documentaire** : `Lulu-icon.webp` et `Sejuani-icon.webp`, visibles dans la carte review, n'ont pas d'entrée de provenance. | Ajouter ces deux entrées à `champion-assets.json`. |
| **Icônes de rôle TOP/JGL/MID/ADC/SUP** : coins des cartes Draft, Planning (720–831), coin de l'outro. Ce sont des SVG du client, tirés de CommunityDragon 12.23 (`public/assets/roles/README.md`). | LoL : « Only the following Riot IP assets may be used in the development and marketing of your product »<br>LJJ §3 : « Please do not take any part of our IP (e.g., character appearance, character abilities, maps, icons, items, etc.) and use it in a game or app. »<br>GP : « Products should use supported services from Riot Games for data ingestion » | **Non conforme (probable)** | Remplacer par des pictogrammes NXT5 ou par les seuls libellés texte. Recapturer les textures, puis refaire le rendu. |
| **Icônes Dragon et Nashor** : plan Analyse (222–360), Planning, outro. Leur écart moyen avec les icônes `dragon_circle` et `baron_circle` de CommunityDragon est de 4,2 et 4,7 sur 255 ; aucune provenance n'est documentée. | Mêmes règles | **Non conforme (probable)** | Mêmes corrections que pour les icônes de rôle. |
| **« League of Legends » en texte** : sous-titre du plan Brand (images environ 145–221) et description, ligne 37 | LJJ §5 : « you may not use any of our logos or trademarks anywhere in your Project or on any website, advertising material, video, or other publication. »<br>GP : « Using Riot logos, trademarks etc. from the Press Kit must be limited to those cases where such use is inevitable to serve the core value of the product » | **Risque faible ou incertain.** Une seule mention descriptive. Qu'elle soit « inévitable » relève de l'interprétation. | Garder une seule mention, descriptive, sans article défini. Le texte exact est en section 3. |
| **Termes de jeu à l'écran** : « Faille de l'invocateur », Dragon, Nashor, noms de champions | ToS §3.2 : « characters, character names, […] locations, location names […] (collectively, “Game Content”) » | **OK si le statut est confirmé.** Ce sont des données statiques du jeu, affichées par le produit sur des données fictives. | Ne jamais les reprendre dans le titre, les tags ou la miniature. |
| **Tags** : `league of legends, lol, coaching lol…` (YOUTUBE.md:55)<br>**Hashtags** : `#LeagueOfLegends #CoachingLoL` (l. 50) | LJJ §5 : « You may not use our trademarks or names related to our IP as keywords or internet search tags. »<br>ToS §3.2 : « you may never use any of our trademarks, service marks, trade names, logos, domain names, taglines, or trade dress. » | **Non conforme** | Remplacer par les textes de la section 3. |
| **Titre** : recommandé (l. 23) et variantes 1–2 avec « LoL » (l. 27–28) | LJJ §5 et ToS §3.2 | Titre recommandé **OK**. Variantes 1–2 : **risque**. | Utiliser uniquement le titre recommandé, ou la variante 3. |
| **Disclaimer dans la description** (l. 48) | GP : « You must post the following legal boilerplate to your product in a location that is readily visible to players » | **OK.** Le texte est identique au modèle, aux apostrophes typographiques près. L'obligation vise le produit ; dans la vidéo, c'est une précaution. | Le garder et le remonter dans la description. Ajouter une ligne à l'écran sur la carte finale (précaution). |
| **Disclaimer sur le site**, vers lequel la vidéo renvoie | Même règle GP | **Non conforme.** Le pied de page dit seulement « NXT5 n'est pas affilié à Riot Games. » (`PublicPages.jsx:146`). Les mentions légales n'en donnent qu'une paraphrase (l. 166). | Afficher le texte exact dans le pied de page avant de diriger du trafic vers le site. |
| **Aval ou partenariat** | API (k) : « …in a way that does or may constitute a direct or indirect endorsement, certification or approval by Riot… »<br>API : « no act by Riot shall constitute endorsement, certification or approval of any Application, including, without limitation, Riot's registration of an Application and issuance of a Production Key. » | **OK.** Aucune mention « officiel », « partenaire » ou « approuvé ». | Ne jamais écrire « officiel », « approuvé », « conforme Riot » ni afficher de badge de conformité, même après approbation. |
| **Monétisation YouTube (AdSense) de la vidéo** | LJJ, exception 1 : « We permit individual players to promote their Projects on websites, streams, or videos and passively generate revenue through appropriate advertisements »<br>API : « You may advertise through such software applications and/or websites without asking for Riot's permission » | **Incertain, avec risque.** L'exception 1 vise des joueurs individuels. La phrase des API Terms vise la publicité dans l'application ou le site. Aucun texte ne couvre une vidéo publicitaire monétisée. | Ne pas monétiser. Si la monétisation est voulue, obtenir d'abord un accord écrit de Riot DevRel. |
| **Contenu payant ou réservé** | LJJ §2 : « any Project where you gate the content with a paywall (e.g., Patreon, YouTube Premium, etc.) » | **OK** si la vidéo est publique | Pas de vidéo réservée aux membres ni d'accès payant. |
| **Offre promue (Pass Équipe)** : obligatoire après 14 jours de Découverte (`PricingPage.jsx:19`), désactivée aujourd'hui | GP : « You may monetize your product as long as your product is registered on the Developer Portal and your product status is either Approved or Acknowledged. You must have a free tier of access for players »<br>API : « You must notify Riot and obtain Riot's prior written approval before undertaking such activities » et « Failure to obtain Riot's prior written permission will result in the termination of Your rights under these API Terms. » | Vidéo : **OK**, car elle ne mentionne ni prix ni gratuité. Projet tarifaire : **non conforme** en l'état. | Avant de lancer le Pass : prévoir un palier gratuit permanent et obtenir l'accord écrit préalable de Riot. |
| **Dons Ko-fi** (actifs) | GP : « Acceptable ways to charge players are: Subscriptions, donations, or crowdfunding », sous condition du statut Approved ou Acknowledged | **Incertain** (dépend du statut) | Couvert par la question 1 de la section 4. |
| **Miniature** | Pas de règle propre aux miniatures. LJJ §5 s'applique : « video, or other publication » | **OK.** Aucune IP Riot, vérifié visuellement. | Ne pas y ajouter d'art de champion ni de logo. |
| **Musique** (Mixkit) | Riot Music, usage commercial interdit : « Use in content that has the sole purpose of advertising or selling a product or service. » (leagueoflegends.com/en-us/news/community/riot-music-creator-safe-guidelines/) | **OK** | Ne jamais utiliser de musique Riot, même « Creator-Safe ». |
| **Contenu original et détection automatique** | LJJ §4 : « We reserve the right to use services that identify our content automatically to prevent cannibalization of existing content. » | **OK, risque faible** (pas de gameplay ni de VOD) | Garder le manifeste de provenance et une version sans IP pour contester une éventuelle revendication. |
| **Scrims affichés** (« Scrim 3 », partie personnalisée) | LoL : « Products may not publicly display a player's match history from the custom match queue unless the player opts in to share this specifically for League of Legends. Otherwise, a player's custom match data may only be made available to them using RSO. » | Vidéo : **OK** (données fictives). Produit : **incertain**, car RSO n'est pas approuvé. | Ne pas promettre la publication publique de scrims. |
| **« avec le contexte du replay »** (texture `review-1200.png`) | API (h) : « You will promote, display and distribute Your Applications in an ethical manner… ». Notes du patch 26.20 : « third-party apps & sites will lose access to replay downloads entirely » (reporté au patch 26.21, prévu le 21 octobre 2026). | **Incertain** | Voir la question 6 de la section 4 ; reformuler si nécessaire. |
| **Nom et handle de la chaîne YouTube** | LJJ §5 : « You may not register domain names, social media accounts, or similar stuff that uses Riot Games or any of our trademarks, trade names, character names, etc. » | **Non vérifié** | Ni « LoL », ni « League », ni « Riot », ni nom de champion. |
| **Révocation** | LJJ §1 : « If we deny you the right to use our IP, you must stop developing, publishing, or distributing your Project immediately. »<br>LJJ, exception 3 : « If we revoke your API key for any reason, you must immediately shut down your Project. » | **Risque permanent** | Garder prête une version sans IP Riot. |

---

## 3. Corrections indispensables, par ordre de priorité

### A. Avant toute publication

**1. Confirmer le statut au Developer Portal.** Conserver une capture d'écran de la page produit avec le nom, le statut et le type de clé. Vérifier que la description enregistrée couvre l'analyse, les débriefs, la draft, le planning, le bot Discord et l'Importer (qui utilise l'API du client local, le LCU). Sans cette confirmation, publier uniquement une version sans cartes, portraits ni icônes Riot.

**2. Remplacer les icônes de rôle et les icônes Dragon/Nashor par des pictogrammes NXT5 ou par des libellés texte.**
- Recapturer `draft.png`, `champ-1…5.png`, `planning.png`, `review-1200/2100/3345.png`, puis refaire le rendu.
- Revoir les images 222–360, 360–497, 720–831 et 831–1162.
- Sur le site, c'est un changement visuel : selon AGENTS.md, il faut lire la charte graphique NXT5, passer par le composant `RoleIcon` (`BrandAssets.jsx`) et lancer `npm run verify`.

**3. Métadonnées YouTube : textes exacts.**
- Tags : `nxt5, coaching esport, coach esport, analyse de partie, débrief de partie, scrim, draft, planning d'équipe, équipe esport, esport amateur, progresser en équipe`
- Hashtags (ligne 50) : `#NXT5 #CoachingEsport #EsportAmateur`
- Titre : « Victoire. Tu sais vraiment pourquoi ? | NXT5 ». Supprimer les variantes 1 et 2.
- Ligne 37 : « NXT5 est un espace de travail pour les équipes et coachs de League of Legends. »
- Option sans aucun risque de marque : supprimer purement et simplement le nom du jeu.
- Sous-titre du plan Brand (`Brand.tsx:76-78`), même formulation : « Un espace de travail pour les équipes / et coachs de League of Legends ».

**4. Paramètres YouTube.**
- Monétisation **désactivée**.
- Vidéo publique, non réservée aux membres.
- Commentaire épinglé inchangé (il est conforme).

**5. Disclaimers.**
- **Description** : texte exact des General Policies, à placer juste après les deux liens d'ouverture :
  > NXT5 isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.
- **Traduction française**, non officielle : les sources consultées ne donnent ce texte qu'en anglais, et c'est l'anglais qui fait foi.
  > NXT5 n'est pas approuvé par Riot Games et ne reflète pas les points de vue ou opinions de Riot Games ni de quiconque participe officiellement à la production ou à la gestion des propriétés de Riot Games. Riot Games et toutes les propriétés associées sont des marques commerciales ou des marques déposées de Riot Games, Inc.
- **Notice LJJ §6**, facultative. Son application à un produit commercial relève d'une interprétation, mais elle ne coûte rien.
  - EN : « NXT5 was created under Riot Games' "Legal Jibber Jabber" policy using assets owned by Riot Games.  Riot Games does not endorse or sponsor this project. »
  - FR officiel : « NXT5 a été créé en vertu de la politique juridique Riot Games intitulée « Jargon juridique » relative à l'utilisation d'actifs de Riot Games.  Riot Games ne soutient ni ne sponsorise ce projet. »
- **À l'écran** (précaution, ce n'est pas une exigence Riot) : petite ligne sur la carte finale, de 31,4 s à la fin : « NXT5 n'est pas approuvé par Riot Games. Riot Games et les propriétés associées sont des marques de Riot Games, Inc. » Faire aussi apparaître le tag « Données fictives » dès l'image 222 : il manque aux images 222–236.

**6. Site (produit).** Les General Policies exigent le texte anglais exact du point 5 dans un endroit « readily visible », à côté de la ligne française actuelle du pied de page. À faire avant de diriger du trafic vers nxt5.org.

### B. Avant de monétiser la vidéo ou de lancer une offre payante

**7.** Envoyer une demande écrite à Riot DevRel, via https://support-developer.riotgames.com ou la page produit du Portal. GP : « If you are unsure if your monetization platform is acceptable, contact us through the Developer Portal ». Texte proposé :
> Product: NXT5 (https://nxt5.org), app ID [ID]. We made a 39-second promotional video for NXT5 for our YouTube channel. It shows only NXT5's own interface with fictitious data, including Data Dragon champion art; it contains no Riot logo, gameplay footage or Riot music, and the description carries the required legal boilerplate. (1) May we enable YouTube ad revenue on this promotional video? (2) Please confirm that Data Dragon champion art may appear in it under "Use the following assets in the development and marketing of your product". (3) [If applicable] We plan a paid team subscription; per the API Terms we are notifying you and requesting prior written approval. We will keep a free tier of access for players.

**8.** Pass Équipe : prévoir un palier gratuit permanent, obtenir l'accord écrit préalable de Riot (API Terms) et un statut Approved ou Acknowledged, puis faire auditer cette nouvelle fonctionnalité au Portal.

### C. Recommandé

**9.** Compléter la provenance : `Lulu-icon.webp`, `Sejuani-icon.webp`, `public/assets/objectives/*.png`, les effets sonores de `v3/public/sfx`. Trancher la contradiction entre `tools/promo-video/ENGINE.md:63` (« aucun asset Riot ») et la v3.

**10.** Garder prête une version sans IP Riot (cartes, portraits et icônes retirés), en cas de révocation ou de revendication.

---

## 4. Questions pour l'équipe NXT5

1. NXT5 est-il enregistré au Riot Developer Portal ? Avec quel identifiant, quel statut (Approved, Acknowledged, Pending) et quel type de clé ? La clé `RIOT_API_KEY` de production est-elle dédiée à NXT5 seul (une clé par produit) ?
2. La description enregistrée couvre-t-elle les points suivants ?
   - le bot Discord et la « publication des parties » ;
   - l'Importer : lecture du LCU via le lockfile et `/lol-match-history/v1/…` (LoL : « This service is not officially supported for use with third party applications. ») ;
   - l'envoi de données de match à OpenAI pour l'assistant (règle LoL : « No apps serving as a “data broker” between our API and another third-party company. »).
3. La vidéo sera-t-elle monétisée (AdSense) ? Ou seulement publiée, voire sponsorisée en publicité payante ? Le second cas relève du « marketing » couvert par les General Policies si le produit est conforme. Le premier n'est couvert par aucun texte.
4. Qui publie : une personne physique ou une entité ? Les mentions légales disent « édité à titre non professionnel » (`PublicPages.jsx:162`). Ce statut est-il cohérent avec une campagne commerciale, les dons et le Pass prévu ?
5. Le Pass Équipe comportera-t-il un palier gratuit permanent ? Riot a-t-il été notifié ? Y a-t-il une date de lancement ?
6. NXT5 télécharge-t-il des replays de parties d'autres joueurs ? Sinon, la mention « avec le contexte du replay » reste exacte. Si oui, elle dépend de ce qui sortira au patch 26.21.
7. Où en est la demande RSO ? Comment les scrims (file personnalisée) partagés en équipe ou publiés sur Discord respectent-ils la règle d'opt-in ou RSO ?
8. Quels sont le nom et le handle exacts de la chaîne YouTube ?
9. L'équipe accepte-t-elle de retirer les icônes du client aussi du site, ou seulement de la vidéo ? Le site est lui aussi concerné par « Only the following Riot IP assets… ».
10. D'où viennent les effets sonores de `v3/public/sfx`, et sous quelle licence ?

---

## 5. Ce qui n'a pas pu être vérifié, et les limites

- **Statut au Developer Portal** : inaccessible sans compte connecté, et absent du dépôt. C'est la condition principale de tout le rapport.
- **Pages inaccessibles ou absentes** :
  - www.riotgames.com/fr/legal renvoie 404 ; LJJ en français a été trouvé sur /fr/mentions-legales.
  - developer.riotgames.com/faqs renvoie 404 ; /docs/faqs ne dit rien de l'IP ni du marketing.
  - Aucune FAQ officielle sur LJJ n'a été trouvée.
  - Pages concurrentes non lues (HTTP 403) : mobalytics.gg, u.gg. web.archive.org est inaccessible.
  - Les vidéos YouTube concurrentes n'ont été vues que par leurs métadonnées et leurs storyboards.
- **Versions** :
  - `/docs/lol` n'est pas datée ; l'index Game-Specific est daté du 21 août 2026.
  - Le miroir support-developer des General Policies diffère du Portal ; la version la plus stricte des deux a été retenue.
  - LJJ (« we change this from time to time ») et les General Policies (« Developers are expected to adhere to these policy changes as they arise ») sont à relire avant la publication.
- **Interprétations non tranchées par Riot** :
  - la mention descriptive « League of Legends » est-elle « inevitable » ?
  - la notice LJJ §6 s'applique-t-elle à un produit commercial ?
  - l'obligation de disclaimer, qui vise le produit, s'étend-elle au marketing ?
  - la publicité payante est-elle couverte par « marketing » ?
- **Hors du champ des textes Riot** : le droit des marques européen et français, notamment l'usage descriptif d'une marque, et les politiques propres à YouTube (monétisation, métadonnées trompeuses). Ni l'un ni les autres n'ont été vérifiés.
- **Rattachement juridique** : les API Terms prévalent sur les autres documents Riot (« shall govern ») et relèvent du droit californien. Pour les résidents de l'EEE, les ToS désignent Riot Games Limited et le droit irlandais (§16.1 et §15).
- **Inventaire de la vidéo** : une image sur 10 et quelques images en pleine résolution ont été examinées, pas toutes les images. Les icônes Dragon et Nashor ont été identifiées par comparaison d'images, sans documentation. La présence à l'écran de la phrase « contexte du replay » n'a pas été vérifiée image par image.
- **Pratique du secteur** : iTero achète des publicités YouTube avec beaucoup plus d'IP Riot, et Mobalytics a publié une promo similaire en 2019. Aucune sanction publique visant le marketing d'un outil n'a été trouvée, mais c'est une affirmation négative. Ces pratiques ne valent pas autorisation.

Fichiers clés :
- /home/user/NXT5/tools/promo-video/YOUTUBE.md
- /home/user/NXT5/tools/promo-video/v3/src/shots/Brand.tsx
- /home/user/NXT5/public/assets/roles/README.md
- /home/user/NXT5/public/assets/objectives/
- /home/user/NXT5/docs/home-release/champion-assets.json
- /home/user/NXT5/src/pages/public/PublicPages.jsx
- /home/user/NXT5/src/pages/public/PricingPage.jsx
- /home/user/NXT5/tools/promo-video/v3/public/textures/