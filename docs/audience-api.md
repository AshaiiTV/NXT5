# Fréquentation NXT5 — contrat et exploitation

La collecte est propriétaire, sur le même domaine que NXT5. Elle utilise PostgreSQL/Neon existant et des fonctions Netlify. Aucun service publicitaire ou outil analytique tiers n'est chargé. Les chiffres commencent avec les visites qui acceptent explicitement cette mesure ; aucun historique n'est reconstruit ou inventé.

## Activation et conservation

- Migration additive : `database/migrations/20260914_audience.sql`, clé `audience-20260914-v1` dans `tools/migration-runner.mjs`. Exécuter le flux habituel `npm run db:migrate` avant de servir la nouvelle version.
- Les endpoints vérifient la présence de cette clé sans exécuter de DDL à la requête. Une migration absente produit `503` et `code: "AUDIENCE_SCHEMA_MISSING"` ; le client ne démarre pas la collecte.
- Aucun secret supplémentaire n'est nécessaire. La preuve est un jeton aléatoire de 256 bits dont seul le SHA-256 est conservé côté serveur. Un booléen ou un UUID fourni par le navigateur ne remplace jamais une preuve valide.
- Le cookie de consentement et le visiteur expirent 180 jours après le choix, sans prolongation à chaque visite. La session expire après 30 minutes d'inactivité et ne dépasse pas l'échéance du consentement.
- La fonction programmée `audience-cleanup` tourne tous les jours à 03:35 UTC sur le déploiement publié. Elle supprime les événements, vues et sessions dépassant 180 jours et les preuves expirées, avec leurs dépendances. La conservation est donc un maximum, pas une garantie de 180 jours complets pour chaque visite. Vérifier les exécutions dans les journaux Netlify ; aucune adresse ou donnée brute d'événement n'est journalisée.
- Les sessions techniques créées lors d'un accord n'apparaissent dans aucun indicateur avant une première vue. Une preuve de refus contient seulement le choix, sa version, ses dates et l'empreinte du reçu nécessaire à la mémorisation du choix.

## Cookies

Tous sont limités au domaine courant, avec `Path=/`, `SameSite=Lax` et `Secure` en HTTPS.

| Nom | Rôle | Durée | Accessible au JS |
| --- | --- | --- | --- |
| `nxt5_audience_consent` | Reçu opaque du choix, nécessaire à sa mémorisation | 180 jours fixes | Non |
| `nxt5_audience_visitor` | UUID aléatoire après accord | 180 jours fixes | Non |
| `nxt5_audience_session` | Jeton opaque d'une session après accord | 30 minutes d'inactivité | Non |
| `nxt5_audience_optout` | Arrêt immédiat demandé par le visiteur, y compris hors ligne | 180 jours après refus | Oui |

Le cookie `nxt5_audience_optout=1` prime sur une ancienne preuve d'accord. Il est écrit avant la requête de retrait. La collecte s'arrête donc dans le navigateur même si cette requête échoue. Seul un nouvel accord explicite, enregistré avec succès, efface cet arrêt. Le refus efface les cookies visiteur/session ; la mise à jour serveur révoque aussi l'ancienne preuve. Les anciennes mesures ne sont plus enrichies.

## `GET /.netlify/functions/audience-consent`

Réponse `200` :

```json
{ "choice": null, "version": "2026-09-14", "expiresAt": null }
```

`choice` vaut `null`, `"accepted"` ou `"rejected"`. `expiresAt` est une date ISO ou `null` lorsqu'aucune preuve valide n'existe, notamment pour l'arrêt local de secours. Ce GET ne crée ni identifiant, ni cookie, ni événement, ni entrée de limitation. Sans reçu ni arrêt local, il n'interroge pas la base.

## `POST /.netlify/functions/audience-consent`

Corps JSON exact : `{ "analytics": true }` ou `{ "analytics": false }`. Le serveur exige un véritable booléen, l'`Origin` du même domaine et `Content-Type: application/json`. Taille maximale : 1 Kio.

Réponse `200` : `{ "choice": "accepted" | "rejected", "version": "2026-09-14", "expiresAt": "ISO" }` accompagnée des cookies appropriés. Un accord fait tourner le reçu et le visiteur ; il ne réutilise pas les mesures d'un ancien accord révoqué. Le client confirme ensuite avec le GET que les cookies sont effectivement acceptés avant de lancer son tracker.

Les écritures de choix sont limitées à 30/minute par sujet IP haché dans la table de sécurité existante. Un retrait révoque d'abord la preuve existante et pose l'arrêt local, même si ce budget est épuisé ; `429` peut donc limiter la mémorisation d'un nouveau reçu de refus sans réautoriser l'ancienne preuve.

## `POST /.netlify/functions/audience-events`

L'Origin doit être celui de la requête, le corps doit être JSON et faire au plus 4 Kio. Les champs inconnus sont refusés. Le reçu HttpOnly, le cookie visiteur correspondant et la preuve serveur encore valide sont obligatoires ; aucun identifiant de compte n'est accepté.

```json
{
  "type": "pageview",
  "eventId": "UUID",
  "pageId": "UUID",
  "path": "/tarifs",
  "referrer": "example.org",
  "source": "newsletter",
  "medium": "email",
  "campaign": "rentree"
}
```

- `type` : `pageview`, `engagement` ou `event`.
- `eventId` : UUID stable lors d'un retry ; sa contrainte unique empêche un doublon, y compris pour l'engagement.
- `pageId` : UUID propre à une ouverture de page. Une seule vue est comptée pour le couple session/page, même si plusieurs `eventId` sont envoyés.
- `path` : route présente dans l'allowlist partagée `src/app/audience-paths.js`. Les query strings et fragments sont retirés, les routes admin, les routes contenant des identifiants libres, la vérification d'email et les réinitialisations de mot de passe sont exclues. Les inconnues produisent `400`.
- `referrer` facultatif : nom d'hôte uniquement. Les URL complètes, IP, credentials, chemins, ports, query strings et références internes au même hôte ne sont pas stockés. Source de session = label `source` propre, sinon hôte externe valide, sinon `direct`.
- `source`, `medium`, `campaign` facultatifs : labels ASCII de 64 caractères maximum commençant par une lettre ; espaces, chiffres, `_`, `.`, `-` permis. Les adresses email, URL, UUID et longues séquences numériques/hexadécimales sont supprimés. Ne pas placer de données personnelles dans les UTM. Par exemple utiliser `rentree` plutôt que `rentrée`.
- `engagement` ajoute `durationSeconds` et `scrollDepth`, entiers cumulés, respectivement entre 0 et 86 400 et entre 0 et 100. Le serveur conserve le maximum déjà vu, plafonne le temps à la durée écoulée depuis la vue (+5 secondes de tolérance) et enregistre seulement le delta de temps nouvellement reçu. L'affichage/activité réelle est mesurée côté navigateur ; la durée ne prouve pas l'attention humaine.
- `event` ajoute un `name` parmi `signup`, `login`, `access_request`, `pricing_view`. Une action de même nom est comptée au maximum une fois par page/session. L'application émet inscription/connexion/demande après succès du parcours ; il s'agit de mesures de parcours, pas d'un registre de facturation.
- Les dimensions d'appareil et de navigateur sont classées depuis le User-Agent côté serveur. Le User-Agent brut n'est pas conservé. Le pays est le code approximatif transmis par Netlify, ou une chaîne vide. Aucun appel de géolocalisation navigateur n'est effectué.

Réponses :

| Statut | Corps / effet |
| --- | --- |
| `200` | `{ "ok": true }`, y compris les doublons sans seconde écriture |
| `200` | `{ "ok": true, "ignored": true }` pour un bot connu ou l'administrateur authentifié |
| `403` | `{ "ok": false, "code": "CONSENT_REQUIRED" }` : le client arrête la collecte |
| `409` | `{ "ok": false, "code": "AUDIENCE_SESSION_EXPIRED" }` : la page/session n'existe plus ; ouvrir une nouvelle vue, rejouer seulement une action métier si nécessaire, abandonner l'ancien cumul d'engagement |
| `400` / `413` / `415` | Corps, taille ou type de contenu invalide |
| `429` | Budget dépassé, avec `Retry-After` |
| `503` | Migration ou protection indisponible ; aucun accord implicite |

Les budgets sont 300 événements/minute par IP hachée et 120/minute par reçu haché. Les tables analytiques ne contiennent ni IP, ni email, ni identifiant de compte, ni empreinte de navigateur. Seule la table de sécurité conserve les sujets de limitation à sens unique, suivant sa purge existante. La collecte et le retrait verrouillent la même preuve PostgreSQL : une requête encore en attente ne peut écrire après la validation de son retrait.

## `GET /.netlify/functions/admin-audience`

Accès protégé par `requirePlatformAdmin`, avant toute lecture de fréquentation. Paramètres : `days=7|30|90` (30 par défaut), `device=all|desktop|mobile|tablet`, `source=all|label-ou-hôte`. La période sélectionnée et les comparaisons utilisent les mêmes filtres. Le temps réel applique appareil/source ; il conserve sa fenêtre propre de cinq minutes.

```text
{
  period: { from, to, days, timezone: "UTC" },
  comparison: { from, to },
  totals: { visitors, sessions, pageviews, engagedSessions, engagementRate,
    avgDurationSeconds, pagesPerSession, conversions, conversionRate,
    bounceRate, returningVisitors },
  previous: { mêmes champs que totals },
  timeseries: [{ date, visitors, sessions, pageviews, conversions }],
  realtime: { visitors, sessions, windowMinutes: 5, pages: [{ path, visitors }] },
  pages: [{ path, views, visitors, avgDurationSeconds, exits }],
  sources: [{ source, sessions, visitors, conversions }],
  campaigns: [{ source, medium, campaign, sessions, conversions }],
  devices: [{ device, sessions }], browsers: [{ browser, sessions }],
  countries: [{ country, sessions }],
  heatmap: [{ weekday, hour, pageviews }],
  goals: [{ name, events, sessions, conversionRate }],
  filters: { sources: [string] },
  retentionDays: 180, generatedAt: "ISO"
}
```

Tous les compteurs et taux sont des nombres. Les tableaux restent vides sans données, sauf la série quotidienne remplie de zéros et les quatre objectifs disponibles à zéro. Aucune fixture de démonstration n'est retournée. Les classements sont limités à 100 lignes, le temps réel à 20 pages et les sources sélectionnables à 200. Les calculs SQL agrègent dans la base, sans téléchargement d'événements individuels ou d'identifiants visiteurs vers l'administrateur.

### Définitions des indicateurs

- `from` et `to` sont des dates `YYYY-MM-DD` **inclusives** à afficher. SQL borne chaque fenêtre de minuit UTC inclus à minuit du lendemain de `to` exclu. La fenêtre courante inclut aujourd'hui en cours ; la précédente comporte exactement le même nombre de jours complets. La journée incomplète doit rester visible dans l'interface et dans l'interprétation des variations.
- Visiteurs : UUID distincts ayant eu une activité reçue dans la période ; ils ne représentent pas des personnes identifiées ni des utilisateurs connectés. Un visiteur changeant de navigateur, refusant puis acceptant de nouveau ou supprimant ses cookies peut être recompté.
- Sessions : sessions ayant au moins une vue, action ou mise à jour d'engagement reçue dans la période. Une session qui traverse minuit apparaît chaque jour où elle a de l'activité, mais une seule fois dans le total de la période. Les uniques quotidiens ne doivent donc pas être additionnés pour recalculer le total.
- Vues, objectifs et carte horaire : timestamps serveur des vues/actions dans leur fenêtre réelle, même pour une session commencée avant cette fenêtre. `weekday` suit JavaScript, dimanche = 0 ; heures 0–23 UTC. Les cases absentes de la carte valent zéro.
- Durée active/session : somme des deltas d'engagement reçus pendant la fenêtre, divisée par ses sessions actives. Le delta final est attribué au moment de sa réception ; autour de minuit, quelques secondes de la fenêtre précédente peuvent ainsi être attribuées à la suivante. Plafond technique de 24 h actives pour une ouverture de page.
- Durée active/vue : pour chaque route, moyenne du temps actif reçu dans la fenêtre pour les vues de cette route ouvertes dans la fenêtre. Une page ouverte avant celle-ci peut contribuer à la durée de session sans apparaître comme une nouvelle vue dans le classement.
- Session engagée : au moins deux vues, dix secondes actives ou une conversion dans la fenêtre. Rebond = part des autres sessions. Tous les taux sont sur l'échelle 0–100 ; un dénominateur nul donne zéro.
- Conversion : session avec au moins `signup` ou `access_request` dans la fenêtre. Plusieurs conversions dans une session ne gonflent pas le total. `login` et `pricing_view` restent des objectifs observés, mais ne sont pas des conversions.
- Sources/campagnes : attribution au premier accès de la session ; la navigation interne ne réattribue pas les visites.
- Retour : visiteur de la période ayant au moins une vue antérieure au début de cette période dans l'historique encore conservé. Cet indicateur ne peut connaître les visites refusées, expirées ou antérieures au déploiement.
- Sorties : vues qui sont actuellement la dernière page connue de leur session. Elles sont provisoires pour une session encore active et ne prouvent pas un abandon définitif.
- Temps réel : activité reçue dans les cinq dernières minutes ; les onglets masqués n'envoient plus de heartbeat. Il s'agit d'une fenêtre récente, pas d'un compteur instantané de personnes présentes. Le bloc respecte appareil/source mais pas la longueur de période choisie.

## Vérification

`src/__tests__/audience-server.test.ts` exécute les endpoints et la migration dans PGlite : choix absent, reçus falsifiés/expirés, retrait avant une requête en attente, arrêt local hors ligne, limites, données interdites, déduplication, session expirée, bot/admin, filtres et conversions, minuit UTC, périodes vides, rétention. Le flux complet du dépôt reste `npm run verify`.
