# Objectifs joueur : nouvelles mesures et refonte visuelle — 24 novembre 2026

Demande : « rajoute des objectifs et améliore visuellement » (panneau *Objectifs et notes* du profil joueur).

## Nouvelles mesures

En plus des morts, KP, KDA, score de vision et CS à 10 minutes, un objectif peut suivre :

| Mesure | Source Riot | Repli |
| --- | --- | --- |
| Part des dégâts de l’équipe | `challenges.teamDamagePercentage` | — |
| Dégâts aux champions par minute | `challenges.damagePerMinute` | dégâts / durée |
| CS à 15 minutes | timeline (comme CS à 10) | résumé `csMilestones` |
| CS par minute | `cs_per_min` | (sbires + monstres) / durée |
| Or par minute | `challenges.goldPerMinute` | or / durée |
| Score de vision par minute | `challenges.visionScorePerMinute` | vision / durée |
| Balises de contrôle posées | `challenges.controlWardsPlaced` | `visionWardsBoughtInGame` |

Une valeur absente reste « Indisponible » et ne compte jamais comme réussite. La liste blanche de
`netlify/functions/player-goals-manage.ts` accepte ces identifiants ; aucune migration (colonne `metric` libre).

## Suggestions par poste

Trois objectifs prêts à l’emploi par poste (TOP, JGL, MID, ADC, SUP, sinon génériques), visibles par les
responsables dans l’état vide et en tête du formulaire. Un clic pré-remplit le formulaire.

## Visuel

- Compteurs Actifs / En cours / Réussis sous l’en-tête.
- Liseré d’état par objectif et barre de progression (dégradé Signature, vert une fois validé).
- Parties sous forme de tuiles teintées (réussie, manquée, à jouer en pointillés) ; 3 ou 5 parties suivies.
- Formulaire : mesures regroupées (Combat, Ressources, Vision), phrase récapitulative de la cible.
- Mobile vérifié à 375 px : pas de défilement horizontal ni de texte débordant ; mouvement réduit respecté.
