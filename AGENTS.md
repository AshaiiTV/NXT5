# NXT5 - Instructions de projet

## Charte graphique

Avant toute création ou modification visuelle du site NXT5, lire [docs/charte-graphique.md](docs/charte-graphique.md), puis les composants concernés. Ce document est la référence commune pour les couleurs, la typographie, les logos, les surfaces, les états, la densité et le responsive.

- Réutiliser en priorité `src/components/ui/Core.jsx`, `src/components/brand/BrandAssets.jsx`, les tokens et classes de `src/index.css`.
- Conserver le fond bleu nuit, les accents cyan/violet/fuchsia, les textes clairs et les panneaux arrondis. Vérifier la cascade réelle : des styles historiques sont neutralisés par `!important`.
- Adapter les changements au mobile et conserver les états de focus, chargement, erreur et mouvement réduit lorsqu’ils sont concernés.
- Les instructions explicites de l’utilisateur priment sur cette charte. Lorsqu’il demande une évolution de l’identité, la réaliser et mettre à jour le document dans le même travail ; ne pas créer une demande de confirmation supplémentaire pour une décision déjà autorisée.
- La charte du site ne remplace pas le système de mise en page propre à `importer-app`.
- Pour un nouveau checkout destiné au travail visuel, conserver ce fichier et la charte ensemble.

Pour une modification uniquement documentaire, vérifier les liens et la cohérence du contenu. Pour le code, effectuer les contrôles adaptés au changement et les vérifications exigées par le dépôt (`npm run verify` pour le contrôle complet).
