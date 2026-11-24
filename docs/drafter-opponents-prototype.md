# Adversaires et import Drafter

Guide issu du prototype du 12 octobre 2026 ; ces fonctions sont aujourd’hui dans le code de `main`. Les fiches adversaires sont dans **Parties > Équipes** (`/games?view=teams`), à côté de Parties et Groupes. L’ancienne adresse `/draft/adversaires` redirige vers ce nouvel emplacement.

## Utilisation

Les deux associations sont indépendantes et facultatives : une **partie → équipe adverse**, et une **partie → draft Drafter**. Une partie peut donc avoir les deux, une seule ou aucune de ces associations.

1. Dans **Parties > Équipes**, créer une fiche adversaire avec son nom et, si utile, des notes de préparation. Cet écran présente ses champions et ses parties, sans formulaire Drafter.
2. Lors de l’import d’une partie, choisir son **Équipe adverse (facultatif)** dans la liste des fiches enregistrées, ou utiliser **Nouvelle équipe**. Le choix peut aussi être modifié depuis le détail de la partie. Pour un scrim entier, ouvrir **Parties > Groupes**, puis choisir son **Équipe adverse du groupe**. Ce choix ne dépend pas de la présence d’une draft.
3. Dans le bloc distinct **Draft de la partie**, coller si souhaité un lien `https://drafter.lol/draft/…?game=2`, laisser charger les picks et bans disponibles et choisir le côté de notre équipe.
4. Enregistrer le lien Drafter. Cette action ne crée ni ne sélectionne une fiche adverse. Les noms affichés dans Drafter restent les noms de la source, sans devenir automatiquement des équipes NXT5.

Une réimportation de la même série et de la même game dans la même équipe actualise son instantané sans créer un doublon. Les membres peuvent lire les fiches ; seuls le propriétaire et les rôles de staff peuvent créer une fiche ou importer. Les données restent isolées entre équipes NXT5.

Les picks sont présentés dans leurs emplacements de sélection, pas comme des rôles de jeu confirmés. Les bans absents restent inconnus. L’import d’une draft ne crée pas de partie jouée et ne lui attribue ni résultat ni statistiques de victoire.

### Choisir l’adversaire pendant l’import d’une partie

Après le chargement du fichier et le choix de notre côté, le champ **Équipe adverse (facultatif)** propose les équipes déjà enregistrées, par ordre alphabétique. **Nouvelle équipe** permet de saisir un nom de 1 à 80 caractères. La fiche est créée et rattachée uniquement à la confirmation de l’import ; annuler le formulaire ne crée rien. Un nom déjà enregistré est réutilisé, sans doublon.

La partie, ses participants et son rattachement sont enregistrés dans une même transaction. Si l’import échoue, aucune nouvelle fiche n’est conservée. Laisser le champ **Non renseignée** importe une nouvelle partie sans adversaire ; pour une partie déjà importée, cela conserve l’association existante. Pour retirer cette association, utiliser le détail de la partie. Si un groupe lié définit son équipe, le réimport accepte le même adversaire et refuse un adversaire différent ; il faut modifier le lien du groupe pour le changer. Cette vérification est renouvelée dans la transaction et un conflit annule aussi toute fiche nouvellement créée. Un échec de chargement de la liste permet de réessayer ou de continuer sans choisir d’adversaire.

### Lier une draft à une partie

Depuis le détail d’une partie, ouvrir **Drafting → Ajouter une draft**, coller le lien. L’aperçu s’ouvre automatiquement. Choisir le côté de notre équipe puis enregistrer. Le serveur conserve le lien source, l’instantané lu et sa date d’import, sans modifier l’équipe adverse de la partie.

Une partie peut avoir une draft liée et une draft ne peut être liée qu’à une seule partie. Remplacer ou détacher ce lien conserve la draft précédente dans l’historique des analyses, mais elle ne contribue plus à la fiche adverse. Supprimer une partie conserve aussi son instantané ; il devient simplement non lié. Le rattachement ne modifie pas les participants ou les statistiques de la partie.

### Consulter une équipe adverse

La fiche réunit uniquement les parties auxquelles cette équipe a été explicitement associée. Les champions des participants adverses sont prioritaires. Si cette composition est incomplète, la draft de la partie peut fournir une composition de remplacement, présentée comme issue d’une draft. Chaque partie n’est comptée qu’une fois. Les bans proviennent uniquement des drafts actuellement liées à ces parties, avec une couverture indiquant les données exploitables.

Changer ou retirer l’équipe adverse d’une partie déplace ou retire ses observations de la fiche, tout en conservant son lien Drafter. Retirer son Drafter ne retire pas son équipe adverse. Les anciennes drafts détachées restent consultables dans Analyses, sans être attribuées à une équipe d’après leur seul nom.

### Analyser les picks et les bans

**Analyses > Drafts & bans** regroupe les drafts enregistrées, y compris l’historique détaché et les drafts jouées dans la [Salle de draft](assistant/strategy-draft-planning.md#salle-de-draft). Les filtres portent sur l’équipe adverse liée (avec un choix « Sans équipe liée »), notre camp ou le camp adverse, et le rattachement à une partie. Une draft peut être analysée sans fiche équipe. La vue présente les fréquences des champions sélectionnés et bannis, le premier pick global, les choix n° 1 à 5 de chaque camp et les bans par phase. Chaque fréquence indique le nombre de drafts exploitables ; les données inconnues sont exclues du calcul concerné. Un ban explicitement passé reste distinct d’un ban inconnu.

La chronologie numérotée expose les 20 emplacements du format standard, leurs camps et les quatre phases. Elle est **reconstituée à partir des emplacements finaux**, et non d’un journal d’événements : les corrections intermédiaires et leur heure ne sont pas connues. Le premier pick global ne compte que les drafts où le camp analysé ouvre la sélection. Les données n’attribuent pas de rôle joué ni d’efficacité à un choix.

Les imports historiques affichent une chronologie si leur instantané contient la preuve du format vérifié en octobre 2026. Les captures réalisées à partir du fichier de partie et des observations du staff alimentent les fréquences de l’équipe. L’ordre des picks et des bans y reste inconnu.

## Groupes et équipes adverses

Dans le détail d’un groupe, le propriétaire ou le staff choisit une fiche adverse existante, ou en crée une, puis enregistre le lien. Le groupe conserve `opponent_id` ; toutes ses parties sont associées à cet adversaire dans la même transaction. Les parties ajoutées plus tard au groupe héritent de cette association. Plusieurs groupes et scrims distincts peuvent partager une même équipe adverse, sans fusionner leurs noms ou leurs parties.

La liste des groupes affiche l’équipe liée. Chaque fiche adverse présente les groupes correspondants et permet de les ouvrir. Les liens conservent aussi l’équipe NXT5 active. Les statistiques restent calculées à partir des parties uniques : une partie dans deux groupes n’est pas comptée deux fois.

Une partie appartenant à plusieurs groupes liés doit avoir le même adversaire dans chacun. Une association incompatible renvoie un conflit sans modification partielle. Dans sa fiche, une partie dont l’adversaire dépend d’un groupe renvoie vers les groupes concernés pour modifier le lien. Retirer le lien d’un groupe, retirer une partie du groupe ou supprimer le groupe conserve les équipes déjà associées aux parties. Le créateur peut toujours modifier le nom et la description ; changer les parties d’un groupe lié requiert le propriétaire ou le staff.

La migration `20261012_group_opponents.sql` doit suivre les trois migrations adversaires décrites ci-dessous. Elle rattache une fois les groupes existants dont toutes les parties référencées existent dans la même équipe et ont déjà le même adversaire non vide. Elle laisse sans lien les groupes vides, mixtes ou incomplets. Rejouer la migration ne restaure pas un lien retiré manuellement. Aucun nom de dossier ou titre de partie n’est utilisé pour deviner une affiliation. Les titres de parties et les groupes existants sont conservés.

## Lecture sans API payante

Le staff colle le lien de la game, choisit son côté et enregistre. NXT5 réutilise les anciennes drafts et les observations déjà enregistrées. Pour un nouveau lien, les champions proviennent des participants et les bans du fichier de partie. Si une liste est incomplète et que Riot est configuré, NXT5 interroge Match-V5 avec l’identifiant Riot de cette partie. Une partie inaccessible reste rattachable avec les informations disponibles. Les bans présents uniquement sur Drafter restent inconnus. [Conditions de Drafter, section 4](https://drafter.lol/legal/terms).

L’aperçu signé expire après quinze minutes et lie les observations du match au compte, à l’équipe et à la partie. Le serveur revérifie les droits avant l’enregistrement.

## Essayer localement

Depuis la racine du dépôt :

```powershell
npm run prototype:drafter
```

Ouvrir [le prototype local](http://127.0.0.1:5188). Il utilise les vrais écrans Parties et Analyses, le vrai importeur, les gestionnaires serveur et les migrations SQL, avec une identité de démonstration et une base PGlite locale. Deux parties et un groupe de démonstration permettent d’essayer le rattachement et l’héritage lors d’un ajout ; les parties ne contiennent aucun résultat ou participant inventé. La démonstration accepte un lien et les sélections du staff. Elle conserve les fiches et les instantanés dans `.nxt5-drafter-prototype/db`, ignoré par Git. Le serveur écoute uniquement sur `127.0.0.1`, n’utilise aucun fichier `.env` et ne se connecte pas à la base de production. `Ctrl+C` l’arrête. Le port peut être choisi avec `NXT5_PROTOTYPE_PORT`.

Ce mode est un outil de développement local. Il ne doit pas être exposé sur le réseau ni déployé. La route intégrée à l’application normale conserve l’authentification et les permissions NXT5.

## Mise en service et vérification

La migration `20261012_opponents_drafts.sql` crée les tables `team_opponents` et `opponent_drafts`. La migration `20261012_match_drafts.sql` ajoute le rattachement facultatif aux parties et les contraintes d’unicité et d’équipe. `20261012_match_opponents.sql` rend l’association adverse indépendante via `matches.opponent_id` ; elle préserve les associations des drafts déjà liées et les anciennes données sans les utiliser comme affiliations implicites. `20261012_group_opponents.sql` ajoute ensuite le lien persistant des groupes décrit plus haut. Toutes quatre sont enregistrées dans le gestionnaire de migrations et doivent être appliquées par le processus habituel avant d’utiliser ces fonctions en environnement déployé. Aucun DDL n’est exécuté dans les requêtes web. Chaque équipe est limitée à 100 adversaires, 200 drafts, 2 000 parties rattachées et 2 000 groupes liés (`OPPONENT_LIMITS`) ; un dépassement renvoie une erreur explicite au lieu de statistiques tronquées. Le chargement des 100 groupes récents inclut aussi explicitement le groupe demandé par lien direct, même plus ancien.

Contrôles : `npm run verify`. Les tests dédiés couvrent la lecture de la bonne game, les URL interdites, les données incomplètes, les droits, la signature de l’aperçu, les doublons, le rattachement et ses conflits, les migrations, les calculs de fréquence et d’ordre, ainsi que les changements d’équipe dans l’interface. La validation locale du parcours utilise une base isolée ; aucune migration ni import de production n’est nécessaire.

La validation initiale du 12 octobre 2026 a importé la game 2 du lien fourni, rattaché OPIF au côté rouge, vérifié le réimport sans doublon et la persistance après rechargement puis redémarrage du serveur. La seconde validation couvre le rattachement depuis la partie de démonstration, le passage à l’analyse, les filtres et la chronologie. Les preuves sont dans `artifacts/drafter-prototype-2026-10-12/` et `artifacts/drafter-games-analysis-2026-10-12/`.

Validation de la première intégration : `npm run verify` réussit (201 fichiers, 3 630 tests, traductions, TypeScript, build et contrôle SEO). Affichage contrôlé sur ordinateur, à 390 px et à 320 px sans débordement horizontal.

Validation de la séparation équipe/draft : `npm run verify` réussit (203 fichiers, 3 662 tests, traductions, TypeScript, build et contrôle SEO). Le navigateur a confirmé avec la game 2 du lien fourni : import sans équipe adverse, retrait de l’équipe sans perte de la draft, disparition de la partie dans la fiche adverse après ce retrait, puis détachement de la draft sans perte de l’équipe. L’exemple complet a été rétabli. Deux blocs distincts vérifiés sur ordinateur et à 320 px ; fiches équipes sans formulaire Drafter et sans débordement horizontal. Preuves et journal complet : `artifacts/drafter-team-separation-2026-10-12/`.

Validation de livraison sur la branche de production actualisée : `npm run verify` réussit (203 fichiers, 3 685 tests) et l’audit des dépendances passe. Le parcours complet a été revérifié sur une base locale neuve : import de la game 2 sans création d’adversaire, association explicite d’OPIF, fiche équipe et chronologie des 20 emplacements. Les répertoires `artifacts/` cités sont des preuves locales, non incluses dans le dépôt.

Validation des liens de groupes, intégrée au choix de l’adversaire à l’import : `npm run verify` réussit (205 fichiers, 3 749 tests), ainsi que l’audit des dépendances. Sur la base locale, deux groupes ont été liés à OPIF ; une partie ajoutée a hérité de l’équipe, une affiliation contradictoire a été refusée et la fiche adverse conserve deux parties uniques malgré leur présence dans plusieurs groupes. Le panneau et la navigation ont été vérifiés sur ordinateur, à 390 px et à 320 px sans débordement horizontal de page. La migration, son rejeu, les droits, le réimport et l’accès direct au 101e groupe sont couverts par les tests SQL et React. Les captures et le journal sont conservés localement dans `.nxt5-drafter-prototype/`.
