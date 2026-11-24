# Audit public de nxt5.org — 23 novembre 2026

Audit réalisé sans compte sur la production (navigateur desktop et mobile 375 px, sondes HTTP,
lecture du code sur `origin/main` 4822726). Les corrections sont réparties en cinq PR.

## Constats et lots de correction

| Lot | Gravité | Constat | Branche |
|---|---|---|---|
| 1 | Critique | `riot-match-export` consommait la clé Riot sans session ; une requête `fallback=1` pouvait coûter jusqu'à 8 appels Riot pour 1 unité de limite ; `RIOT_EXPORT_TOKEN` vide en production ; message « autorisÃ© » mal encodé | `claude/riot-export-auth-20261123` |
| 2 | Important | Accueil : LCP ≈ 3,2 s, `vendor-three` 172 Ko gzip chargé dès le héros | `claude/home-perf-20261123` |
| 3 | Moyen | Démo : URL figée sur `/demo` (Retour quitte la démo), analyse limitée à l'écart d'or final | `claude/demo-urls-20261123` |
| 4 | Moyen | Interrupteur « Rester connecté » sans nom accessible et activé par défaut, titre transitoire sur `/creer-un-compte`, décalage des boutons sociaux, `<h2>` vide, CTA mobile sous la ligne de flottaison | `claude/a11y-auth-20261123` |
| 5 | Faible | `DISCORD_FAILED` renvoyé pour une session absente, 404 HTML sur `access-requests`, 401 `auth-me` dans la console des visiteurs, HSTS sans `includeSubDomains` | `claude/api-coherence-20261123` |

## Lot 1 — choix retenu

NXT5 Importer (application desktop publique) appelle `riot-match-export` sans session ni jeton :
exiger une session casserait les versions installées, et un jeton embarqué dans l'application ne serait pas secret.
La route reste donc publique, mais chaque appel Riot est désormais facturé :

- par IP : 12 requêtes/min et 16 appels Riot/min (chaque région essayée compte) ;
- pour toute la plateforme : `RIOT_EXPORT_HOURLY_LIMIT` appels Riot/heure (défaut 1500), réponse 429 `NXT5_EXPORT_BUSY` au-delà ;
- le Game ID est validé avant toute consommation de budget ;
- `RIOT_EXPORT_TOKEN`, s'il est défini, n'est plus accepté dans l'URL (journaux d'accès).

Piste ultérieure : faire porter à l'Importer une session NXT5 (lien de connexion de l'application) pour réserver l'export aux comptes.

## Points solides relevés

CSP stricte, X-Frame-Options, COOP/CORP, Permissions-Policy ; origine vérifiée sur les mutations ;
endpoints d'administration en 401 ; proxy d'assets limité aux hôtes autorisés ; refus des cookies respecté ;
robots.txt, sitemap, security.txt, canonical/OG complets ; pas de défilement horizontal mobile.
