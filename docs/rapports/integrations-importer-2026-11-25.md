# Export et liaison de l’Importer 0.5.2

L’accueil présente le formulaire d’export sous la photographie Monolithe. Le raccourci de collecte utilise le nom de l’équipe liée et l’état de la collecte. La page Collecte réunit le client LoL, le poste enregistré et l’équipe de destination. L’historique indique le nombre de fichiers disponibles et de résultats pendant la recherche.

## Passer de l’application au site

- « Parties sur NXT5 » ouvre la bibliothèque des parties.
- « Importer dans NXT5 » ouvre la fenêtre d’import après l’enregistrement du JSON. Une personne habilitée choisit le fichier dans le navigateur. Le joueur en lecture seule retrouve les informations de collecte de son équipe. Un compte sans équipe accède à l’écran de création ou d’adhésion.
- « Obtenir un code sur NXT5 » ouvre le volet de liaison déplié. Un membre habilité choisit de générer le code à usage unique. Si une connexion est nécessaire, le site restitue la destination demandée.

## Vérification

Le scénario Electron intercepte les trois ouvertures de navigateur et vérifie les adresses transmises par le processus principal. Les tests du routeur couvrent le retour de connexion, l’ouverture sur le bon volet et la lecture seule. Le rendu du formulaire, du résultat, de la collecte et des réglages est contrôlé aux deux tailles natives de 1 180 × 800 et 820 × 620, avec un client et des parties de test. Le formulaire et ses commandes ont aussi été examinés sur une largeur CSS de 390 px.
