# NXT5 - Charte graphique et consignes pour l’IA

Version 1.4 · 8 septembre 2026 · Base d’audit : commit `9aeb1c0`, complétée par les évolutions de la zone de téléchargement, du bloc Objectifs et du chargement. Checkout actualisé sur `fd42233`.

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

- La composition repose sur le titre « Cinq rôles. Une même direction. », un texte court et cinq signaux SVG TOP / JGL / MID / ADC / SUP qui convergent vers le symbole NXT5 existant. Ne pas redessiner le signe de marque.
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

- Action principale : `linear-gradient(to right, #22D3EE, #3B82F6, #D946EF)` ; cyan, bleu, fuchsia, dans cet ordre.
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
| Symbole compact | `public/assets/nxt5-mark.png` et `nxt5-mark-160.webp`. |
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

Les boutons partagés n’ont pas d’ombre finale : le CSS neutralise les halos encore présents dans leurs classes. Les balayages `::after` des boutons et panneaux premium sont également désactivés. Ne pas les réactiver par copie d’anciens styles.

Utiliser les espacements Tailwind déjà présents. Pour les nouveaux blocs, privilégier la grille 4 / 8 / 12 / 16 / 24 / 32 px, puis laisser les règles de densité du site s’appliquer. Un `Surface` standard utilise 16 px de padding ; le mode dense descend notamment à `0.85rem`, puis 12 px sur petit mobile. Un seul niveau de panneau principal par zone suffit généralement ; organiser l’intérieur avec lignes et séparateurs légers.

### Zone de téléchargement de NXT5 Importer

Évolution autorisée le 8 septembre 2026 : simplifier la zone de téléchargement sur la page d’intégration du **site web**, en conservant la palette et les composants existants.

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

## 7. Composants à employer

Les composants de référence se trouvent dans `src/components/ui/Core.jsx`.

| Besoin | Composant / comportement |
| --- | --- |
| En-tête | `PageHeader` : surtitre, titre, description et actions qui reviennent à la ligne. |
| Bloc de contenu | `Surface` : fond, rayon, bordure et conteneur intérieur déjà harmonisés. |
| Action principale | `Button variant="primary"` : dégradé de marque ; une action dominante par zone. |
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
- Les noms de joueurs, titres et boutons peuvent revenir à la ligne. Réserver la troncature aux endroits où l’intégralité reste accessible.
- Les tables larges utilisent un conteneur `nxt5-responsive-scroll`. Sur mobile, certaines tables gardent une largeur interne minimale de 680 px : faire défiler le tableau, pas toute la page.
- Champs à 16 px à 640 px et moins. Objectif pour les nouveaux contrôles tactiles : zone confortable d’au moins 44 × 44 px ; l’existant comporte aussi des minima de 40 et 42 px.
- Conserver le focus clavier visible. Le style global utilise un contour cyan de 2 px, décalé de 2 px ; les champs ajoutent une bordure cyan et un anneau de 3 px.
- Objectifs de conception : contraste d’au moins 4,5:1 pour le texte courant et 3:1 pour les grands textes. Contrôler les fonds réellement composités et toute la zone de texte d’un dégradé.
- Le texte blanc sur la portion cyan du CTA actuel mérite une vérification de contraste. La charte ne certifie pas sa conformité. Si corrigé, le faire dans le composant partagé et documenter l’évolution.

## 9. Mouvement et performance

Transitions usuelles des contrôles : 160 ms. Classes d’entrée : `nxt5-enter` 320 ms, `nxt5-enter-fast` 180 ms, `nxt5-fade-in` 160 ms. Conserver un mouvement bref et utile ; ne pas animer en continu les chiffres ou les tableaux.

Respecter `prefers-reduced-motion` et `html.nxt5-low-gpu`. Le mode `nxt5-low-gpu` supprime globalement les animations et réduit les effets coûteux. La prise en charge actuelle de `prefers-reduced-motion` cible certaines animations ; vérifier et compléter sa couverture pour toute nouvelle animation. Ne pas empiler de nouvelles couches de flou dans les panneaux imbriqués.

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
- `src/app/helpers.js` : correspondance des tons via `tone()`.
- `src/pages/public/PublicPages.jsx` : accueil et composition des pages publiques.
- `src/pages/workspace/ImporterDownloadPanel.jsx` et `src/pages/workspace/GameWorkspace.jsx` : téléchargement, chargement du JSON et apparition de l’assignation.
- `src/components/layout/AppChrome.jsx` et `src/app/performance.js` : shell et mode performance.
- `tailwind.config.js` et `index.html` : configuration et pile de chargement.

La source auditée contient plusieurs couches CSS. Un commentaire disant « final layer » ne prouve pas qu’une règle gagne : certaines règles ultérieures restent actives, notamment le titre métallique. Les panneaux et boutons conservent en revanche leurs arrondis grâce à `!important`. Examiner spécificité, ordre et styles calculés avant toute correction. Ne pas ajouter automatiquement une nouvelle couche de surcharges.

La référence initiale est issue de la lecture du code et d’une vérification du rendu local de l’accueil. La simplification locale documentée en version 1.1 a été vérifiée de 320 à 1440 px, au clavier et dans les états JSON invalide, chargement, aperçu, réinitialisation et absence d’équipe. La version 1.2 précise le choix de version dans un menu déroulant natif et son unique lien de téléchargement ; le formulaire JSON et l’assignation conditionnelle restent inchangés. La version 1.3 ajoute la composition ouverte des objectifs, vérifiée de 360 à 1440 px avec l’espace de la sidebar, l’accès aux sources et les contrats joueurs. La version 1.4 documente l’écran de chargement unique. Elle ne constitue pas un audit exhaustif de toutes les pages connectées ou de la production.

`AGENTS.md` dans le dépôt demande de lire cette charte avant le travail visuel. Un rappel existe aussi à la racine de l’espace local NXT5. Pour utiliser la même référence dans un autre checkout ou outil IA, y inclure `AGENTS.md` et cette charte, ou fournir explicitement le document à l’outil. Un PDF seul n’impose pas automatiquement ses règles à toutes les IA.

Mécanisme de lecture documenté par OpenAI : [instructions de projet avec AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md).

Lors d’une évolution visuelle demandée, mettre à jour ce Markdown, sa version et les exemples concernés, puis régénérer la synthèse PDF. Ne pas remplacer une règle simplement parce qu’une page isolée s’en écarte.
