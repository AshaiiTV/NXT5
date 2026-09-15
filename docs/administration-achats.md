# Administration : achats et navigation

La page `/admin` ouvre la synthèse du pilotage. L'administration possède une
navigation unique en trois groupes, définie dans `src/app/admin-navigation.js` :

- **Pilotage** : vue d'ensemble, équipes, usage du produit, fréquentation du site.
- **Ventes et accès** : achats, demandes d'accès, offres et tarifs, préparation de la vente.
- **Configuration** : rappels e-mail et intégrations.

La page `/admin/achats` affiche l'historique des commandes en premier. Le
« Bilan des achats » suit dans une section repliée par défaut ; il regroupe les
indicateurs commerciaux et leur évolution. Les demandes d'accès restent dans
`/admin/demandes-acces` et les offres et tarifs sont dans `/admin/tarifs`.

Les liens historiques `/admin?tab=achats`, `/admin?tab=vue-ensemble` et `/tarifs`
restent utilisables et ouvrent respectivement les achats, la synthèse du pilotage
et les offres et tarifs. Ils ne créent pas de deuxième navigation par onglets.

## Donnees de commandes

Appliquer les migrations avec le processus habituel (`npm run db:migrate`).
La migration `administration-purchases-20260914-v1` cree un historique vide.
L'API `admin-purchases` est en lecture seule, reservee a l'administrateur de
plateforme et ne met pas en cache les reponses. Elle signale une migration
manquante avec une erreur 503, sans afficher de faux historique vide.

Aucune source de paiement n'existe actuellement dans NXT5. L'alimentation de
`purchases` devra etre branchee sur la source de commandes retenue. Aucun
paiement, abonnement ou commande n'est cree a partir des demandes d'acces.
L'interface n'insere aucune donnee de demonstration.

Chaque ligne conserve la reference de commande unique, le nom du client et de
l'equipe, l'offre, le tarif unitaire TTC, la quantite, le montant total TTC en
centimes EUR, le statut et les dates de commande, paiement et remboursement.
Le total est un instantane de la commande (il peut differer du tarif multiplie
par la quantite en cas de remise). Les tarifs proposes actuels ne servent pas
a recalculer les anciennes commandes. La source doit conserver la reference
pour eviter les doublons et mettre a jour `updated_at` avec le statut.
Les remboursements representes par `refunded` sont complets ; les remboursements
partiels et les autres devises demandent une extension du contrat de donnees.

## Calculs

- L'historique est pagine cote serveur, sans fenetre de dates ni plafond global.
- Les filtres texte (reference, client, equipe, offre) et statut ne touchent pas les statistiques.
- Les commandes sont comptees tous statuts confondus.
- Montant et panier moyen utilisent uniquement les commandes actuellement `paid`.
- La frequence est le nombre d'achats `paid` payes dans les 30 derniers jours divise par 30.
- La variation compare ce nombre aux 30 jours precedents. Sans base precedente, aucun pourcentage n'est invente.
- La tendance couvre 12 mois calendaires UTC selon la date de paiement, mois courant partiel inclus.
- Les commandes remboursees sont exclues des statistiques d'achats payes, y compris des periodes passees. Il ne s'agit pas d'un journal comptable des mouvements de tresorerie.

Les petites largeurs affichent chaque commande en carte avec tous ses champs.
La navigation de l'administration utilise une sidebar à partir de 1024 px,
puis un sélecteur natif avec groupes sous ce seuil. Chaque rubrique a son URL,
ce qui permet les liens directs et le retour navigateur ; seule la page active
est montée. Les liens signalent la page courante avec `aria-current`, le focus
rejoint le contenu lors d'un changement de rubrique et le bilan repliable reste
accessible au clavier avec le contrôle natif `details` / `summary`.
