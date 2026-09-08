# Réécriture des reviews historiques

L’opération `automatic-review-v3-20260908` enregistre l’analyse complète des reviews existantes, sans ouverture ni sauvegarde individuelle. Elle utilise les mêmes données de game et le même générateur que la page Review.

`npm run db:migrate` la lance après les migrations de schéma uniquement lorsque `CONTEXT=production`. Les Deploy Previews et les installations locales ne la lancent pas. Le déploiement s’arrête si la transaction ne peut pas être validée.

## Conservation des données

- Le contenu original et les métadonnées des reviews modifiées sont sauvegardés dans `nxt5_review_backfill_backups`, au sein de la même transaction que la réécriture.
- Les notes staff sont comparées avant et après chaque écriture. Les anciennes reviews entièrement éditables sont conservées dans les notes, y compris les corrections dans l’ancien coaching.
- Seuls `content` et `updated_at` changent. Les titres, auteurs, équipes et liens aux games restent identiques.
- Des verrous empêchent la réécriture de remplacer une note concurrente avec une version périmée. Un conflit non résolu entraîne l’annulation de la transaction.
- Les reviews sans sources complètes et celles dépassant les limites de l’éditeur restent intactes. Les motifs figurent dans le bilan de l’opération.
- Les sauvegardes suivent la suppression de leur review ou de leur équipe grâce aux clés étrangères avec suppression en cascade.

## Vérification

Les logs du déploiement indiquent `Historical review backfill:` suivi des nombres de reviews examinées, réécrites, inchangées et ignorées par motif. Ils ne contiennent ni notes ni identifiants de connexion.

Le bilan durable se trouve dans `nxt5_review_backfill_runs` pour la clé de l’opération. Les déploiements suivants renvoient ce bilan avec `alreadyCompleted: true` et ne modifient plus les reviews, même si des notes ou de nouvelles reviews ont été ajoutées depuis.

## Restauration ciblée

En cas de besoin, une intervention sur la base peut restaurer `original_content` depuis la sauvegarde d’une review. Comparer d’abord le contenu actuel à `rewritten_content` et verrouiller la ligne dans une transaction : s’ils diffèrent, des modifications ont eu lieu après la réécriture et doivent être conservées. Ne pas supprimer le bilan global pour relancer l’opération sur les nouvelles notes.
