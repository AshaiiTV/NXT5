# Enseignements des trois Reels pour NXT5

Analyse du **15 octobre 2026**. Les références apportent trois pistes utiles : conserver une mémoire de projet sélective, éprouver la fiabilité des opérations et relier les obligations juridiques au fonctionnement réel du service. NXT5 dispose déjà de guides et d’audits sur ces sujets ; les enseignements retenus complètent cette base.

Les légendes et des passages visuels des trois Reels ont été consultés dans Instagram. L’audio des deux vidéos parlées n’a pas été transcrit ; leurs propos ne sont donc pas restitués intégralement. Les durées ci-dessous viennent du lecteur. Les vérifications techniques et juridiques de cette lecture initiale s’appuient sur les sources primaires liées ; la comparaison avec NXT5 portait alors sur sa documentation. Le suivi du même jour, présenté plus bas, distingue les contrôles du code et de la production ainsi que les correctifs publiés.

## Abdechan et la mémoire des assistants IA

Source : [Reel de its.abdechan](https://www.instagram.com/its.abdechan/reel/DeSGYB_uJmn/), environ **38 secondes**.

Les images montrent un présentateur devant un post annonçant une mémoire persistante pour Claude Code, puis un README présentant conservation du contexte, recherche progressive, interface de consultation et exclusions privées. Le post affiché annonce notamment 95 % de tokens en moins ; la légende promeut une agence IA avec un objectif de 30 k par mois. Ces annonces ne fournissent pas de mesure applicable à NXT5.

La liste de fonctionnalités correspond à [Claude-Mem](https://github.com/thedotmack/claude-mem#readme). Le projet capture des observations, les résume et les retrouve pour de futures sessions. Son parcours de recherche commence par un index compact, puis charge le contexte et les détails utiles. Son [architecture](https://docs.claude-mem.ai/architecture/overview) associe notamment hooks, worker et stockage SQLite. Le stockage local ne garantit pas un traitement entièrement local : la synthèse dépend du fournisseur IA configuré. Les [balises privées](https://docs.claude-mem.ai/usage/private-tags) excluent des éléments de la mémoire, sans les soustraire au modèle qui traite la conversation.

**Choix NXT5 retenu :** conserver dans les guides existants les décisions durables, leur raison et leurs preuves ; rechercher dans le sommaire ou le graphe avant de charger des fichiers entiers ; relire la source actuelle avant d’agir. Une note de reprise distingue travail réalisé, hypothèses et actions restantes. Les secrets et données privées ne deviennent pas une mémoire de projet.

L’ajout d’un service de mémoire ne répond pas encore à un manque démontré ici. Claude-Mem reste une option à évaluer si des pertes de contexte récurrentes justifient son coût, son traitement de données et sa maintenance. Sa documentation mentionne une [intégration Codex CLI](https://docs.claude-mem.ai/platform-integration#supported-harnesses) ; le fonctionnement dans notre application Windows n’a pas été validé. Aucune installation n’est effectuée dans ce travail.

## Nataindata et les exigences de mise en production

Source : [Reel de nataindata](https://www.instagram.com/nataindata/reel/DeeR2JyNrx-/), environ **17 secondes**.

Le format est un mème de bureau sur musique Macarena. Une accroche interpelle les personnes qui codent avec l’IA, puis des listes techniques défilent : limitations de requêtes, cache, déploiement, délais et reprises, idempotence, files de messages, SQL, concurrence, observabilité et sécurité. Docker, Kubernetes, sharding et réplication figurent aussi parmi les notions observées. Le Reel rappelle la complexité d’un service exploité ; il ne démontre ni leur implémentation ni leur nécessité pour un projet donné.

**Choix NXT5 retenu :** examiner les modes d’échec du parcours modifié. Une réponse correcte au premier essai ne couvre pas un double clic, une réponse perdue, une interruption, deux écritures concurrentes ou une révocation des droits pendant un appel externe.

| Sujet utile | Ce que les documents NXT5 établissent | Contrôle à conserver lors d’un changement concerné |
| --- | --- | --- |
| Quotas, cache et délais | L’[audit du 6 octobre](audit-general-2026-10-06.md) décrit quotas et budget de synchronisation Riot, fraîcheur des profils, verrou persistant et délais bornés. | Vérifier le périmètre du quota, la fraîcheur, l’expiration et l’isolation des réponses privées. |
| Permissions et concurrence | L’[audit du 6 octobre](audit-general-2026-10-06.md) décrit les contrôles d’accès et les opérations d’import et Discord ; [SECURITY.md](../SECURITY.md) fixe les garanties à vérifier lors de leur évolution. | Éprouver retrait de membre, rétrogradation ou changement de liaison pendant un traitement long ; vérifier l’annulation des écritures refusées. |
| Idempotence et reprises | La [préparation Shopify](shopify-et-checklist-juridique.md) prévoit un traitement idempotent des événements ; le [guide Discord](discord-operations.md) traite la reprise des publications. | Déterminer ce qui arrive après répétition ou interruption ; borner les tentatives et éviter de répéter aveuglément une action externe. |
| Requêtes et capacité | L’[audit du 6 octobre](audit-general-2026-10-06.md) rapporte une optimisation mesurée de la pagination, dans un périmètre local précis. | Mesurer la requête et le volume concernés avant d’ajouter cache, index ou infrastructure. |
| Sécurité, livraison et reprise | [SECURITY.md](../SECURITY.md) prévoit droits minimaux, secrets serveur, isolation des previews, vérification du commit livré, surveillance et restauration isolée. | Conserver les preuves datées de l’environnement réellement contrôlé ; distinguer correctif local, déploiement et restauration réussie. |

Cette lecture initiale des audits ne certifie pas la couverture actuelle de chaque scénario. Le suivi ci-dessous précise les contrôles et les corrections effectués ensuite. Le besoin de Kubernetes, de sharding ou d’une architecture distribuée doit découler d’une limite mesurée ou d’une fonction précise.

## Anthony Quinçon et la conformité du site

Source : [Reel d’anthonyquinchon](https://www.instagram.com/anthonyquinchon/reel/DecT65TuVtx/), environ **77 secondes**.

La légende propose une checklist juridique pour un site ou une application créés avec l’IA, puis un prompt obtenu par message après le commentaire LEGAL. Les images observées montrent une source CNIL, un formulaire dont plusieurs champs sont barrés et une maquette de mentions légales à compléter. La démonstration de réduction des données est utile ; une page générée ou un prompt ne prouve pas la conformité du service.

**Choix NXT5 retenu :** partir des flux réels et produire des constats vérifiables. Pour chaque collecte ou intégration modifiée, préciser données nécessaires, finalité, base légale, destinataires, conservation et exercice des droits ; examiner le comportement des traceurs avant de décider du consentement. Le [guide RGPD du développeur de la CNIL](https://www.cnil.fr/fr/guide-rgpd-du-developpeur) fournit le cadre de travail.

Les points suivants encadrent les raccourcis du Reel :

- Le [bilan CNIL du 6 juillet 2026](https://www.cnil.fr/fr/23-nouvelles-sanctions-simplifiees) rapporte 23 sanctions dans la procédure simplifiée depuis janvier, avec 133 750 € d’amendes cumulées et un plafond de 20 000 € par sanction simplifiée. Ce n’est ni un bilan des sites créés avec l’IA ni le plafond général des sanctions CNIL.
- Le consentement n’est pas la base légale de tous les formulaires. Le déterminer selon la finalité ; lorsqu’il est requis, il doit répondre à ses conditions propres. [Bases légales selon la CNIL](https://www.cnil.fr/fr/prendre-en-compte-les-bases-legales-dans-limplementation-technique).
- L’exemption de consentement d’un traceur dépend de son usage effectif ; certaines mesures d’audience peuvent aussi être exemptées sous conditions. [Règles de la CNIL](https://www.cnil.fr/fr/cookies-et-autres-traceurs/regles/cookies/que-dit-la-loi).
- Les alternatives des images dépendent de leur fonction : une image informative et une image décorative se traitent différemment. Vérifier aussi clavier, focus, noms accessibles et erreurs de formulaire. [Critères images du RGAA](https://accessibilite.numerique.gouv.fr/methode/criteres-et-tests/#1).

La [préparation juridique NXT5](shopify-et-checklist-juridique.md) prévoit déjà identité de l’exploitant, clientèle et pays servis, CGV distinctes des CGU, confidentialité, cookies, médiation, rétractation, résiliation et remboursements. Elle reste la référence à compléter selon l’offre réellement ouverte. La [validation commerciale](validation-commerciale.md) décrit les conditions de collecte et d’ouverture ; ses états datés doivent être revérifiés avant une vente. Cette analyse n’ajoute pas une seconde checklist juridique et ne valide pas les documents contractuels.

## Enseignements pour les contenus NXT5

Pour les prochains tutoriels de Parties, Débriefs ou draft, retenir quatre pistes à tester :

- Nommer immédiatement le problème du spectateur, puis montrer une preuve réelle et lisible. Le présentateur superposé à un document est une possibilité de mise en scène, sans obligation de face caméra.
- Faire évoluer un exemple avant/après, comme le formulaire simplifié d’Anthony, et afficher la source et sa date lorsqu’un fait externe soutient l’explication.
- Garder une seule idée expliquée dans un format court. La liste technique défilante de Nataindata est un effet de mème ; elle ne suffit pas à démontrer une méthode ou à expliquer une fonction NXT5.
- Proposer une ressource ou une prochaine action adaptée au besoin, sans reprendre automatiquement le mot-clé à commenter pour recevoir un message.

Ces observations ne permettent pas d’attribuer un effet sur la rétention ou les conversions. Les promesses de revenus, d’économies de tokens ou de conformité ne deviennent pas des accroches NXT5 sans preuve appropriée. Un commentaire demandant une ressource ne mesure ni sa consultation ni une conversion.

## Vérifications et corrections du 15 octobre 2026

Après cette lecture documentaire, le code courant et la production ont été contrôlés. La [PR #202](https://github.com/AshaiiTV/NXT5/pull/202), fusionnée et publiée le 15 octobre, corrige trois comportements : la session est revérifiée dans la transaction de changement d’e-mail ; un signal d’annulation reçu pendant un import est respecté avant l’écriture atomique ; un refus des statistiques reste prioritaire face à une acceptation tardive provenant d’un autre onglet. Une transaction d’import déjà commencée se termine de façon atomique ; la propagation d’une déconnexion du navigateur jusqu’au signal serveur n’est pas garantie par ce correctif.

La [validation CI](https://github.com/AshaiiTV/NXT5/actions/runs/38753384955) a réussi avec **4 297 tests**, ainsi que les contrôles de types et le build. Les **35 migrations attendues** ont été retrouvées en production avec des sommes de contrôle conformes. Les contrôles HTTP et le rendu publié sur ordinateur et mobile ont également été vérifiés. Cette couverture ne vaut pas validation de tous les parcours du service ni preuve de conformité juridique.

Les secrets de production concernés ont été réservés au contexte de production dans Netlify, et la branche de production de la base a été protégée contre les opérations destructrices prévues par ce réglage. Aucun test de restauration n’a été effectué ; la capacité de restauration effective reste donc non vérifiée.

Le nettoyage des anciens aperçus Netlify a ensuite supprimé **312 aperçus historiques** et leurs fonctions. Les **823 contrôles HTTP** de leurs anciennes adresses ont retourné 404 ; **sept aperçus récents sans secrets de production** ont été conservés. Le déploiement publié et son empreinte HTML sont restés identiques pendant ce nettoyage. Ces constats portent sur les adresses et les déploiements contrôlés le 15 octobre.

## Intégration au projet

Les consignes de mémoire sélective et de vérifications adaptées au parcours sont ajoutées à [AGENTS.md](../AGENTS.md). Les guides techniques et juridiques existants conservent leur rôle. Les pistes de présentation restent dans ce rapport ; aucun gain de performance, de conformité ou d’audience n’est attribué à leur ajout documentaire.
