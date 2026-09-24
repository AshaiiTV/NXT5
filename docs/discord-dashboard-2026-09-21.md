# Bot Discord : installation guidée et dashboard d’équipe

Date : 21 septembre 2026. Évolution demandée à partir de la version du site au commit `5d55dae`.

> Ce rapport décrit le parcours vérifié le 21 septembre. Dans ce checkout, la refonte du 23 septembre réunit **Inviter** et **Relier** dans « Connecter le serveur », puis guide vers « Choisir les salons » et « Tester et activer ». Après l’installation, elle ouvre une synthèse compacte avec des accès séparés aux salons, aux rôles dans « Accès », à l’activité et à l’aide. Voir la [charte graphique actuelle](../../../2026-05-05/utilise-github-pour-examiner-mes-pr/NXT5/docs/charte-graphique.md) et le [guide d’exploitation](discord-operations.md).

## Objectif

La page **Bot Discord**, accessible depuis l’espace équipe à `/bot-discord`, réunit l’installation du bot partagé NXT5 et sa gestion quotidienne. Chaque équipe choisit son serveur et ses salons. Le parcours conserve l’identité et les composants NXT5 décrits dans la [charte graphique 1.25](../../../2026-05-05/utilise-github-pour-examiner-mes-pr/NXT5/docs/charte-graphique.md).

## Parcours d’installation

| Étape | Action et preuve attendue |
| --- | --- |
| Inviter le bot | Ouvrir l’autorisation Discord et choisir le serveur. Ouvrir le lien ne suffit pas à valider l’installation. |
| Relier l’équipe | Générer un code temporaire, copier la commande `/nxt connecter`, l’utiliser sur le serveur et vérifier la liaison. Le statut dépend de la connexion enregistrée côté serveur. |
| Choisir les salons | Sélectionner les destinations accessibles, les catégories et les options, puis enregistrer. Les modifications en cours restent distinctes de la configuration enregistrée. |
| Vérifier et activer | Déclencher explicitement un message de test avec un visuel fictif, vérifier son résultat, puis activer la diffusion automatique. |

Le code est à usage unique, limité dans le temps et renouvelable. « Copier la commande » fournit la commande complète `/nxt connecter code:…`. Après sa création, la page vérifie la liaison toutes les cinq secondes pendant deux minutes ; une vérification manuelle et au retour sur l’onglet reste disponible ensuite. Un code expiré ne peut plus être copié depuis ce contrôle.

Une nouvelle équipe active entraîne le rechargement de son propre contexte ; les informations de l’équipe précédente ne doivent pas apparaître comme celles de la nouvelle. Le rafraîchissement de l’état conserve les modifications de destinations non enregistrées et bloque le test et l’activation tant qu’elles ne sont pas sauvegardées.

## Gestion après connexion

Le dashboard conserve l’équipe et le serveur reliés, l’état de diffusion, les destinations, la dernière publication confirmée et l’historique. Les actions de pause, de reprise, de vérification et de déconnexion restent accessibles. Le tutoriel est conservé dans « Aide à la connexion · revoir les 4 étapes » après l’installation. « Aide et résolution des problèmes » regroupe les permissions à vérifier, la visibilité des messages et les publications incertaines.

Les propriétaires et capitaines gèrent la connexion et les destinations. Les permissions NXT5 et Discord continuent de s’appliquer côté serveur ; masquer un contrôle dans l’interface ne remplace pas ces contrôles. Les messages publiés sont lisibles par les membres du salon, même s’ils n’ont pas de compte NXT5. Les liens de game conservent les droits NXT5.

La configuration prend en charge une équipe reliée à un serveur et jusqu’à dix destinations par équipe. Les mentions et les pistes de review sont désactivées par défaut. Le PNG reste factuel et utilise le rendu commun aux exports du site et du bot.

## Publication de test

Le test d’installation utilise des données fictives identifiées comme telles, sans lecture des games de l’équipe ni mention de rôle. Son message et son PNG permettent de contrôler les permissions d’envoi, l’intégration du visuel et la destination choisie.

L’ouverture de la page, l’invitation, la vérification de connexion et l’enregistrement des réglages ne déclenchent aucun message de test. L’envoi demande un clic explicite sur son action dédiée. L’activation automatique est une action distincte.

Un résultat incertain doit rester visible comme tel ; l’interface ne présente pas un renvoi comme anodin lorsqu’un premier message a peut-être été créé. Le suivi du test reste distinct de l’historique des publications de vraies games.

Dans le dashboard, la première activation attend un test confirmé pour le serveur, la version de configuration et une destination enregistrée courants. « Activer la diffusion » ouvre le récapitulatif du serveur, des salons, des catégories, des mentions et de la visibilité du contenu ; « Confirmer l’activation » applique le choix. Les anciennes games ne sont pas republiées automatiquement. Une équipe déjà activée peut reprendre ses envois avec le même récapitulatif, sans recommencer toute l’installation. Les commandes Discord existantes restent disponibles : le reçu de test est une condition du parcours guidé, pas une obligation générale de l’API de reprise.

Le serveur vérifie et applique l’activation sur l’identifiant du serveur et la version de configuration présentés dans le récapitulatif. Si la connexion ou les destinations changent entre-temps, l’activation est refusée et demande une actualisation. L’interface attend que la connexion et les destinations chargées correspondent à cette même version avant d’autoriser la confirmation. Un test d’un ancien serveur ne valide pas la nouvelle connexion ; les tests en attente restent récupérables par salon après un rechargement, sans renvoi aveugle.

## Présentation et accessibilité

- Navigation visible sur ordinateur et mobile, avec un accès depuis Gestion équipe vers la même page.
- `PageHeader`, `Surface`, contrôles partagés et palette nuit/cyan/violet/fuchsia.
- Parcours compact, titres et séparateurs sobres, sans accumulation de panneaux décoratifs.
- Boutons de 2 px de rayon, cibles tactiles de 44 px minimum, champs à 16 px sur mobile et focus visible.
- Commandes, noms de salons, erreurs et actions capables de revenir à la ligne sans débordement horizontal global.
- États chargement, erreur, absence de connexion, code expiré, permissions insuffisantes et diffusion en pause explicités par du texte.

## Vérification de livraison

| Contrôle | Résultat |
| --- | --- |
| Interface Discord | 36 tests ciblés réussis : installation, isolation par équipe, validité du test, refus et réponses perdues, reprise, brouillons, configuration modifiée et tests en attente par salon. |
| API Discord | 102 tests ciblés réussis : autorisations, test fictif, idempotence, configuration courante et concurrence. |
| Contrôle complet final | `netlify build --offline --context deploy-preview` réussi, incluant `npm run verify` : 1 261 tests dans 75 suites, contrôle TypeScript et build. |
| Archives des fonctions | Quatre archives de rendu vérifiées : Node 24, moteur natif Linux x64, quatre fontes Inter et wordmark. Le [contrôle des bundles](../artifacts/discord-render/bundle-check.json) détaille les fonctions concernées. |
| Dépendances | `npm audit` : aucune vulnérabilité signalée. |
| Parcours navigateur | 29 vues contrôlées à 360, 390, 768, 1 024 et 1 440 px. Cinq parcours complets utilisent des réponses simulées : invitation, code de liaison, destination enregistrée, test fictif, activation explicite et pause. Quatre vues mobiles supplémentaires couvrent erreur, suspension globale, absence d’équipe et rôle joueur. |
| Responsive et accessibilité | Aucun débordement horizontal ni erreur console dans ces parcours. Ouverture et fermeture du menu mobile vérifiées. Focus clavier visible de 2 px, contrôle vérifié à 44 px minimum et mouvement réduit contrôlé. |
| Documentation | Liens locaux de la charte et de ce rapport résolus ; `git diff --check` sans erreur. |
| Charte PDF 1.25 | 24 pages régénérées avec `tools/render-charte-graphique.py`, rendues avec Poppler et inspectées. Version, en-têtes, pagination et marges vérifiés ; aucun débordement ni chevauchement repéré. La nouvelle section occupe les pages 13 et 14. |

Le [relevé navigateur](../artifacts/discord-dashboard/browser-verification.json) consigne les largeurs du viewport et du document, chaque étape exécutée et l’absence d’erreur console. Les captures ci-dessous ont été relues sur ordinateur et mobile : les libellés, champs et actions restent lisibles, le récapitulatif d’activation est complet et l’erreur de connexion est explicite. Le visuel de test porte clairement la mention de données fictives.

| Écran | Captures retenues |
| --- | --- |
| Installation | [Ordinateur, 1 440 px](../artifacts/discord-dashboard/installation-1440.png) · [Mobile, 360 px](../artifacts/discord-dashboard/installation-360.png) |
| Dashboard connecté | [Ordinateur, 1 440 px](../artifacts/discord-dashboard/dashboard-1440.png) · [Mobile, 390 px](../artifacts/discord-dashboard/dashboard-390.png) |
| Confirmation d’activation | [Mobile, 360 px](../artifacts/discord-dashboard/activation-360.png) |
| Connexion à vérifier | [Mobile, 390 px](../artifacts/discord-dashboard/error-390.png) |
| PNG du test | [Exemple fictif](../artifacts/discord-dashboard/synthetic-preview.png) |

Les parcours navigateur utilisent des données et réponses simulées : ils n’ont envoyé aucun message réel sur Discord. Ces résultats n’attestent pas à eux seuls un déploiement ni un premier envoi sur le serveur réel d’une équipe.

## Première utilisation réelle

Les données fictives et les tests automatisés ne remplacent pas le premier parcours d’une équipe réelle : invitation sur son serveur, liaison, choix du salon, clic sur le test, activation, puis import d’une game pour vérifier le premier export réel et son lien. Aucun message réel n’est envoyé par la seule préparation de cette évolution.

Le détail des actions d’exploitation, des suspensions et de la résolution des envois incertains reste dans [Discord : exploitation et configuration](discord-operations.md).
