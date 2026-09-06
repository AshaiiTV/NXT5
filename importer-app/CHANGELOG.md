# NXT5 Importer 0.3.0

![Nouvelle interface de NXT5 Importer](docs/images/exporter.png)

*Aperçu de l’interface, avec un client LoL simulé pour la vérification.*

## Interface

- Nouvel espace desktop sombre avec navigation Exporter, Exports récents et Paramètres.
- État du client LoL, instructions contextuelles, validation du Game ID et reconnaissance de région.
- Progression par étape, annulation des requêtes et confirmation détaillée du fichier enregistré.
- Historique local de 30 exports avec recherche, accès au fichier et réexport.
- Adaptation aux petites fenêtres, navigation clavier, annonces accessibles et respect des préférences de réduction des animations.

## Fiabilité

- Vérification de l’identité du match et de sa région avant tout enregistrement, sans recherche silencieuse sur un autre serveur.
- Repli vers le client local pour les IDs complets et numériques ; chemin personnalisé via sélecteur natif.
- Délais maximaux, requêtes annulables, catalogue champions mutualisé et dégradation contrôlée hors ligne.
- Correction des défaites représentées en texte, des rôles support et des statistiques locales conservées.
- Timeline facultative, contrôlée et enregistrée une seule fois ; jalons non observés laissés absents.
- Écriture atomique des fichiers et préférences ; limite de taille compatible avec l’import du site.
- Un export à la fois, validation des échanges entre interface et moteur et ouverture limitée aux liens autorisés/fichiers de l’historique.

## Distribution

- Version installée lisible hors ligne, état de vérification de mise à jour distinct.
- Téléchargements Windows, Mac Intel et Mac Apple Silicon ; sélection exacte de la version et de l’architecture.
- Tests desktop obligatoires avant compilation dans GitHub Actions.

Les essais automatisés utilisent des services Riot/NXT5 et un client LoL simulés. Une partie réelle avec un client Riot connecté reste à vérifier manuellement sur Windows et macOS.
