# NXT5 - Charte graphique et consignes pour l’IA

Version 1.9 · 8 septembre 2026 · Base initiale : commit `9aeb1c0`, complétée par les évolutions de la zone de téléchargement, du bloc Objectifs, du chargement, des games importées, du favicon de chargement et de l’historique des imports. Audit transversal de cohérence réalisé sur un checkout issu de `816e3cc`, puis consolidé avec les évolutions de `e102e66`. Après les corrections de contraste, de densité et de contrôles partagés, cette version unifie Importations et Statistiques dans Games, avec une gestion discrète à la demande ; elle conserve les règles précédentes non contredites par cette évolution.

Ce document est la référence visuelle du **site web NXT5** pour toute création ou modification d’interface. Il décrit les styles existants et fixe des règles de continuité. Les valeurs signalées comme « objectifs » sont des critères pour les prochains travaux, pas une certification de l’existant. Le PDF est une synthèse visuelle ; ce Markdown est la version complète à lire par l’IA.

## 1. Instruction permanente pour l’IA

Avant toute intervention visuelle sur NXT5, lire cette charte, puis les composants et styles concernés dans le checkout utilisé. Réutiliser le système existant. Conserver l’identité, la hiérarchie, les comportements responsive et les états des composants. Si une demande explicite de l’utilisateur fait évoluer cette identité, appliquer sa demande et mettre à jour la charte dans le même travail. Une incohérence historique du CSS n’est pas une raison pour bloquer une modification courante : vérifier le rendu et choisir la solution cohérente avec cette référence.

Cette charte concerne le site. NXT5 Importer partage la marque, mais possède son propre CSS : ne pas lui appliquer automatiquement les règles de mise en page du web.

## 2. Identité et direction artistique

**Un centre de travail pour les équipes League of Legends : technique, immersif, structuré et lisible.** Les données aident le staff à préparer le draft, suivre les games et organiser la review. La décoration soutient ce travail.

- Fond bleu nuit presque noir ; surfaces bleu ardoise superposées.
- Cyan lumineux comme accent principal ; violet et fuchsia en accompagnement.
- Logo esport existant, titres puissants et textes secondaires très clairs.
- Panneaux arrondis, bordures fines et profondeur discrète.
- Dégradés et halos concentrés sur la marque, les titres et les actions principales.

| Contexte | Traitement à conserver |
| --- | --- |
| Accueil, présentation | Grand logo, titre fort, quelques mots accentués, fond lumineux et composition aérée. |
| Tableaux de bord, statistiques, review | Densité maîtrisée, contenus alignés, surfaces calmes, chiffres lisibles. Réutiliser `nxt5-data-dense` là où ce mode existe. |
| Formulaires, réglages, compte | Même palette et mêmes contrôles ; labels explicites, aide lisible et états visibles. |
| Chargement | Un seul écran partagé couvre ouverture de l’application, connexion et synchronisation. La composition « Cinq rôles. Une même direction. » cède immédiatement la place au contenu prêt. |

Éviter les fonds blancs par défaut, les nouveaux thèmes orange/vert, les cartes toutes lumineuses, les effets 3D sur les données et les grandes illustrations qui repoussent les informations utiles.

### Écran de chargement unique

Évolution autorisée le 8 septembre 2026 : `AppLoadingScreen` remplace les deux écrans successifs par une seule composition, partagée entre le chargement du module, la vérification de session et le chargement initial des données. Les étapes affichées sont « Ouverture », « Connexion » et « Synchronisation » ; seule l’information d’état évolue.

- La composition repose sur le titre « Cinq rôles. Une même direction. », un texte court et cinq signaux SVG TOP / JGL / MID / ADC / SUP qui convergent vers le favicon complet du site (`public/assets/nxt5-loader-favicon.png`, variante WebP 256 px). Utiliser cet asset avec son cadre et ses effets existants, au même ratio et au même emplacement ; ne pas le remplacer par le symbole compact ni redessiner le signe de marque.
- Conserver le fond bleu nuit, les accents cyan, bleu et violet avec une touche fuchsia, les halos discrets et la typographie du site. La zone d’attente reste ouverte, sans empiler les panneaux.
- La barre reste indéterminée lorsque le total n’est pas connu. Pour les games paginées, afficher uniquement le nombre réellement reçu et le total connu. Ne pas inventer de pourcentage, valider une étape à partir de la présence de données, ni ajouter un délai pour prolonger le décor.
- Un chargement réussi, même vide, ouvre immédiatement le contenu. L’absence de roster, de games, de draft ou de review n’est pas un chargement en cours.
- Sur mobile, empiler le texte, l’illustration et l’état sans débordement global. Garder les trois étapes lisibles. Le statut est annoncé poliment ; la décoration est ignorée par les technologies d’assistance.
- `prefers-reduced-motion` et `html.nxt5-low-gpu` arrêtent les animations ; le mode performance supprime aussi les filtres et la texture. L’état et la progression restent compréhensibles à l’arrêt.

Le composant `src/components/loading/AppLoadingScreen.jsx` et sa feuille `AppLoadingScreen.css` définissent cette composition. Ne pas réintroduire le premier écran à cercle animé ni les anciennes colonnes de chargement.

## 3. Palette de référence

### Couleurs et tokens existants

| Rôle | Valeur | Source / usage |
| --- | --- | --- |
| Fond canonique | `#020611` | `--nxt5-bg` ; bleu nuit de référence. |
| Fond historique | `#020511` | `html`, couches du fond et certaines surfaces ; conserver dans ces compositions. |
| Surface | `rgba(7, 14, 29, 0.88)` | `--nxt5-surface`. |
| Surface élevée | `rgba(10, 20, 39, 0.94)` | `--nxt5-surface-raised`, token disponible. |
| Surface intérieure | `rgba(255, 255, 255, 0.035)` | `--nxt5-surface-soft`, avec variantes contextuelles. |
| Bordure | `rgba(207, 250, 254, 0.13)` | `--nxt5-border`. |
| Bordure forte | `rgba(165, 243, 252, 0.24)` | `--nxt5-border-strong`. |
| Texte principal | `#F8FAFC` | `--nxt5-text` ; blanc `#FFFFFF` également utilisé. |
| Texte atténué déclaré | `#94A3B8` | `--nxt5-muted` ; ne représente pas les classes slate recalées ci-dessous. |
| Cyan principal | `#67E8F9` | `--nxt5-accent`. |
| Violet secondaire | `#A78BFA` | `--nxt5-accent-2`. |
| Danger doux | `#FDA4AF` | `--nxt5-danger`. |
| Cyan d’ambiance | `#00D8FF` | Halos, décor et couleur de thème. |
| Fuchsia d’ambiance | `#D900FF` | Halos de fond, avec une faible opacité. |

Les couleurs translucides doivent toujours être évaluées sur leur fond réel. Les tokens décrivent une base ; les composants partagés et la cascade déterminent leur application finale. Les tokens `surface-raised`, `muted` et `danger` sont déclarés mais ne sont pas encore référencés par `var()` dans le code audité.

### Textes secondaires réellement appliqués

Le site éclaircit plusieurs utilitaires Tailwind dans `src/index.css` :

| Classe | Couleur effective |
| --- | --- |
| `text-slate-300` | `#F3F8FF` |
| `text-slate-400` | `#EDF5FF` |
| `text-slate-500` | `#E8F1FF` |
| `text-slate-600`, `text-slate-650`, `text-slate-700` | `#DBE8F8` |
| Placeholders slate concernés par la surcharge | `#B8C6DC`, opacité 1 |

**Ne pas rétablir les gris Tailwind par défaut sur les pages sombres.** Distinguer les niveaux par la taille, la graisse et l’espace, sans rendre le texte difficile à lire.

### Dégradés et sens des couleurs

- Action principale : `linear-gradient(to right, #22D3EE, #3B82F6, #D946EF)` ; cyan, bleu, fuchsia, dans cet ordre. Le token `--nxt5-primary-gradient` et la classe partagée `nxt5-button-primary` portent ce dégradé. Depuis la version 1.8, son texte est bleu nuit `#020611` : le contraste minimal calculé sur le dégradé complet est d’environ 5:1 en sRGB (état actif non désactivé), contre 1,81:1 au minimum avec le blanc. Conserver ce texte sombre et retirer les filtres de saturation ou de luminosité qui altéreraient cette borne, y compris sur les liens de téléchargement. Les textes courants des surfaces restent clairs.
- Accent de titre métallique existant : `linear-gradient(180deg, #FFFFFF 0%, #DBE9FF 38%, #8297C6 72%, #FFFFFF 100%)` via `nxt5-metal-text`.
- Halo de fond : cyan à gauche, fuchsia à droite, avec une opacité basse ; ne pas créer un aplat saturé derrière un tableau.
- Succès / victoire / écart favorable : `green` (emerald). Erreur / défaite / écart défavorable : `red` (rose). Vigilance : `yellow` (amber). Interpréter le sens selon la métrique : moins de morts peut être favorable ; un signe négatif n’est pas automatiquement mauvais.
- Navigation et information : `cyan` ou `blue` ; distinction secondaire : `purple` ou `pink`.
- Réutiliser `Badge` de `src/components/ui/Core.jsx` et `tone()` de `src/app/helpers.js`. Attention : `tone("orange")` est historiquement un **alias fuchsia**, pas une palette orange.
- Dans les comparaisons de sides, conserver le côté bleu à gauche et le côté rouge à droite lorsque cette structure est utilisée. Le side et le résultat victoire/défaite restent deux notions distinctes.
- Toujours associer une couleur sémantique à un mot, un signe ou une icône. Les chiffres et graphiques conservent unités, période, légende et état « aucune donnée ».

## 4. Logo, images et icônes

| Élément | Fichier ou composant à réutiliser |
| --- | --- |
| Logo complet | `BrandLogo` ; `public/assets/nxt5-logo.png` ; variantes WebP 320 et 640. |
| Signature horizontale | `Nxt5Wordmark` ; `public/assets/nxt5-wordmark.png` ; variantes WebP 320 et 640. |
| Symbole compact | `public/assets/nxt5-mark.png` et `nxt5-mark-160.webp` ; usages compacts hors centre du chargement. |
| Favicon complet au centre du chargement | `public/assets/nxt5-loader-favicon.png` (512 × 512 px) et `nxt5-loader-favicon-256.webp` ; conserver le dessin complet. |
| Icônes d’interface | `lucide-react`, même famille de traits. |
| Rôles et avatars | `RoleIcon`, `TeamAvatar` et composants de portraits déjà présents. |
| Objectifs de jeu | Fichiers existants de `public/assets/objectives/`. |

Conserver le ratio d’origine avec `object-contain`, la transparence et les couleurs du logo. Ne pas le redessiner, l’étirer, le recolorer ou reconstituer ses lettres avec une autre police. Préférer le symbole lorsque l’espace ne permet plus de lire la signature. Objectif d’espace de protection : au moins un quart de la hauteur visible du signe, à ajuster au cadre déjà existant.

Tailles d’icônes observées : 16 px dans les contrôles, 20 px pour les petits repères et 28 px pour les rôles ou blocs illustrés. Les icônes décoratives ne doivent pas être annoncées deux fois ; les boutons sans texte ont un nom accessible. Utiliser des images responsive avec dimensions explicites et texte alternatif approprié.

## 5. Typographie et hiérarchie

Pile du site : `Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`.

**Inter est déclarée mais aucun chargement web de cette police n’est configuré dans la source auditée.** Le système peut donc afficher une police de repli. Ne pas introduire une police techno supplémentaire. Si un rendu Inter identique sur toutes les machines devient nécessaire, traiter le chargement de police comme une évolution distincte et documentée.

| Niveau | Repère existant | Règle d’usage |
| --- | --- | --- |
| Titre principal d’accueil | 36 / 48 / 60 px selon les paliers Tailwind ; graisse 900 ; interligne 1,02 | Phrase courte, mots accentués avec parcimonie. |
| Titre de page | `PageHeader` ; 24 / 30 / 36 px avant surcharges contextuelles | Conserver le composant, son surtitre et sa description. |
| Titre en mode dense | `clamp(1.65rem, 2.45vw, 2.45rem)` ; interligne 1,1 | Éviter les très grands titres qui réduisent l’espace des données. |
| Titre de section / carte | En général 18 à 24 px, gras | Séparer les sections sans multiplier les styles. |
| Texte courant | En général 14 à 16 px, interligne 1,5 à 1,75 | Casse normale ; poids 400 à 600 selon le composant. |
| Label de formulaire | 12 px, graisse 900, capitales, chasse `0.16em` | Réservé aux libellés courts. |
| Badge / surtitre | Environ 10 à 12 px, gras et capitales | Repère secondaire, jamais texte long ou information indispensable trop petite. |
| Valeur statistique | Taille adaptée au KPI | Objectif : alignement stable des chiffres ; `tabular-nums` si utile. |

Les titres de page ont des surcharges mobile : ne pas reproduire cette échelle avec des tailles codées séparément. Le logo graphique reste un asset ; la classe textuelle historique `nxt5-wordmark` ne remplace pas `Nxt5Wordmark`.

## 6. Formes, surfaces et espacement

**Le rendu de référence utilise des coins arrondis.** Les anciens `clip-path` aux angles coupés sont neutralisés par des règles `!important`.

| Élément | Référence |
| --- | --- |
| Panneau principal | `--nxt5-radius-panel: 1.25rem` = 20 px ; 16 px à 640 px et moins. |
| Contrôle et bouton | `--nxt5-radius-control: 0.75rem` = 12 px. |
| Panneau imbriqué | `0.95rem` = 15,2 px ; plus sobre que son parent. |
| Conteneur d’onglets / onglet | 16 px / 11,2 px. |
| Badge | Arrondi complet. |
| Ombre de surface | `0 18px 48px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.045)`. |
| Fond de surface principale | Dégradé à 145° : `rgba(10,22,42,.94)`, `rgba(5,11,24,.92)` à 62 %, `rgba(12,9,28,.9)` ; base `--nxt5-surface`. |
| Fond de champ | `rgba(3,9,21,.78)`. |

Les boutons partagés n’ont pas d’ombre finale ; leurs variantes ne doivent pas recréer de halo. Les balayages `::after` des boutons et panneaux premium sont également désactivés. Ne pas les réactiver par copie d’anciens styles. Un `Surface` standard n’ajoute plus de filet lumineux décoratif : `glow` réserve un unique filet supérieur atténué aux zones mises en avant. Les panneaux imbriqués n’ont ni ombre ni flou d’arrière-plan. Les états vides restent cyan/violet, sans halo orange.

Utiliser les espacements Tailwind déjà présents. Pour les nouveaux blocs, privilégier la grille 4 / 8 / 12 / 16 / 24 / 32 px, puis laisser les règles de densité du site s’appliquer. Un `Surface` standard utilise 16 px de padding ; le mode dense descend notamment à `0.85rem`, puis 12 px sur petit mobile. Un seul niveau de panneau principal par zone suffit généralement ; organiser l’intérieur avec lignes et séparateurs légers.

### Zone de téléchargement de NXT5 Importer

Évolution autorisée le 8 septembre 2026 : simplifier la zone de téléchargement du **site web**, désormais ouverte à la demande dans Games, en conservant la palette et les composants existants.

- Présenter le téléchargement dans une seule `Surface`, sans cartes internes ni répétition du parcours d’import.
- Proposer un menu déroulant natif avec le libellé persistant « Version de l’application » et trois choix : Windows (64 bits), Mac Apple Silicon et Mac Intel. Un unique lien bouton « Télécharger » utilise l’URL correspondant au choix sélectionné. Conserver les URL et architectures existantes ainsi que l’accès au clavier.
- Séparer la ligne « Déjà un fichier JSON ? » des téléchargements par un trait léger. Utiliser un véritable `Button` accessible au clavier pour ouvrir le sélecteur de fichier, avec focus visible et états de chargement et désactivation.
- Afficher l’assignation de la game uniquement après le chargement d’un JSON. Conserver la progression d’envoi, les validations, le changement de fichier et la réinitialisation.
- Sur petit écran, empiler le menu de version et le bouton de téléchargement ; conserver les libellés entiers et les actions JSON distinctes, sans défilement horizontal global.

Cette règle concerne la zone de téléchargement du site ; elle ne modifie pas la mise en page de l’application `importer-app`.

### Composition des objectifs

Évolution autorisée le 8 septembre 2026 : dans Tendances, le bloc Objectifs utilise un seul `Surface`. Sa hiérarchie repose sur la typographie, les espacements et les séparateurs, sans sous-cartes ni badges imbriqués.

- La priorité équipe réunit le titre, sa justification et un seul accès « Voir les games sources ». La cible collective, la valeur actuelle et le prochain contrôle forment une seconde zone ouverte, distinguée par un filet violet.
- Les objectifs par rôle se lisent en lignes : icône et contexte actuel, consigne et explication, puis cible. Réutiliser `RoleIcon`, sans boîtier décoratif. Une seule action « Contrats joueurs » donne accès au détail individuel.
- Le composant `ProgressionObjectives` et sa feuille `progression-objectives.css` définissent cette composition. Les classes locales évitent les anciennes surcharges visant les cartes arrondies et les grilles Tailwind. Conserver les données, les unités et les accès aux preuves lors de toute adaptation.

### Liste des games importées

Évolution autorisée le 8 septembre 2026 : les games importées forment une liste de travail dans un seul `Surface`. La recherche, les filtres, la sélection et les lignes partagent le même panneau ; ne pas recréer une carte par game ou encadrer chaque métadonnée.

- Mettre la recherche au premier plan avec un libellé persistant et une action d’effacement. Elle accepte plusieurs mots, sans dépendre des accents ou de la casse : chaque mot doit être retrouvé parmi les informations de la game. Permettre de retrouver un adversaire, un identifiant, un joueur, un champion, une catégorie ou une date, sans obliger à choisir le champ à l’avance.
- Garder les filtres Résultat, Review et Côté visibles, ainsi que le tri par date ou durée, dans les deux sens. Le résultat et le côté restent deux informations distinctes. Afficher le nombre de games trouvées et un accès clair à la réinitialisation ; les contrôles restent présents quand une recherche ou une catégorie ne contient aucune game.
- Présenter chaque game dans une ligne aérée : résultat écrit et coloré, identité et catégories en texte simple, composition alliée, date et durée, puis statut de review avec icône et libellé. Les séparateurs légers et l’alignement structurent la lecture. Réserver les fonds colorés aux états de survol et de sélection ; indiquer explicitement les valeurs inconnues.
- Rendre toute la ligne sélectionnable au clavier, avec état sélectionné et focus visibles. Conserver la sélection lorsque les filtres ou la pagination masquent la ligne. Un bandeau discret, ouvert et marqué d’un filet cyan nomme la game active et regroupe les actions vers ses stats et sa review. Signaler une sélection hors des résultats affichés et proposer de la retrouver dans la liste lorsqu’elle appartient au périmètre courant ; permettre de la désélectionner.
- Paginer avec 10, 25 ou 50 games par page. Montrer la plage affichée, le total et la page courante, avec précédent/suivant explicitement désactivés aux limites. Une modification des filtres repart de la première page sans perdre la game sélectionnée.
- Différencier un historique vide d’une recherche sans résultat et proposer une action utile pour élargir le périmètre. Annoncer les changements de résultats poliment, sans mouvement décoratif supplémentaire.

Le composant `ImportedGames` et sa feuille `imported-games.css` définissent cette composition ; `src/utils/imported-games.js` porte les règles de recherche, de filtre et de tri. Réutiliser les portraits de champions et les contrôles partagés.

### Espace Games unifié

Évolution autorisée le 8 septembre 2026 : fusionner Importations et Statistiques dans une seule page **Games**. La liste de games devient l’entrée commune ; une sélection affiche ses statistiques directement dans cet espace. Cette règle remplace l’historique d’imports séparé de la version 1.7. **Les statistiques dominent la page : modifier les postes ou les profils reste une action occasionnelle et discrète.**

- Conserver une seule liste de consultation avec recherche multi-mots, filtres Résultat, Review, Côté et Catégorie, tri explicite et pagination. Le filtre Catégorie propose toutes les games, les games non classées et les catégories existantes. Réutiliser `ImportedGames` et sa feuille de styles ; ne pas dupliquer la liste entre une vue d’import et une vue de statistiques.
- Un clic ou une activation clavier sur une game ouvre ses statistiques sans détour par un bouton « Voir les stats ». La game active reste identifiable lorsque la recherche, un filtre ou la pagination masque sa ligne. Conserver un accès clair au retour à la liste et aux autres games, sans imposer la fermeture des statistiques pour consulter les actions disponibles.
- Donner la priorité visuelle au résultat, aux métriques, aux compositions et aux analyses de la game sélectionnée. Les métadonnées d’import sont secondaires : afficher auteur, date d’import et patch lorsqu’ils sont connus, sans les confondre avec la date de partie ni inventer de valeur absente. Distinguer les tris par date de partie, date d’import et durée.
- L’action « Importer une game » ouvre le téléchargement de NXT5 Importer et le chargement JSON seulement à la demande. Conserver le menu de version, les liens et architectures existants, la progression, les validations et l’assignation conditionnelle après lecture du JSON. Le parcours principal reste compact lorsque l’import est fermé.
- Les actions sur la game sont accessibles depuis un seul bouton discret **⋯** auprès de la fiche, avec un nom accessible explicite. Le menu contient la modification des informations et catégories, celle des postes et profils, et la suppression selon les droits existants. Ne pas afficher une rangée permanente de boutons « Modifier », « Postes » et « Supprimer », ni placer l’édition dans les lignes statistiques. La suppression conserve son traitement de danger et sa confirmation.
- Ouvrir uniquement le formulaire demandé dans une zone contextuelle sobre, identifiée par le nom de la game et séparée par des filets. Conserver labels, validations, Enregistrer, Annuler et états de sauvegarde. Après enregistrement, les statistiques et les profils liés doivent utiliser les données actualisées. Ne pas laisser un ancien détail en cache masquer la correction.
- Conserver le brouillon lorsque la recherche, un filtre ou la pagination masque la ligne concernée. Pendant l’édition ou la sauvegarde, verrouiller le changement et la désélection de la game active, y compris les chemins de sélection indirects, et indiquer la modification en cours. Le formulaire reste attaché à la game nommée ; Enregistrer ou Annuler termine l’édition.
- Les groupes de games restent consultables et gérables dans le même espace. Le groupe actif et son périmètre sont explicites ; la sélection d’une game ouvre son détail, et le retour au groupe restitue son analyse. La création ou la modification d’un groupe apparaît à la demande. La gestion des catégories reste repliable, accessible au clavier et soumise aux droits et confirmations existants.
- **Review** conserve son espace de travail du staff ; **Tendances** conserve l’analyse dans le temps. Les anciens chemins `/integration` et `/statistiques`, leurs liens vers une game et la navigation précédent / suivant restent compatibles avec Games. Ne pas perdre la game demandée lors de la normalisation de l’URL.
- Un menu discret garde une cible de 44 × 44 px, un focus visible et un état ouvert annoncé. Son contenu, ainsi que les formulaires, reste utilisable au clavier et au toucher ; sa fermeture restitue le focus au déclencheur. La discrétion repose sur la hiérarchie et l’affichage à la demande, jamais sur un texte illisible ou un contrôle minuscule.

`src/pages/workspace/GameWorkspace.jsx` porte l’espace Games et son orchestration ; `ImportedGames` conserve la recherche, la liste, la sélection et la navigation. Cette composition concerne le site, sans modifier l’interface de l’application `importer-app`.

### Cohérence des espaces de travail

Évolution autorisée le 8 septembre 2026 lors de l’audit transversal : appliquer la même sobriété aux écrans existants, en conservant les données, les actions et les états sémantiques.

- **Tendances** : utiliser `PageHeader` avec ou sans données. Le bilan conserve un `Surface` partagé ; présenter ses métriques en lignes et séparateurs sans halo saturé. `TrendEvolution` réutilise aussi `Surface` et `Button`, avec des commandes de période de 44 px. Les côtés restent cyan/bleu et rose/rouge, distincts du résultat.
- **Modules de progression et review** : les primitives de `NextPhase` réutilisent `Surface`, `Badge`, `Button` et les champs partagés. Présenter les comparaisons Avant / Après et les synthèses en zones ouvertes. Les actions répétées de la file de review restent secondaires pour éviter un dégradé par ligne. Le côté rouge reste rose, indépendamment de la couleur du résultat.
- **Draft et compositions** : synthèse, banque de picks, counters, identité et lexique utilisent des zones ouvertes et des filets. Réserver les cadres aux portraits et aux cibles de dépôt utiles. Les légendes et explications restent en texte ; les badges identifient les états. Les contrôles de picks et de tags sélectionnables exposent leur sélection.
- **Champion Pool** : les textes secondaires sont clairs (`#EDF5FF`), les commandes mesurent au moins 44 px et les sélecteurs passent à 16 px de texte lorsque le conteneur descend sous 560 px. La largeur disponible gouverne la composition.
- **Roster et profils** : conserver les noms entiers et recomposer les lignes sur mobile dans des zones ouvertes. Le profil joueur utilise une hiérarchie dense (titre 24/30 px), des métriques séparées par des filets et des sections repliables avec focus et état ouvert visibles, sans halo de profil.
- **Planning** : employer les boutons partagés et une légende ouverte. Les cellules gardent une hauteur minimale de 56 px ; les dates sont à 12 px et le type de session à 11 px. Le mode explicite « Modifier les événements » donne accès au choix Scrim / Match / Review au clic, au toucher et avec Entrée. Le clic droit reste disponible ; Échap ferme le choix et restitue le focus.
- **Administration** : présenter les métriques avec des séparateurs, les graphiques avec des barres cyan/violet unies et des libellés lisibles. Une barre garde sa hauteur proportionnelle à la donnée dans une cible interactive de 44 px minimum ; le minimum tactile ne doit pas déformer la barre elle-même. Réutiliser `TextInput` / `SelectInput` avec labels persistants ; les tableaux larges ont un `nxt5-responsive-scroll` nommé et accessible au clavier.
- **Compte et pages publiques** : réserver vert et ambre à des états réels. Les repères de présentation et de sécurité utilisent cyan, bleu, violet ou fuchsia. Les sections légales sont ouvertes dans un seul `Surface`. Le choix de rendu complet ou performance utilise un fond cyan translucide et un état sélectionné explicite.

Les règles locales de `compositions.css`, `champion-pool.css` et `Planning.css` complètent les composants partagés sans reproduire les anciennes piles de cartes lumineuses.

## 7. Composants à employer

Les composants de référence se trouvent dans `src/components/ui/Core.jsx`.

| Besoin | Composant / comportement |
| --- | --- |
| En-tête | `PageHeader` : surtitre, titre, description et actions qui reviennent à la ligne. |
| Bloc de contenu | `Surface` : fond, rayon, bordure et conteneur intérieur déjà harmonisés. |
| Action principale | `Button variant="primary"` : dégradé de marque, texte bleu nuit ; une action dominante par zone. Les ancres utilisent aussi `nxt5-button-primary`. |
| Action secondaire | `Button variant="ghost"` : surface sombre et bordure claire. |
| Action destructive | `Button variant="danger"` : rose, libellé qui décrit l’action. |
| État court | `Badge tone="…"` : même sens des couleurs sur toutes les pages. |
| Sous-navigation | `TabNav` : actif différencié, `aria-selected`, focus visible. |
| Formulaire | `TextInput`, `TextAreaInput`, `SelectInput` : label persistant, bordure et focus communs. |
| Notification | `ToastStack` : réutiliser le placement et les tons existants. |

Pour les nouvelles actions, prévoir les états repos, survol, focus clavier, pressé, désactivé, chargement et erreur si pertinents. Le chargement conserve un libellé compréhensible. Ne pas confondre absence de données et erreur.

Exemple de composition dans une page de `src/pages/workspace/` :

```jsx
import { PageHeader, Surface, Button } from "../../components/ui/Core.jsx";

export function ExampleReviewSection({ onCreate }) {
  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Review"
        title="Prépare la prochaine session"
        subtitle="Retrouve les games et les points à travailler."
      >
        <Button type="button" onClick={onCreate}>Créer une review</Button>
      </PageHeader>
      <Surface>
        <h3 className="text-lg font-black text-white">Games à revoir</h3>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          Ajoute une game pour préparer la review.
        </p>
      </Surface>
    </div>
  );
}
```

Exemple d’assemblage, à adapter aux vraies données et au cadre de page. `PageHeader` émet actuellement un `h2` : vérifier la hiérarchie sémantique complète de l’écran.

## 8. Mobile et lisibilité

- Largeur minimale actuellement déclarée : 320 px. Vérifier au moins 360, 390, 768, 1024 et 1440 px pour une modification de structure.
- À partir de 1024 px, le shell tient compte de la sidebar : 19 rem ouverte, 8,5 rem réduite. En dessous, le contenu reprend toute la largeur.
- Le mode dense réduit de nombreuses grilles à deux colonnes sous 1024 px, puis une à 640 px et moins. Des exceptions existent pour les petits groupes répétitifs. Vérifier la cascade avant d’ajouter une grille.
- Sous 768 px, d’autres règles convertissent les grilles arbitraires dans les panneaux en une colonne. Ne pas supposer que le seul préfixe Tailwind décide du résultat.
- Pour le bloc Objectifs, la largeur du conteneur détermine la disposition : à partir de 700 px, priorité et cible sont côte à côte, et chaque rôle occupe trois colonnes ; en dessous, les contenus se superposent sans recréer de cartes. Cette règle tient compte de l’espace réellement disponible avec la sidebar.
- Pour les games importées, la disposition suit aussi la largeur du conteneur : à partir de 880 px, aligner les informations sous des en-têtes de colonnes ; en dessous, recomposer chaque ligne en plusieurs rangées sans sous-carte. Sous 600 px, empiler recherche et tri, répartir les filtres sur deux colonnes avec le côté en pleine largeur, et donner toute la largeur à la navigation de pagination. Conserver la composition, la date, le résultat et le statut de review sans défilement horizontal global.
- Dans Games, conserver les mêmes paliers de conteneur que la liste partagée. Sous 880 px, empiler les zones d’édition et les équipes du formulaire de postes. Sous 600 px, Catégorie et Côté prennent toute la largeur, Résultat et Review partagent une rangée, et les champs poste / profil s’empilent. Le bouton de menu reste discret et accessible ; son contenu et les actions d’édition reviennent à la ligne. Garder les noms, les catégories et les champs de profil lisibles sans débordement global.
- Les noms de joueurs, titres et boutons peuvent revenir à la ligne. Réserver la troncature aux endroits où l’intégralité reste accessible. Les onglets `TabNav` gardent leurs libellés entiers ; sur mobile, leur propre conteneur défile horizontalement sans provoquer de débordement de page.
- Les tables larges utilisent un conteneur `nxt5-responsive-scroll`. Sur mobile, certaines tables gardent une largeur interne minimale de 680 px : faire défiler le tableau, pas toute la page.
- Champs à 16 px à 640 px et moins : cette taille doit gagner dans la cascade, y compris sur les champs partagés et les contrôles denses. Les boutons partagés et les actions des panneaux sur mobile ont un minimum de 44 px de hauteur. Les actions à icône concernées (mot de passe, notification, menu, picks) offrent 44 × 44 px et un nom accessible. Ce minimum ne certifie pas chaque contrôle du site ; vérifier également la largeur et l’espacement dans son contexte.
- Conserver le focus clavier visible. Le style global utilise un contour cyan de 2 px, décalé de 2 px ; les champs ajoutent une bordure cyan et un anneau de 3 px.
- Objectifs de conception : contraste d’au moins 4,5:1 pour le texte courant et 3:1 pour les grands textes. Contrôler les fonds réellement composités et toute la zone de texte d’un dégradé.
- Le CTA partagé a été corrigé en version 1.8 avec un texte bleu nuit sur le dégradé de marque, pour un contraste calculé minimal d’environ 5:1. Contrôler la cascade effective et les éventuels enfants colorés avant d’étendre cette mesure à un CTA particulier ; les états désactivés restent explicitement différenciés.

## 9. Mouvement et performance

Transitions usuelles des contrôles : 160 ms. Classes d’entrée : `nxt5-enter` 320 ms, `nxt5-enter-fast` 180 ms, `nxt5-fade-in` 160 ms. Conserver un mouvement bref et utile ; ne pas animer en continu les chiffres ou les tableaux.

Respecter `prefers-reduced-motion` et `html.nxt5-low-gpu`. Depuis la version 1.8, le mouvement réduit arrête globalement les animations, rend les transitions immédiates et désactive le défilement fluide. Le défilement déclenché en JavaScript dans l’assistant suit également cette préférence et le mode performance. Le mode `nxt5-low-gpu` supprime globalement les animations et les filtres d’arrière-plan des surfaces, onglets et éléments de navigation partagés. Ne pas empiler de nouvelles couches de flou dans les panneaux imbriqués ; vérifier ces préférences pour toute nouvelle animation ou commande de défilement.

## 10. Ton des textes

Français direct et concret, tutoiement cohérent avec l’accueil : « Importe tes games », « Prépare la review ». Employer les termes du produit quand ils sont utiles : équipe, roster, game, draft, review. Préférer un verbe précis sur les boutons : « Importer une game », « Enregistrer », « Créer une review ».

Les interfaces exposent les informations ; le coach garde l’interprétation. Ne pas inventer de promesse de victoire, de chiffre de performance ou d’analyse sportive certaine pour remplir une maquette. Une maquette contenant des valeurs d’exemple doit l’indiquer.

## 11. Contrôle avant livraison

- [ ] Les composants partagés et assets existants ont été réutilisés.
- [ ] Palette, coins arrondis et textes secondaires restent cohérents.
- [ ] Les actions principales sont identifiables sans multiplier les dégradés.
- [ ] Les couleurs de sides, résultats et états gardent leur sens.
- [ ] Aucun contenu essentiel n’est coupé ; pas de débordement horizontal global.
- [ ] Les états vide, chargement, erreur et désactivé sont lisibles lorsque concernés.
- [ ] Clavier, focus, contraste, petits écrans et mouvement réduit ont été vérifiés à hauteur du changement.
- [ ] Le rendu visuel a été contrôlé, pas seulement les noms de classes.
- [ ] Toute évolution de la charte demandée par l’utilisateur est documentée.

Pour une modification purement documentaire, vérifier les liens et la cohérence du contenu suffit. Pour du code, utiliser les vérifications adaptées et celles exigées par le dépôt ; la commande complète existante est `npm run verify`.

## 12. Sources, limites et entretien

Sources principales :

- `src/index.css` : tokens (début du fichier), couche d’harmonisation à partir de la ligne 224, variantes de densité, mobile, performance et couleurs secondaires.
- `src/components/ui/Core.jsx` : composants partagés et états.
- `src/components/loading/AppLoadingScreen.jsx` et `AppLoadingScreen.css` : écran de chargement partagé, signaux des cinq rôles, progression réelle, adaptation mobile et mouvement réduit.
- `src/App.jsx`, `src/AppContent.jsx` et `src/hooks/useTeamData.js` : relais entre les phases de chargement et progression des games paginées.
- `src/components/brand/BrandAssets.jsx` : logos, images responsive et rôles.
- `src/components/trends/ProgressionObjectives.jsx` et `src/components/trends/progression-objectives.css` : composition ouverte du bloc Objectifs et adaptation à la largeur du conteneur.
- `src/NextPhase.jsx` et `src/components/trends/TrendEvolution.jsx` : primitives communes, comparaisons ouvertes, actions de review secondaires et périodes accessibles.
- `src/components/games/ImportedGames.jsx`, `src/components/games/imported-games.css` et `src/utils/imported-games.js` : liste des games importées, recherche et filtres, tri et pagination, sélection persistante et adaptation à la largeur du conteneur.
- `src/app/helpers.js` : correspondance des tons via `tone()`.
- `src/pages/public/PublicPages.jsx` : accueil, composition des pages publiques et sections légales ouvertes.
- `src/pages/workspace/DraftWorkspace.jsx` et `src/styles/compositions.css` : compositions, banque, counters et lexique ouverts.
- `src/pages/workspace/TrendsPage.jsx`, `Teams.jsx` et `PlayerUltimateProfile.jsx` : en-têtes communs, roster et hiérarchie des profils.
- `src/styles/champion-pool.css` : lisibilité, contrôles et largeur du Champion Pool.
- `src/pages/workspace/Planning.jsx` et `Planning.css` : planning, légende et mode d’édition tactile.
- `src/pages/admin/AdminDashboard.jsx` et `src/pages/workspace/AccountSettings.jsx` : contrôles, graphiques et états de réglage.
- `src/pages/workspace/ImporterDownloadPanel.jsx` et `src/pages/workspace/GameWorkspace.jsx` : espace Games unifié, statistiques, groupes, import à la demande et gestion discrète avec formulaires contextuels.
- `src/components/layout/AppChrome.jsx` et `src/app/performance.js` : shell et mode performance.
- `tailwind.config.js` et `index.html` : configuration et pile de chargement.

La source auditée contient plusieurs couches CSS. Un commentaire disant « final layer » ne prouve pas qu’une règle gagne : certaines règles ultérieures restent actives, notamment le titre métallique. Les panneaux et boutons conservent en revanche leurs arrondis grâce à `!important`. Examiner spécificité, ordre et styles calculés avant toute correction. Ne pas ajouter automatiquement une nouvelle couche de surcharges.

La référence initiale est issue de la lecture du code et d’une vérification du rendu local de l’accueil. La simplification locale documentée en version 1.1 a été vérifiée de 320 à 1440 px, au clavier et dans les états JSON invalide, chargement, aperçu, réinitialisation et absence d’équipe. La version 1.2 précise le choix de version dans un menu déroulant natif et son unique lien de téléchargement ; le formulaire JSON et l’assignation conditionnelle restent inchangés. La version 1.3 ajoute la composition ouverte des objectifs, vérifiée de 360 à 1440 px avec l’espace de la sidebar, l’accès aux sources et les contrats joueurs. La version 1.4 documente l’écran de chargement unique. La version 1.5 ajoute la liste ouverte des games importées et ses règles de recherche, de sélection et de navigation. La version 1.6 précise le favicon complet existant au centre du chargement. La version 1.7 étend la liste partagée à l’historique des imports et documente son filtre de catégorie, ses dates distinctes et ses formulaires contextuels. La version 1.8 consigne les corrections de l’audit transversal sur les composants partagés, les pages publiques et les espaces de travail : contraste CTA, surfaces apaisées, lisibilité et contrôles mobiles. La version 1.9 fusionne Importations et Statistiques dans Games, place les statistiques au premier plan et masque import et modifications derrière leurs accès contextuels ; elle conserve Review, Tendances, groupes et anciens liens. La borne de contraste du CTA provient d’un calcul sur 2 002 points du dégradé sRGB ; elle ne constitue pas une mesure de chaque élément rendu. Les vérifications du code et du navigateur sont consignées séparément dans le rapport d’audit de cette intervention. Cette référence ne certifie pas toutes les pages connectées ni la production.

`AGENTS.md` dans le dépôt demande de lire cette charte avant le travail visuel. Un rappel existe aussi à la racine de l’espace local NXT5. Pour utiliser la même référence dans un autre checkout ou outil IA, y inclure `AGENTS.md` et cette charte, ou fournir explicitement le document à l’outil. Un PDF seul n’impose pas automatiquement ses règles à toutes les IA.

Mécanisme de lecture documenté par OpenAI : [instructions de projet avec AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md).

Lors d’une évolution visuelle demandée, mettre à jour ce Markdown, sa version et les exemples concernés, puis régénérer la synthèse PDF. Ne pas remplacer une règle simplement parce qu’une page isolée s’en écarte.
