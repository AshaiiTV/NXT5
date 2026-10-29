# Aide au choix des champions

Dans **Draft & Pool > Compositions**, ouvrir **Aide au choix : pool et parties de l’équipe** sous les cinq postes de la composition.

1. Choisir le poste à préparer. Le joueur correspond au titulaire ou au remplaçant sélectionné pour ce poste dans le brouillon.
2. Indiquer éventuellement le champion adverse. Les matchs du même duel apparaissent à côté de l’expérience générale du joueur avec chaque champion.
3. Filtrer les parties de l’équipe par catégorie et par patch si nécessaire. Sans filtre, les observations couvrent toutes les catégories et tous les patches chargés.
4. Choisir un champion pour l’ajouter au brouillon. Enregistrer la composition reste nécessaire pour partager le choix.

## Ce que les suggestions signifient

Les candidats viennent uniquement du pool manuel du joueur, dans l’équipe et au poste sélectionnés. Les champions pris à un autre poste et le champion adverse sont exclus. Le choix déjà présent à ce poste reste visible.

L’ordre privilégie la maîtrise déclarée (Confiance, Situationnel, En validation, En entraînement), puis le nombre de parties de ce joueur au résultat connu. Le taux de victoire ne détermine pas le classement. Aucun score de probabilité de victoire ni statut « counter garanti » n’est produit.

Les imports sont dédoublonnés. L’association au joueur exige son identifiant : un pseudonyme ou Riot ID semblable ne suffit pas. Un duel exige un seul participant identifié au poste de chaque côté. Les résultats absents sortent du calcul du taux de victoire ; leur nombre reste compris dans la couverture affichée. Une défaite mesurée peut donner 0 % ; une absence de résultat reste indisponible. Les résultats concernent la partie entière, pas la victoire en lane.

Les parties sources peuvent être rouvertes. Une source sans identifiant reste affichée sans lien. Les filtres et le champion adverse servent à la consultation ; ils ne sont pas enregistrés avec la composition. L’aide ne modifie ni le pool ni les imports.

## Mobalytics : consultation externe

Le lien vise les counters du champion adverse, au poste sélectionné. Les slugs utilisent les identifiants canoniques (par exemple `MonkeyKing` → `monkeyking`) et les postes `top`, `jungle`, `mid`, `adc`, `support`.

Le 11 octobre 2026, les requêtes HTTP serveur standard vers les pages Darius et Ahri ont répondu **403**. Les pages restent consultables manuellement. Le relevé local est conservé dans `artifacts/draft-assistance-2026-10-11/mobalytics-source-probe.json`.

Cette version n’importe donc aucun chiffre Mobalytics, n’installe pas le CLI tiers et n’envoie aucune donnée d’équipe à ce service. Le lien s’ouvre à la demande dans un nouvel onglet, sans référent. Le texte invite à vérifier poste, patch, rang et échantillon. La liste externe peut être partielle : un champion absent n’est pas un mauvais matchup démontré.

Une collecte future nécessitera une source accessible et vérifiable, avec le sens du taux de victoire, son contexte et sa couverture. Le code actuel du skill ne suffit pas à garantir un historique de patches : voir [meta_shift.go](https://github.com/mvanhorn/printing-press-library/blob/main/library/media-and-entertainment/mobalytics-lol/internal/cli/meta_shift.go).

## Fichiers et vérification

- [Calcul et tri](../src/utils/draft-assistance.js), [tests des données](../src/__tests__/draft-assistance.test.js).
- [Composant](../src/components/draft/DraftAssistance.jsx), [styles](../src/components/draft/draft-assistance.css), [intégration](../src/pages/workspace/DraftWorkspace.jsx).
- [Tests d’interface et de sauvegarde](../src/__tests__/draft-assistance-ui.test.jsx), [traductions anglaise et espagnole](../src/i18n/draft-assistance-overrides.js).

Contrôle complet : `npm run verify`. Le fichier d’aperçu `tmp/draft-assistance-20261011/preview.html` utilise les vrais composants avec des données fictives ; ce n’est pas une session d’équipe réelle.
