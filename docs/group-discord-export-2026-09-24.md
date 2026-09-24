# Export Discord des groupes — 24 septembre 2026

Dans le détail d’un groupe, même vide, « Importer une partie » et son dialogue sont masqués. Les liens combinant `archive` et `import=1` respectent cette règle. Le retour à « Tous les groupes » rétablit l’action sans ouvrir le formulaire.

Le propriétaire et le staff peuvent ouvrir « Exporter sur Discord », choisir la destination de publication de l’équipe, préparer le bilan puis confirmer avec « Publier dans #… ». Un seul message contient une synthèse PNG et un lien vers le groupe. Le serveur prend toutes les parties enregistrées, indépendamment de la pagination et des filtres du navigateur. Un groupe vide, incomplet ou contenant des parties exclues par les catégories de la destination est refusé explicitement.

Le PNG réutilise les données factuelles des exports de parties : équipe, groupe, période, victoires/défaites/résultats inconnus et résultat de chaque partie. Il ne contient ni conseils générés ni notes privées. Les grands groupes dépassant 120 parties, 16 000 px de hauteur ou 3 Mio de PNG utilisent un résumé textuel avec lien ; l’aperçu annonce ce repli avant confirmation.

## Fiabilité et déploiement

Les aperçus sont signés, limités à dix minutes et liés à l’utilisateur, l’équipe, le groupe, les données publiques et la configuration du salon. Ces données sont revérifiées immédiatement avant l’envoi. Le bot contrôle ses droits dans le salon et désactive toutes les mentions.

La migration additive `20260924_discord_group_exports.sql`, enregistrée dans le runner, conserve les reçus et les verrous d’envoi. Deux UUID concurrents, un double clic ou une réponse HTTP perdue ne créent pas deux publications identiques. Un groupe modifié permet une nouvelle publication explicite. Un envoi incertain bloque toute nouvelle version vers le même salon jusqu’à confirmation ; « Vérifier l’envoi » recherche le message existant, sans le renvoyer. L’association par identifiant vérifie également le bot, le salon et la référence, même pour un message sorti de l’historique récent. La suppression d’un groupe ou d’une destination conserve le reçu.

La production Netlify applique cette migration après les contrôles et avant la publication du site. Les polices Inter, le logo complet et le module Canvas reprennent la configuration existante. Aucun secret Discord n’est transmis au navigateur.

La [charte unique](../../../2026-05-05/utilise-github-pour-examiner-mes-pr/NXT5/docs/charte-graphique.md) est actualisée à son emplacement canonique ; aucune copie locale n’est créée.
