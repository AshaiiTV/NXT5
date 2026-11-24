# Démarrage guidé — 6 octobre 2026

Le nouvel accueil donne un point de départ explicite aux personnes qui ne savent pas quelle rubrique ouvrir. Le parcours remplace le panneau de démarrage répété au-dessus des pages de travail.

## Parcours

- Sans équipe : choisir « Créer mon équipe » ou « Rejoindre mon équipe », puis afficher uniquement le formulaire utile. Les invitations préremplissent le formulaire de connexion à l’équipe. Les champs sont conservés lors d’un retour au choix.
- Responsable ou staff : importer une première partie, ouvrir son résumé, enregistrer un premier débrief. Il n’est plus nécessaire de créer cinq joueurs ni d’importer trois parties avant de commencer.
- Joueur : découvrir son profil relié, enregistrer ses disponibilités, ouvrir une partie ou un débrief de l’équipe. Si le profil n’est pas encore relié, expliquer l’intervention attendue du responsable et proposer de voir l’équipe.
- Une seule action principale est présentée à chaque étape. Les étapes suivantes restent visibles dans une progression compacte.
- « Explorer librement » permet de sortir du parcours. L’accueil propose alors les raccourcis utiles et « Reprendre le démarrage » tant que le parcours reste incomplet.

La destination par défaut après connexion ou inscription est `/accueil`. Les destinations internes explicites et les invitations sont conservées. Les règles de vérification du compte et d’accès à l’équipe continuent de s’appliquer.

## Navigation et aide

Accueil, Équipe, Parties, Planning et Mon profil sont les entrées quotidiennes. Les autres outils sont regroupés sous « Préparation et partage », ouvert automatiquement lorsqu’une de ses rubriques est active. Le guide est disponible dans la navigation, via le bouton d’aide supérieur et directement à la section pertinente depuis l’étape en cours.

Les pages de travail conservent un retour discret vers l’accueil pendant le démarrage. Le bouton flottant de l’assistant n’occupe pas l’accueil ni le premier choix d’équipe, pour laisser l’action principale dégagée sur mobile.

## État et données

Les parties, débriefs, profils et disponibilités viennent des données de l’équipe active. Les ouvertures personnelles du résumé, du profil et du débrief ainsi que la préférence de masquage sont conservées localement sous `nxt5_start_v2:<compte>:<équipe>`. Ces préférences ne modifient aucune donnée métier et ne sont pas synchronisées entre navigateurs. L’interface reste utilisable si le stockage local est indisponible.

Un changement de compte ou d’équipe utilise un autre état personnel. Une équipe déjà active ne masque donc pas les premiers repères d’un nouveau joueur. Les visites ne sont comptées que pour des destinations appartenant réellement à l’équipe active.

## Vérification

- `npm run verify` : typage, 158 fichiers de tests / 2 790 tests réussis, compilation et contrôles SEO réussis.
- Contrôle visuel local avec données fictives, de 320 à 1 440 pixels : accueil responsable, accueil joueur, choix initial et formulaire d’invitation. Aucun débordement horizontal sur l’accueil.
- Parcours navigateur : création d’équipe, ouverture de l’import, invitation invalide puis valide, sortie/reprise après rechargement, ouverture du profil et aide ciblée vers le planning.
- Les tests couvrent également l’isolation des comptes/équipes, les droits, les profils non reliés, la conservation des champs, les créations partielles et les redirections après authentification.

Les essais navigateur utilisent un serveur local et des données fictives. Cette intervention ne publie pas le site et ne modifie pas d’équipe réelle.
