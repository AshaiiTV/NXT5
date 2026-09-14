# Suppression de compte

Politique technique du 14 septembre 2026. Migration requise :
`account-deletion-20260914-v1`, appliquee par `npm run db:migrate` avec la connexion
de migration habituelle. Les migrations existantes restent immuables. La route
refuse l'operation avec un message de maintenance tant que la migration manque.

## Parcours et garanties

1. Parametres > Supprimer mon compte : presentation des consequences, accord
   explicite, choix d'un nouveau proprietaire par equipe partagee. Le membre
   choisi devient aussi capitaine. Une equipe sans autre membre et toutes ses
   donnees ne sont supprimees qu'avec l'accord distinct affiche dans ce parcours.
2. Le serveur delivre une confirmation aleatoire valable dix minutes, stockee
   sous forme de hash et liee au compte, a la session et aux choix d'equipes.
3. La derniere confirmation exige `SUPPRIMER` et le mot de passe actuel. Les
   controles d'origine, la taille du corps et les quotas IP/compte s'appliquent.
4. La fonction PostgreSQL verrouille le compte et les equipes et revalide les
   choix. Toute erreur annule l'ensemble des changements, y compris la trace.
5. Le succes ferme les sessions, quitte l'espace prive et affiche un recu
   durable a l'ecran. Le meme jeton permet de retrouver le resultat pendant
   24 heures, notamment apres une coupure reseau. Aucun mot de passe n'est
   conserve dans le navigateur. Le jeton en attente est limite a sessionStorage.

## Donnees traitees

- `users` : ligne technique conservee avec `deleted_at`, nom generique, identifiant
  technique, e-mail nul, mot de passe inutilisable, notifications et verification
  desactivees. Les mises a jour de cette ligne sont refusees par la base.
- Sessions, recuperations de mot de passe, rappels d'inactivite, appartenances et
  confirmations de suppression : suppression physique.
- Profils `players` lies au compte : suppression physique ; cascade sur les pools,
  disponibilites, objectifs et notes de coaching. Les participants de match lies
  perdent leurs identifiants affiches, leur payload individuel et le lien joueur.
- Equipes partagees : transfert au membre explicitement choisi, conservation de
  leurs historiques et contenus. Les references d'auteur au compte sont retirees.
- Demandes commerciales : purge par e-mail uniquement si cet e-mail est verifie.
- Anciens journaux rediges par le compte, le ciblant ou contenant son UUID :
  retrait de l'auteur, de la cible et des metadonnees, conservation du type et de
  la date de l'evenement. Les nouvelles references vers un compte desactive sont
  refusees, y compris pour une requete de connexion deja en cours.

## Trace et limites de la purge

Le recu et l'evenement `auth.account_deleted` partagent une reference aleatoire.
Ils contiennent la date, la version de politique et les nombres de lignes/equipes
traitees, sans ancien identifiant de compte, nom, e-mail, IP ou mot de passe.
Les recus de plus de douze mois sont nettoyes lors des preparations suivantes ;
les journaux suivent le nettoyage existant a douze mois. Ce nettoyage est
opportuniste, pas une garantie de purge a une heure precise.

La ligne technique et les anciennes references externes ne constituent pas une
anonymisation irreversiblement garantie de toutes les donnees du produit.
Les payloads bruts de matchs/archives partages, textes libres des rapports,
preuves d'amelioration, compositions, profils joueur non lies au compte, demandes
commerciales avec e-mail non verifie et sauvegardes peuvent encore contenir des
mentions personnelles. Leur nettoyage exige une identification fiable et une
politique de conservation a valider ; le parcours l'annonce avant confirmation.
Aucune purge des sauvegardes, services externes ou journaux d'hebergement n'est
pretendue. Un import ulterieur peut reintroduire un identifiant public Riot.

Les transferts et purges d'equipes sont atomiques avec la suppression : l'arrivee
d'un autre membre dans une equipe promise a la suppression, un successeur parti,
un changement de propriete ou de mot de passe imposent de recommencer le parcours.
