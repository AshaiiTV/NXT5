# NXT5 : Shopify, réseaux et préparation juridique

Document de travail du 14 septembre 2026. Hypothèse : une micro-entreprise française exploite NXT5, service numérique par abonnement, vendu éventuellement à des particuliers. Confirmer cette qualification, les pays servis et la clientèle avant publication des contrats. Cette liste prépare la mise en vente ; elle ne constitue pas des CGV validées.

## Livré et activation technique

- Page publique `/reseaux`, accessible sans compte depuis le pied de page ; liens HTTPS ouverts dans un nouvel onglet.
- Écran administrateur `/admin/integrations` : état de configuration et test réel de connexion.
- Endpoint `/.netlify/functions/admin-shopify` : GET affiche la configuration non secrète ; POST interroge Shopify après contrôle de la session administrateur et de l’origine.
- Lecture du nom, du domaine et de la devise uniquement. Aucun client, paiement, commande ou droit d’accès NXT5 n’est synchronisé par ce connecteur.
- Les identifiants réels et la connexion à la boutique restent à fournir et à vérifier. Un statut « Prêt à tester » ne signifie pas que la connexion a réussi.

### Relier la boutique

1. Dans le Dev Dashboard Shopify, créer une application appartenant à la même organisation que la boutique NXT5. Publier sa version et l’installer sur cette boutique.
2. Utiliser le flux `client_credentials`. Une simple autorisation collaborateur sur une boutique tierce ne suffit pas. Une application destinée à d’autres marchands nécessiterait un autre flux OAuth.
3. Garder les permissions minimales : la requête utilise uniquement `shop { name myshopifyDomain currencyCode }`. Ne pas demander d’accès aux clients, commandes ou écritures pour ce test.
4. Ajouter les variables ci-dessous sur Netlify, dans le contexte du site concerné et le périmètre Functions. Garder les secrets hors du dépôt et hors des variables `VITE_*`.
5. Redéployer, ouvrir `/admin/integrations` avec le compte administrateur configuré et cliquer sur « Tester la connexion ». Le résultat indique la boutique et l’heure du contrôle.

| Variable serveur | Valeur attendue |
| --- | --- |
| `SHOPIFY_SHOP_DOMAIN` | Domaine exact `nom.myshopify.com`, sans `https://`, chemin ni domaine personnalisé |
| `SHOPIFY_CLIENT_ID` | Identifiant de l’application installée |
| `SHOPIFY_CLIENT_SECRET` | Secret de cette application, renseigné uniquement sur le serveur |
| `SHOPIFY_API_VERSION` | Facultatif, `2026-07` par défaut ; maintenir une version stable prise en charge |

Le jeton temporaire reste en mémoire serveur, est renouvelé à l’expiration et une fois après un refus HTTP 401. Le diagnostic impose un délai global de 12 secondes. Les réponses Shopify brutes et les secrets ne sont pas envoyés au navigateur. Les permissions et l’authentification existantes NXT5 restent nécessaires.

Références : [authentification Shopify pour sa propre organisation](https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/client-credentials-grant), [requête shop](https://shopify.dev/docs/api/admin-graphql/latest/queries/shop).

### Liens sociaux

Le Discord déjà présent dans NXT5 est utilisé par défaut. Pour ajouter les autres comptes officiels, renseigner leurs URL de profil HTTPS dans les variables de build Netlify, puis reconstruire le site :

```dotenv
VITE_SOCIAL_INSTAGRAM_URL=
VITE_SOCIAL_YOUTUBE_URL=
VITE_SOCIAL_TWITCH_URL=
VITE_SOCIAL_TIKTOK_URL=
VITE_SOCIAL_X_URL=
# Facultatif : remplace l'invitation Discord existante.
VITE_SOCIAL_DISCORD_URL=
```

Les liens absents ou invalides sont omis. Aucun pseudo n’est inventé. Les domaines sont limités à chaque plateforme ; aucun widget ni pixel social n’est chargé par cette page.

## Informations à réunir côté micro-entreprise

| À compléter | Utilisation |
| --- | --- |
| Nom de famille, prénoms et mention « Entrepreneur individuel » ou « EI » | Identité du vendeur ; NXT5 est le nom commercial, pas une identité juridique suffisante |
| Adresse de domiciliation professionnelle complète | Mentions légales, CGV, factures ; prévoir une domiciliation adaptée si nécessaire |
| SIREN (9 chiffres), SIRET de l’établissement (14 chiffres), justificatif d’immatriculation | Identification et configuration de l’activité |
| Inscription au RNE et, si activité commerciale, RCS et ville du greffe | Vérifier selon l’activité déclarée ; code APE pour le dossier administratif |
| E-mail professionnel et téléphone de contact | Service client, réclamations, rétractation |
| Responsable de publication et hébergeur de chaque site | Mettre à jour les mentions NXT5 et celles de la boutique : nom, adresse, coordonnées de l’hébergeur |
| Régime de TVA et numéro de TVA si attribué | Paramétrage fiscal et mentions de facturation |
| Coordonnées du médiateur retenu et modalités de saisine | CGV, site et gestion des réclamations B2C |

Les obligations de publication ne se confondent pas avec les justificatifs à transmettre aux prestataires. Source : [mentions obligatoires d’un entrepreneur individuel](https://entreprendre.service-public.gouv.fr/vosdroits/F31228).

- [ ] Confirmer la franchise en base ou l’assujettissement à la TVA. La mention « TVA non applicable - article 293 B du CGI » ne s’utilise que si la franchise s’applique. Faire préciser le traitement des ventes hors France avant de les ouvrir. [Fiscalité du micro-entrepreneur](https://entreprendre.service-public.gouv.fr/vosdroits/F36244).
- [ ] Préparer pour Shopify Payments : identité et date de naissance, justificatif de domicile si demandé, preuve d’activité/immatriculation et compte bancaire éligible avec IBAN/titulaire concordants. Transmettre les documents uniquement dans l’interface Shopify, jamais dans le code ni sur une page publique. Vérifier l’éligibilité territoriale et les exigences exactes de l’activité. [Exigences Shopify Payments France](https://help.shopify.com/fr/manual/payments/shopify-payments/supported-countries/france/requirements).

## Documents et parcours à finaliser

- [ ] **Mentions légales** : remplacer la présentation actuelle « éditeur non professionnel » par l’identité professionnelle réelle. Harmoniser NXT5 et Shopify après validation des données.
- [ ] **CGV de l’offre** : fixer la clientèle B2C/B2B, le titulaire de l’abonnement (joueur, responsable d’équipe ou structure), les fonctionnalités et limites, le prix final, la périodicité, les frais, l’engagement, le renouvellement, la suspension, la résiliation, le support et le règlement des litiges. Adapter les clauses B2B si nécessaire. Les CGU actuelles ne remplacent pas les CGV. [CGV : Service Public](https://entreprendre.service-public.gouv.fr/vosdroits/F33527).
- [ ] **Contrat client** : faire valider les CGV et les conditions particulières éventuelles (devis/bon de commande pour une structure, périmètre et titulaire des accès). Prévoir une preuve d’acceptation datée et une confirmation conservable. Une signature séparée n’est pas automatiquement nécessaire pour chaque achat en ligne. [Conclusion du contrat à distance](https://www.service-public.gouv.fr/particuliers/vosdroits/F10488).
- [ ] **CGU et garanties numériques** : retirer les déclarations de gratuité devenues inexactes, préciser prérequis, compatibilité, mises à jour et maintien du service ; intégrer les informations et encadrés de garantie applicables. Coordonner toute nouvelle version de CGU avec le mécanisme d’acceptation de l’application. [Information précontractuelle](https://www.service-public.gouv.fr/particuliers/vosdroits/F10483), [garantie de conformité](https://www.service-public.gouv.fr/particuliers/vosdroits/F11094).
- [ ] **Médiation B2C** : choisir un médiateur compétent, conclure la convention nécessaire et afficher ses coordonnées et son site. Ne pas annoncer un organisme sans avoir vérifié la couverture de l’activité. [Médiation de la consommation](https://entreprendre.service-public.gouv.fr/vosdroits/F33338).
- [ ] **Contrats prestataires** : examiner les conditions Shopify/Shopify Payments, les accords de traitement des données et ceux des applications installées ; clarifier aussi les droits de marque, contenus et prestations sous-traitées.

### Rétractation, remboursements et retours

- [ ] **Service numérique NXT5** : prévoir le droit de rétractation de 14 jours et le formulaire type. L’ouverture immédiate d’un compte n’annule pas automatiquement ce droit.
- [ ] Distinguer un service démarré à la demande expresse du client, un service totalement exécuté et un contenu numérique sans support matériel. Toute exception doit respecter ses propres conditions d’accord, de reconnaissance et de confirmation. Faire valider le cas NXT5 avant d’ajouter une renonciation au paiement.
- [ ] Définir contact, procédure, délai et moyen de remboursement ; distinguer droit légal et geste commercial. Prévoir le traitement du service déjà exécuté si les conditions légales l’autorisent, ainsi que la fin des accès après remboursement.
- [ ] **Si produits physiques** : ajouter adresse de retour, modalités, frais annoncés avant achat, délais, exceptions autorisées et traitement des défauts. Les conditions commerciales de retour ne doivent pas neutraliser les garanties légales.

Source : [rétractation pour un achat à distance](https://www.service-public.gouv.fr/particuliers/vosdroits/F10485).

- [ ] Prévoir le parcours en ligne permettant l’exercice de la rétractation et faire confirmer les règles applicables à la date de mise en vente. [Code de la consommation, article L221-21](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000053310520/2026-06-19).
- [ ] Pour l’abonnement souscrit en ligne, fournir la fonctionnalité de résiliation facilement accessible et sa confirmation ; elle ne se confond pas avec la rétractation. [Résiliation en trois clics](https://entreprendre.service-public.gouv.fr/actualites/A16599).

### Confidentialité et cookies

- [ ] Remplacer l’identité du responsable de traitement par celle de l’exploitant réel. Décrire les données et finalités de chaque flux effectivement activé : commande, facture, paiement, accès, support, fraude et éventuelle prospection.
- [ ] Documenter chaque base légale, les destinataires, Shopify et les autres prestataires, les transferts internationaux, garanties associées, durées, droits et point de contact. Prévoir l’exercice des droits et la réclamation CNIL. Ne pas présenter toutes les finalités comme reposant sur le consentement.
- [ ] Distinguer les données actives des archives légales ; fixer les durées par finalité, notamment pour les factures et preuves contractuelles.

Sources : [information des personnes](https://www.cnil.fr/fr/conformite-rgpd-information-des-personnes-et-transparence), [durées de conservation](https://cnil.fr/fr/passer-laction/les-durees-de-conservation-des-donnees).

- [ ] Inventorier les traceurs réellement chargés sur NXT5 et Shopify. Si des traceurs non nécessaires sont ajoutés, prévoir consentement préalable, refus et retrait accessibles ; mettre à jour la politique cookies. La page Réseaux se limite à des liens sortants. [Cookies : règles applicables](https://www.cnil.fr/fr/cookies-et-autres-traceurs/regles/cookies/que-dit-la-loi).

## Travail restant avant une vente opérationnelle

1. Fournir le domaine Shopify, créer/installer l’application et configurer ses secrets ; obtenir un diagnostic réussi sur la boutique réelle.
2. Compléter l’identité professionnelle et faire valider les documents ci-dessus ; publier les politiques dans Shopify et sur NXT5 avec des liens accessibles avant paiement.
3. Définir les produits/variantes, prix et éventuels plans d’abonnement ; choisir leur correspondance avec les accès d’une équipe NXT5.
4. Implémenter la liaison commandes/équipes et les événements Shopify nécessaires : vérification de signature, traitement idempotent, renouvellement, impayé, annulation et remboursement. Le connecteur de diagnostic ne réalise pas cette automatisation.
5. Configurer paiement, fiscalité, facturation, politiques et e-mails transactionnels. Préparer les informations de livraison uniquement si des biens physiques sont vendus.
6. Effectuer une commande de test jusqu’à la facture et aux accès, puis tester échec de paiement, remboursement, rétractation et résiliation. Vérifier également les liens sociaux officiels et le parcours mobile.
7. Ouvrir les ventes après ces étapes. Le statut technique de connexion ne constitue pas une validation juridique.
