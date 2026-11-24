# Durcissement de l’API — 23 novembre 2026

Branche `claude/api-hardening-20261123`, issue de `origin/main`. Huit corrections côté serveur, chacune couverte par des tests.

## Changements

1. **Marché des scrims** (`_lib/scrims.ts`, `ScrimFinder.jsx`) : les lignes de la liste ne répètent plus l’avatar de l’équipe. Une équipe avec un avatar de 1,2 Mo et 10 propositions pouvait dépasser la limite de 6 Mo d’une réponse Netlify, et la liste devenait inaccessible pour tout le monde. La réponse contient maintenant une table `teamAvatars` (`{ teamId: dataUrl }`) avec chaque image une seule fois. Le client réinjecte l’avatar dans `team` au chargement.
2. **Reviews** (`reports-manage.ts`) : la création et la modification sont limitées à 30 enregistrements par compte toutes les 10 minutes (`reports-manage-write`). Chaque enregistrement peut contenir jusqu’à 256 000 caractères. La suppression n’est pas limitée.
3. **Création d’équipe** (`teams-create.ts`, `teams-update.ts`) :
   - Les champs ont les mêmes bornes qu’à la modification : nom de 80 caractères, tag de 12.
   - La région doit appartenir à une liste. Les libellés traduits comme « J.P. » sont normalisés.
   - Un compte peut créer 10 équipes par heure.
   - L’équipe, l’adhésion du capitaine et l’entrée d’audit sont enregistrées dans une seule transaction.
   - Un nom déjà utilisé par le même propriétaire renvoie 409 `TEAM_NAME_TAKEN`, à la création comme au renommage.
4. **Profil** (`auth-update-profile.ts`) : un e-mail déjà utilisé renvoie 409 `EMAIL_IN_USE` au lieu d’une erreur 500. Le message s’affiche dans les paramètres du compte.
5. **Profils joueurs** (`players-create.ts`, `players-update.ts`, `_lib/player-roster.ts`) :
   - Les règles sont celles de l’import d’effectif : nom de 80 caractères, Riot ID de 128 caractères au format `Pseudo#TAG`, pas de caractères de contrôle.
   - Le lien OP.GG doit être vide ou une adresse `https` de 500 caractères au plus.
   - Lors d’une modification, le Riot ID n’est contrôlé que s’il change, pour ne pas bloquer les anciens profils.
6. **E-mails d’import de partie** (`_lib/match-notifications.ts`) : les envois sont limités à 10 par importateur et 20 par équipe toutes les 10 minutes. L’importateur est le compte, ou le lien d’import pour l’application de bureau. Au-delà, l’e-mail est ignoré sans bruit et l’import réussit quand même. `matches-import.ts` utilise désormais cette fonction partagée au lieu de sa copie locale.
7. **Ordre des contrôles d’import** (`matches-import.ts`, `matches-import-file.ts`) : en production, la limite de débit et l’authentification passent avant la lecture du corps de la requête, qui peut atteindre 5 Mo. Sur un aperçu de déploiement isolé, le corps est lu d’abord : une écriture doit y être refusée avant tout accès à la base, et seuls les aperçus `previewOnly` sont acceptés.
8. **Identifiants et dates invalides** (`_lib/http.ts`, `player-availability-manage.ts`) : `handleError` transforme les codes PostgreSQL 22P02, 22007 et 22008 en réponse 400 `INVALID_INPUT` (« Identifiant ou date invalide. »). Ces erreurs ne doivent pas avoir déjà un statut HTTP. Le message de la base n’est jamais renvoyé. La semaine d’une disponibilité doit être une date qui existe vraiment.

   On a choisi une correspondance centrale plutôt qu’une validation dans chaque endpoint : elle couvre toutes les routes concernées, y compris les futures. Les usages volontaires de 22P02 comme garde (scrims, outils d’administration) interceptent déjà l’erreur avant `handleError`.

## Suite à donner

- ~~`bootstrap.ts` charge toujours toutes les reviews de l’équipe, contenu compris, sans limite ni pagination.~~ Fait : voir « Volume des notes dans le bootstrap » ci-dessous.
- ~~La liste des scrims envoie encore un avatar par équipe distincte. Elle peut en contenir jusqu’à 100. Une limite de taille des avatars ou un endpoint d’image dédié supprimerait ce risque résiduel.~~ Fait pour les nouveaux logos (voir « Poids des logos d’équipe »).

## Volume des notes dans le bootstrap (fait)

Chaque note peut contenir 256 000 caractères. Assez de longues notes faisaient dépasser à la réponse du bootstrap la limite d’environ 6 Mo de Netlify, et l’espace de l’équipe ne se chargeait plus. Aucune donnée n’est perdue et le cas courant ne change pas.

- **Serveur** (`_lib/report-feed.ts`, utilisé par `bootstrap.ts`) : même règle de visibilité (brouillons réservés au staff), tri par date de création décroissante, 1 000 notes au plus. Le contenu (et la copie figée `original_debrief.content`) n’est renvoyé que tant que leur taille cumulée, calculée en SQL avec `octet_length` et une somme fenêtrée, reste sous 2 000 000 octets. Au-delà, `content` vaut `null` et `content_omitted` vaut `true` : ces contenus ne sortent donc pas non plus de la base. Un contenu vide est toujours renvoyé, pour qu’une note supprimée reste reconnaissable.
- **Lecture à la demande** (`reports-manage.ts`, action `get`) : `{ action: "get", teamId, reportId }` renvoie la note complète. L’appartenance à l’équipe et la visibilité des brouillons sont vérifiées comme dans le bootstrap ; les identifiants doivent être des UUID (400 sinon). Cette lecture n’est pas soumise à la limite de débit des écritures.
- **Client** (`src/api/report-content.js`) : `loadFullReport` / `loadReportContent` et le hook `useFullReports` chargent les contenus omis, avec un cache mémoire par identifiant et `updated_at`. Les Notes ne chargent que les notes affichées ; « Modifier » attend le contenu complet et n’ouvre jamais un éditeur vide (message d’erreur sinon). La page d’une partie charge les débriefs omis de cette partie. L’accueil tolère un contenu absent.
- **Limite connue** : sans son contenu, une ancienne review V3 modifiée à la main est classée comme note par ses seules métadonnées ; si elle ne contient aucune note du staff, elle affiche le message prévu pour ce cas. La recherche des Notes ne porte pas sur les contenus omis.

## Poids des logos d'équipe (fait)

- Le navigateur réduit l'image choisie à 512 px sur son plus grand côté et la réencode en WebP (repli PNG puis JPEG) avant l'envoi : quelques dizaines de Ko au lieu de ~1,2 Mo. On peut désormais choisir une image jusqu'à 15 Mo.
- `teams-update` refuse en 413 `AVATAR_TOO_LARGE` toute nouvelle image de plus de 400 000 caractères, et ne tronque plus jamais une image (avant : coupure silencieuse à 1 500 000 caractères, image corrompue).
- Un logo plus lourd enregistré avant ce plafond reste accepté s'il est renvoyé inchangé (renommage de l'équipe). Ces anciens logos restent lourds tant que l'équipe ne les remplace pas.
