# Soutenir NXT5

La page publique `/soutenir` présente un soutien entièrement facultatif au développement de NXT5. Aucun budget, coût interne, objectif financier, compteur de dons ou montant collecté n’y est publié. Le soutien ne modifie aucun accès ni abonnement NXT5.

## Activation

1. La page de soutien validée est [ko-fi.com/nxt5org](https://ko-fi.com/nxt5org). Les contributions ponctuelles et mensuelles sont configurées sur Ko-fi, avec un montant libre et des suggestions de 3 €, 5 € et 10 €.
2. Le compte PayPal du titulaire est relié ; le pays France et les deux modes de contribution ont été vérifiés sans transaction. L’état détaillé figure dans [Page Ko-fi NXT5](kofi-nxt5.md).
3. `netlify.toml` définit `VITE_NXT5_SUPPORT_URL="https://ko-fi.com/nxt5org"` dans `[build.environment]`. La fusion et la construction Netlify publient le lien avec la page ; une modification de configuration nécessite une nouvelle construction. Cette variable est publique : ne jamais y placer de secret ou de clé de paiement.
4. Vérifier le lien « Soutenir NXT5 » depuis l’accueil et le pied de page, puis le bouton « Soutenir le projet » sur `/soutenir`. Il ouvre la destination configurée dans un nouvel onglet. Le montant, la fréquence, la confirmation et la gestion du soutien restent sur la plateforme.

Un serveur Vite lancé directement ne lit pas `netlify.toml` : définir la même variable dans `.env.local` (ignoré par Git) ou dans l’environnement du processus, puis démarrer ou redémarrer Vite. `.env.example` conserve une valeur vide pour rendre ce choix local explicite.

Sans adresse HTTPS valide, les liens de découverte sont masqués et une visite directe affiche honnêtement que les contributions ne sont pas encore ouvertes. Aucun formulaire de paiement fictif ni confirmation de don n’est affiché. Pour fermer les liens sur NXT5, vider `VITE_NXT5_SUPPORT_URL` dans `[build.environment]` de `netlify.toml` puis reconstruire et publier. Retirer la variable fonctionne aussi si aucune autre configuration Netlify ne la définit. En local, vider ou retirer la valeur de `.env.local` ou de l’environnement du processus, puis redémarrer ou reconstruire.

La page ne charge aucun widget, script ou iframe du prestataire : la plateforme n’est ouverte qu’après activation du lien. NXT5 ne collecte pas de données de paiement et ne prétend pas vérifier les dons.
