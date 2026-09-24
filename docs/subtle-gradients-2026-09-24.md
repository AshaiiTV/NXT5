# Contrôle des accents colorés — 24 septembre 2026

La passe ajoute de légers dégradés cyan, pervenche, violet et fuchsia aux repères de navigation, aux séparateurs d’en-têtes et à quelques accents d’accueil. La [charte canonique](../../../2026-05-05/utilise-github-pour-examiner-mes-pr/NXT5/docs/charte-graphique.md) reste l’unique référence graphique.

## Rendu et interactions

- **35 scénarios Chromium** : accueil, équipe, analyses, profil, planning, connexion et administration/exports à **360, 390, 768, 1024 et 1440 px**, avec mouvement réduit et rendu complet. Aucune erreur JavaScript non interceptée ni débordement horizontal détecté. Les polices Inter locales ont été chargées et leur état vérifié.
- **8 scénarios supplémentaires** : accueil, équipe, analyses et connexion à 390 et 1440 px, mode performance activé et préférence de mouvement normale. Les accents statiques restent lisibles.
- Inspection des captures desktop/mobile, des en-têtes, des sélections et des couleurs de données. Le halo d’aperçu a été recentré après contrôle pour fondre ses bords dans le fond ; accueil et CTA final recapturés.
- Activation au clavier des onglets Parties/Groupes, Analyses et Profil, maintien du focus, sidebar réduite à 80 px, ouverture/fermeture du menu mobile et retour du focus contrôlés.

Les captures avant utilisent le code de `HEAD` archivé séparément ; elles couvrent accueil, équipe et analyses à 390 et 1440 px. Le harness temporaire monte le vrai `App.jsx`, avec session et données fictives, intercepte les requêtes et refuse les mutations. Il ne fait pas partie du produit. Les artefacts de contrôle local se trouvent dans `artifacts/subtle-gradients/`.

## Contraste

Calcul sRGB sur 2 001 points par dégradé. Le fond conservateur cumule les maxima des deux lueurs ambiantes puis le dégradé de sélection, ce qui surestime leur superposition réelle. Bornes mesurées :

| Élément | Contraste minimal calculé |
| --- | ---: |
| Titre de navigation actif | 12,21:1 |
| Description de navigation active | 8,69:1 |
| Texte des onglets partagés | 11,62:1 |
| Texte secondaire sur sélection | 8,00:1 |
| Description atténuée sur sélection | 5,53:1 |
| Dégradé clair du titre d’accueil/connexion | 8,33:1 |
| Texte sombre du CTA principal, inchangé | 5,00:1 |

Ces calculs portent sur les tokens et leur composition CSS, pas sur chaque pixel anticrénelé ni sur tous les écrans du site.

## Vérification du dépôt et limites

`typecheck` et build réussis. La suite couvre 109 fichiers et 1 850 tests : 106 fichiers réussis lors du premier passage, avec 23 dépassements du délai de 5 secondes dans trois suites de base de données sous concurrence. Ces trois suites relancées avec `--maxWorkers=1` passent leurs 76 tests. Ce résultat ne signifie pas que le premier passage complet était entièrement vert.

La vérification est locale et synthétique, sans validation du backend ni déploiement de production. Les ressources distantes sont bloquées dans le navigateur de contrôle : certains portraits et aperçus d’exports montrent leur repli prévu. Ce contrôle de présentation ne certifie pas leur génération réelle ni l’ensemble des parcours fonctionnels.
