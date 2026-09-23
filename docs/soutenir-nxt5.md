# Soutenir NXT5

La page publique `/soutenir` présente un soutien entièrement facultatif au développement de NXT5. Aucun budget, coût interne, objectif financier, compteur de dons ou montant collecté n’y est publié. Le soutien ne modifie aucun accès ni abonnement NXT5.

## Activation

1. Créer ou choisir la page de soutien du projet sur la plateforme souhaitée. Configurer les contributions ponctuelles et mensuelles sur cette plateforme, avec un montant libre et, si souhaité, des suggestions de 3 €, 5 € et 10 €.
2. Vérifier le bénéficiaire et les deux modes de contribution sur cette page.
3. Définir `VITE_NXT5_SUPPORT_URL` avec son adresse publique HTTPS dans l’environnement de construction, puis reconstruire le site. Cette variable est publique : ne jamais y placer de secret ou de clé de paiement.
4. Vérifier le lien « Soutenir NXT5 » depuis l’accueil et le pied de page, puis le bouton « Soutenir le projet » sur `/soutenir`. Il ouvre la destination configurée dans un nouvel onglet. Le montant, la fréquence, la confirmation et la gestion du soutien restent sur la plateforme.

Sans adresse HTTPS valide, les liens de découverte sont masqués et une visite directe affiche honnêtement que les contributions ne sont pas encore ouvertes. Aucun formulaire de paiement fictif ni confirmation de don n’est affiché. Retirer la variable puis reconstruire permet de fermer l’accès aux contributions.

La page ne charge aucun widget, script ou iframe du prestataire : la plateforme n’est ouverte qu’après activation du lien. NXT5 ne collecte pas de données de paiement et ne prétend pas vérifier les dons.
