# Clarté des autres pages — 24 septembre 2026

Cette passe prolonge la simplification validée dans la PR #73 : français direct, intention visible, action principale identifiable et détails progressifs. Elle conserve l’identité NXT5 et ses composants. La [charte unique](../../../2026-05-05/utilise-github-pour-examiner-mes-pr/NXT5/docs/charte-graphique.md) a été actualisée dans son emplacement canonique, sans copie dans ce checkout.

## Périmètre livré

| Espace | Évolution |
| --- | --- |
| Planning | Disponibilités et ajout de séance distingués ; sauvegarde automatique visible avant la grille ; raccourcis et légende repliables ; Entraînement, Match et Débrief explicités. |
| Draft — champions | « Champions des joueurs », niveaux de maîtrise expliqués, action d’ajout qui place le focus dans le catalogue ; contrôles lisibles sur mobile. |
| Draft — compositions | Sélecteur direct de champion pour chaque rôle, prérequis d’enregistrement proches du bouton, portraits et analyses secondaires repliables, Modifier et Dupliquer explicites. |
| Profil | Point à travailler et prochaine action avant les indicateurs ; KP/CS expliqués ; distinction entre Champions (résultats) et Champions déclarés (maîtrise préparée). |
| Analyses | Une piste de débrief en premier ; plan récurrent, rôles, vigilances, compositions et observations secondaires à ouvrir ; Évolution, Comparer, Champions et Objectifs clarifiés. Les objectifs de rôle distinguent l’écart de CS face à l’adversaire des quantités individuelles. |
| Paramètres | Identité en premier, mot de passe et affichage repliables, abonnement ensuite. Les formulaires restent montés pour conserver les valeurs et erreurs lors du repli. |
| Discord | Connexion et prérequis expliqués en étapes ; Parties et Débriefs dans les explications. Commandes, autorisations, salons et publications conservés. |
| Administration | « Comptes et abonnements », intentions des tableaux de bord, termes joueurs/encadrement, libellés d’usage, fréquentation et exports harmonisés. Le filtre « Sans profils » compte bien aussi l’encadrement. |
| Pages publiques | Contact, soutien et descriptions des offres plus directs. Prix, conditions et restrictions identiques. |
| Aide et chargement | Réponses et suggestions alignées sur les chemins et mots visibles ; anciens mots-clés conservés pour les recherches. Chargement harmonisé avec Parties et Débriefs. |

Les pages administratives déjà explicites (intégrations, achats, demandes d’accès, préparation à la vente) ont été relues et leurs structures conservées. Les textes juridiques ne changent pas. Les observations générées sont adaptées à l’affichage : données, calculs, sources, exports et contenus écrits par les utilisateurs ne sont pas réécrits.

## Compatibilité avec les évolutions récentes

La branche part de `41bb2d6` et intègre `d888777` de `main`, notamment les PR #74 et #75. Le groupe Bot conserve ses pages distinctes Publications et Statistiques. Le bouton et le dialogue « Exporter sur Discord » restent alignés. L’import demeure accessible depuis la bibliothèque des parties, sans réapparaître dans le détail.

## Vérification locale

Le contrôle utilise les vrais composants et le cadre complet de l’application, avec des réponses API fictives interceptées avant le démarrage. Les modifications réseau sont bloquées dans ce banc local ; aucune publication Discord, aucun paiement et aucun changement de compte réel n’ont été effectués.

- Contrôle navigateur aux largeurs 360, 390, 768, 1024 et 1440 px : Paramètres, Discord en staff et membre, Contact, Soutien, Comptes et abonnements, vue d’ensemble admin, fréquentation, statistiques du bot ; cinq rubriques Analyses contrôlées également, sans débordement horizontal global dans les mesures relevées.
- Planning et Draft : lecture mobile, passage à Ajouter une séance, accès direct au catalogue, saisie locale d’un nom et sélection d’un champion, ouverture des portraits au clavier. La composition conserve le choix lors de l’ouverture des détails.
- Profil : lecture de la synthèse sur mobile, navigation des cinq rubriques par le sélecteur natif, piste avant les chiffres et définitions visibles.
- Paramètres : ouverture et fermeture au clavier du volet mot de passe ; les tests automatisés couvrent conservation des champs pendant l’erreur, nouvel essai et nettoyage après succès.
- Après intégration de `main`, la page Statistiques du bot affiche bien le nouveau menu Bot, sans remonter le formulaire Publications.

Le navigateur de contrôle a rencontré des délais techniques en fin de session. Les contrôles complémentaires des écrans vides, des tarifs et de certains rendus finaux n’ont pas tous été achevés dans le navigateur ; les tests de composants, navigation et permissions complètent cette couverture. Les illustrations externes peuvent afficher leur solution de secours dans le banc local. Il ne s’agit ni d’une mesure de compréhension auprès de débutants, ni d’une certification de toutes les opérations en production.

## Tests

Les tests ajoutés vérifient des comportements : focus du catalogue sans modification réseau, choix de champion et joueur, prérequis, conservation des choix, ordre de la synthèse du profil, accès aux sources et absence de mutation des données, distinction des objectifs en quantité ou en écart, réponses d’aide sur les nouveaux termes et déroulement du changement de mot de passe.

La première passe complète a révélé deux assertions sur les anciens libellés, corrigées, et un dépassement du délai par défaut de 5 secondes dans les migrations. Les trois suites concernées ont ensuite réussi en série (54 tests). Un nouveau contrôle complet est exécuté après l’intégration de `main`, avec deux workers et un délai de test de 30 secondes pour cette machine ; ces options ne modifient pas la configuration du projet.

Résultat final après intégration de `main` : **typecheck réussi, 111 suites et 1 869 tests réussis, build de production réussi, `git diff --check` propre**. Commandes : `npm run typecheck`, `npm test -- --maxWorkers=2 --testTimeout=30000`, `npm run build`. La branche est préparée pour revue ; cette passe n’effectue pas de mise en production.
