# Nexus Rising : saisons et formats de tournoi

Préparation locale au 1er novembre 2026. Ce document ne prouve ni un déploiement, ni l’application de migrations à la base en ligne. Le [guide de l’importeur](nexus-rising-importer.md) décrit la collecte, les droits d’accès et le pilote réel restant à effectuer.

## Décisions du projet

- Nexus Rising utilise les comptes, équipes et profils de joueurs NXT5, dans la même base. Une inscription lie une équipe existante à une saison ; elle ne crée pas une deuxième identité d’équipe.
- Pendant la préouverture demandée le 1er novembre, visiteurs et comptes non administrateurs voient « Coming soon ». Seule l’administration NXT5 utilisée par Ashaii accède au portail et aux inscriptions. Le modèle invité/membre prévu pour l’ouverture est conservé dans le code, mais n’est pas accessible pendant cette phase ; voir les [règles d’accès](nexus-rising-importer.md#accès-décidés).
- Le même importeur NXT5 fournit les résultats des customs. Le code de liaison Nexus est un accès à une rencontre ; ce n’est pas un code de tournoi Riot et il ne crée pas le lobby LoL.
- Le format de tournoi est configurable. Les modèles Nexus Rising ne constituent pas une décision sur le format définitif de la Saison I.

## Ce que publie le site de la ligue

Sources consultées le 1er novembre 2026 : [accueil Saison I](https://nexus-rising.netlify.app/), [saison bêta et tableau actuel](https://nexus-rising.netlify.app/saison), [règlement PDF de la bêta](https://nexus-rising.netlify.app/reglement-nexus-rising.pdf).

L’accueil annonce janvier 2027 et plusieurs ligues par niveau envisagées. Il indique encore que le format doit être dévoilé le 1er novembre. Il ne fixe pas, dans le contenu récupéré, le nombre d’équipes ou les règles détaillées de la Saison I.

La bêta réunit six équipes dans une division : aller simple en BO3, quinze séries, puis playoffs à double élimination pour les six équipes. Le classement repose sur les victoires, puis la confrontation directe, la différence de games et un éventuel BO1 de départage organisé par le staff.

Le tableau actuel et le PDF présentent deux variantes différentes :

| Règle | Tableau actuellement publié | PDF de la bêta |
| --- | --- | --- |
| Demi-finales hautes | Le premier choisit le troisième ou le quatrième | Premier contre quatrième, deuxième contre troisième |
| Entrée du bracket bas | Sixième contre perdant de la première demi-finale ; cinquième contre perdant de la seconde | Cinquième contre sixième, puis les perdants des demi-finales successivement |
| Finale haute | BO3 dans les données du tableau | BO5 |
| Finale basse et grande finale | BO5 | BO5 |

Aucun match de remise à zéro de la grande finale n’est décrit dans ces deux modèles. Ils ne doivent pas être confondus avec une double élimination standard qui peut prévoir cette seconde finale.

Le PDF prévoit encore des codes de tournoi Riot. La demande du projet remplace ce flux technique par une collecte via l’importeur NXT5. Le règlement public devra être harmonisé avant ouverture ; le développement local ne modifie pas ce PDF.

## Exploitation

### Formats disponibles

| Famille | Réglages et progression |
| --- | --- |
| Championnat | 2 à 32 équipes, aller simple ou aller-retour, journées et exemptions générées, playoffs facultatifs |
| Poules | Répartition en poules, aller simple ou retour, classement séparé et nombre de qualifiés par poule |
| Élimination simple | Tableau de 2, 4, 8 ou 16 équipes, seeds explicitement choisis, vainqueurs transmis au tour suivant |
| Double élimination standard | 4, 8 ou 16 équipes, tableau haut et bas, seconde grande finale facultative si le vainqueur du tableau bas gagne la première |
| Double élimination Nexus | Deux variantes à 6 équipes : tableau actuellement publié ou chemin du PDF, choix du premier adversaire et BO des finales |
| Rondes suisses | 2 à 32 équipes, rondes successives, équipes proches au classement, aucun adversaire répété, exemption pour un effectif impair |
| Calendrier libre | Rencontres choisies par le staff entre équipes approuvées, BO et journée propres ; une équipe joue au plus une rencontre par journée |

Les séries utilisent BO1, BO3 ou BO5. Le BO de la phase régulière, des playoffs et de la finale est réglable ; les deux variantes Nexus conservent leurs demi-finales et premiers tours du bas en BO3. Les playoffs après championnat, poules ou rondes suisses réutilisent les mêmes tableaux. Un calendrier libre peut servir à organiser d’autres formats, mais ne calcule pas de règles de progression arbitraires.

La ronde suisse suivante n’est créée qu’après validation de toutes les séries de la précédente. L’exemption donne les points d’une victoire, sans inventer une game ni des statistiques, et est attribuée à une équipe n’en ayant pas déjà bénéficié. Une demande répétée avec le même numéro de ronde retourne la ronde existante. Les appariements ne prétendent pas implémenter le règlement suisse FIDE ou un autre standard sportif spécialisé.

Si l’algorithme ne trouve pas d’appariement sans revanche dans sa limite de recherche, la génération est bloquée et aucune rencontre partielle n’est enregistrée. Ce blocage ne prouve pas une impossibilité mathématique ; le staff doit examiner la situation.

Le classement utilise trois points par victoire et zéro par défaite. Les modèles Nexus ajoutent la confrontation directe puis la différence de games ; les autres formats conservent les ex æquo à égalité de points. Pour plusieurs équipes à égalité dans un modèle Nexus, la confrontation directe est un mini-classement de leurs confrontations complètes, sans réapplication récursive après séparation du groupe. Cette interprétation est à harmoniser avec le règlement de saison ; une égalité restante requiert le staff.

### Équipes et résultats

Une saison suit les étapes brouillon, inscriptions ouvertes, compétition, puis terminée. Le staff confirme les paramètres avant ouverture. La génération du calendrier fige le format et les équipes approuvées ; elle peut être répétée sans créer les rencontres en double.

Le propriétaire, un capitaine ou un manager peut inscrire son équipe NXT5. Le staff examine son éligibilité et son effectif. Les critères de niveau ne sont pas déduits automatiquement d’un classement Riot non vérifié. Chaque rencontre conserve ses cinq profils de chaque côté pour que l’historique survive aux changements d’effectif.

L’inscription accepte cinq à huit joueurs actifs, hors profils de staff non joueurs. Un même compte Riot ne peut appartenir à deux équipes approuvées dans la saison, y compris après un changement d’effectif. Le staff valide explicitement les mises à jour d’effectif ; les anciennes compositions de rencontre restent conservées.

Seules les contributions acceptées comptent dans une série. Une game ne peut être acceptée qu’une fois dans la ligue. Une série incomplète n’a pas de vainqueur ; des données contradictoires ne sont pas transformées en résultat arbitraire. Les statistiques manquantes restent absentes.

Une égalité non résolue ne qualifie pas automatiquement l’équipe dont le nom apparaît en premier. Le staff doit établir les seeds et documenter les départages restants. Les corrections susceptibles de changer les participants d’une rencontre déjà liée à un importeur ou ayant reçu des parties sont bloquées.

## Vérification avant mise en service

1. Exécuter les migrations Nexus dans l’ordre, sur une base de préparation. Une ancienne partie acceptée dans deux rencontres doit être examinée avant la contrainte d’unicité globale ; la migration ne supprime pas ces preuves.
2. Créer une saison de préparation avec de vraies équipes NXT5 de test, vérifier inscriptions, approbations, compositions, calendrier et accès invité/membre/staff.
3. Effectuer le pilote importeur décrit dans le guide : customs, deux capitaines, réseau interrompu, reprise, révocation et comparaison aux écrans de fin de partie.
4. Réconcilier le règlement public, les paramètres de saison et les règles d’arbitrage, puis fixer les durées de conservation avant ouverture.

Les tests locaux vérifient les algorithmes et les transactions sur une base PostgreSQL embarquée. Ils ne constituent pas une preuve de comportement du client LoL, de Vanguard ou du serveur déployé.
