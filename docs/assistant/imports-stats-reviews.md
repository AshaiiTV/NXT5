# Games, statistiques et reviews

## Importer une game

1. Ouvrir Games (`/games`), puis « Importer une game ».
2. Télécharger la dernière version de NXT5 Importer pour Windows 64 bits, Mac Apple Silicon ou Mac Intel, puis exporter la game depuis le client League sur son ordinateur.
3. Choisir « Importer un JSON », charger le fichier, nommer la game et choisir ses catégories.
4. Choisir le côté de notre équipe, confirmer les cinq postes alliés et associer un profil NXT5 distinct à chaque poste.
5. Vérifier les postes des cinq champions adverses, puis cliquer sur « Confirmer l’import ».

Les postes adverses sont modifiables : choisir un poste déjà occupé échange les postes des deux champions concernés. Les cinq postes des deux équipes et les cinq profils alliés doivent être renseignés avant la validation.

Le libellé du filtre est « Catégorie ». Les anciennes adresses `/integration` et `/statistiques` renvoient désormais vers Games.

### Première ouverture de NXT5 Importer

Le téléchargement propose une aide dédiée ; elle reste accessible avec « Aide à l’ouverture sur Windows et Mac ».

- Sur Windows, si le message est « Windows a protégé votre ordinateur », ouvrir « Informations complémentaires », vérifier que le fichier téléchargé depuis NXT5 correspond à NXT5 Importer, puis choisir « Exécuter quand même » si le bouton est proposé.
- Sur Mac, extraire le ZIP et ouvrir NXT5 Importer. La version Mac n’est pas encore notarisée par Apple. Si l’alerte indique qu’Apple ne peut pas vérifier l’app, fermer le message, aller dans Réglages Système → Confidentialité et sécurité, puis choisir « Ouvrir quand même » et confirmer.

Ces étapes concernent uniquement le fichier téléchargé depuis NXT5 et ces messages précis. En cas de menace identifiée, d’application signalée comme endommagée, de message différent ou de bouton absent, contacter NXT5 depuis `/reseaux#contact` avec le système, le nom du fichier et le texte exact de l’alerte. Garder l’antivirus et les protections du système activés.

## Corriger une game importée

Ouvrir la game dans Games, puis ses options :

- « Modifier les informations » change le nom et les catégories.
- « Corriger les rôles et profils » corrige les postes des deux équipes et les profils alliés.
- « Changer le côté de notre équipe » corrige une inversion Blue Side / Red Side après l’import.

Pour changer de côté, sélectionner le côté où jouent les champions de l’équipe et vérifier les cinq profils associés, tous distincts. Si les cinq postes de ce côté sont incomplets, les corriger d’abord dans « Corriger les rôles et profils ». Le résultat et les statistiques sont recalculés ; les notes de review sont conservées. Les statistiques, Tendances et profils utilisent les assignations corrigées.

## Lire les statistiques

Games permet de rechercher une game et d’ouvrir directement ses statistiques : les deux sides, les rôles à 10 et 20 minutes, le KDA, la participation aux kills, le farm, l’or, la vision, les builds, les objectifs et la timeline. L’onglet « Groupes » réunit les games d’un même scrim, bloc ou tournoi ; « Créer un groupe » permet de les sélectionner et de nommer le groupe.

CS10 et CS20 indiquent le farm du joueur. DIFF10 et DIFF20 comparent ce farm à l'adversaire du même rôle. Cette lecture doit être rapprochée de l'or, des morts et des objectifs.

Une timeline incomplète ne prouve pas l’absence d’événements. Réexporter la game avec un Importer récent peut compléter les données ; si elles restent absentes, les statistiques finales peuvent être disponibles sans tous les timings.

## Exporter ou partager les statistiques

Depuis une game ouverte, « Exporter PNG » télécharge ses statistiques. Depuis un groupe ouvert, « Exporter le groupe PNG » exporte la sélection du groupe. Même si le rapport comprend plusieurs sections, le résultat est une seule image PNG, sans archive ZIP.

Le bouton « Publier sur Discord » apparaît dans les statistiques d’une game pour les membres autorisés lorsque la connexion du bot et au moins une destination de publication sont configurées. Choisir la destination, préparer l’aperçu puis confirmer la publication ; le bouton n’est pas un export PNG local.

## Créer une review

Depuis une game, utiliser « Créer une review » ou « Ouvrir la review » si elle existe déjà. La bibliothèque Review (`/rapports`) permet aussi de créer une review et de sélectionner ses games, notamment celles d’un groupe. Games → Groupes → Créer un groupe prépare également la review du groupe ; la liste principale des games ouvre une game à la fois.

L’analyse complète est préparée automatiquement à l’ouverture et dans l’aperçu de création : verdict, cause à vérifier, checkpoints VOD, lecture par joueur, weakside/strongside, plan d’exécution et validation. Les groupes donnent aussi le détail de chaque game. Les propositions doivent être vérifiées dans les games sources.

Les données complètes des games liées sont chargées automatiquement, y compris les games anciennes hors de la liste visible. Un chargement incomplet affiche son état et permet de réessayer ; le contenu enregistré reste lisible. Les timings absents ne sont pas présentés comme une absence de morts.

Le staff peut compléter les notes sans modifier le bloc automatique. Les modèles « Verdict », « Cause racine », « VOD », « Joueur », « Plan », « Validation » et « Draft » facilitent cette saisie. Les notes et les corrections des anciennes reviews sont conservées ; choisir d'autres games actualise l'aperçu sans remplacer la saisie. Une review avec des games liées peut être enregistrée sans note supplémentaire, après le chargement complet. Elle peut contenir jusqu'à 20 games. Les games liées restent les sources de preuve et peuvent être rouvertes depuis la review.

La bibliothèque de `/rapports` permet de rechercher, filtrer, ouvrir, modifier ou supprimer une review selon les permissions du membre.

Supprimer la game principale d’une review peut supprimer cette review et ses notes, même si elle contient d’autres games. Supprimer une autre source la retire de la sélection. Pour corriger un import, utiliser ses options de correction au lieu de supprimer la game.
