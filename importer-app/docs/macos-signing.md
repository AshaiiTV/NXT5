# Signature et notarisation macOS

Les versions macOS distribuées de NXT5 Importer doivent porter une signature **Developer ID Application**, utiliser Hardened Runtime, être acceptées par le service de notarisation Apple et contenir le ticket Apple agrafé à l’application. Cela traite le blocage « Apple ne peut pas vérifier que l’app est exempte de logiciels malveillants ». La confirmation normale d’ouverture d’une application téléchargée peut subsister.

Cette configuration prépare les prochaines publications. Elle ne modifie pas les ZIP déjà téléchargés et ne constitue pas, à elle seule, une notarisation réussie. Une publication reste bloquée tant que les accès Apple ne sont pas configurés ou que les vérifications échouent.

## Prérequis Apple

1. Disposer d’un abonnement [Apple Developer Program](https://developer.apple.com/programs/enroll/) actif. Apple annonce 99 USD par an, avec tarification locale au moment de l’inscription.
2. Créer un certificat **Developer ID Application** dans le [compte Apple Developer](https://developer.apple.com/account/resources/certificates/list), à partir d’une demande de certificat produite dans Trousseaux d’accès. Installer le certificat sur le Mac qui possède la clé privée de cette demande. Choisir Developer ID Application pour distribuer l’application hors Mac App Store.
3. Dans Trousseaux d’accès → Mes certificats, exporter ce certificat **avec sa clé privée** au format `.p12`, protégé par un mot de passe. Le certificat `.cer` seul ne suffit pas à signer.
4. Relever le Team ID dans le compte développeur et créer un [mot de passe pour application](https://support.apple.com/102654) pour la notarisation. Le mot de passe habituel du compte Apple n’est pas utilisé.

L’inscription, la validation d’identité et les éventuelles étapes de double authentification appartiennent au titulaire du compte. Conserver les clés privées et mots de passe dans le trousseau ou les secrets GitHub ; ne pas les placer dans les fichiers du projet ni dans une discussion.

## Activer les publications GitHub

Dans [Settings → Secrets and variables → Actions](https://github.com/AshaiiTV/NXT5/settings/secrets/actions), renseigner :

| Secret du dépôt | Contenu |
| --- | --- |
| `MAC_CSC_LINK` | Le fichier `.p12` encodé en base64 ; transmis à electron-builder sous le nom `CSC_LINK`. |
| `MAC_CSC_KEY_PASSWORD` | Le mot de passe d’export du `.p12` ; transmis sous le nom `CSC_KEY_PASSWORD`. |
| `APPLE_ID` | L’adresse du compte Apple autorisé pour l’équipe développeur. |
| `APPLE_APP_SPECIFIC_PASSWORD` | Le mot de passe pour application créé pour la notarisation. |
| `APPLE_TEAM_ID` | Le Team ID du compte développeur. |

Pour préparer le contenu de `MAC_CSC_LINK` sans l’afficher dans le terminal, adapter le chemin puis coller le résultat dans le secret GitHub :

```sh
base64 -i "/chemin/prive/Developer-ID-Application.p12" | pbcopy
```

Après configuration des secrets et intégration du changement sur `main`, le workflow **Build NXT5 Importer** publie uniquement si les tests web, le build Windows et les deux archives macOS ont réussi. Un lancement manuel sur `main` est possible depuis Actions. Les secrets Apple sont exposés uniquement à l’étape de signature sur `main` ; les pull requests et lancements sur une autre branche produisent des aperçus ad hoc distincts.

La vérification macOS exige, sur une copie extraite du ZIP final :

- une signature valide sur l’application et son code imbriqué (`codesign --verify --deep --strict`) ;
- une identité Developer ID Application et Hardened Runtime ;
- un ticket attaché valide (`xcrun stapler validate`) ;
- l’acceptation par Gatekeeper (`spctl --assess --type execute`).

Une erreur arrête le job avant le dépôt de l’artefact de release et bloque la publication. Les aperçus ne peuvent pas remplacer les archives de release. La release existante reste disponible en cas d’échec.

## Construire sur un Mac

Avec le certificat et sa clé privée installés, cette commande doit montrer une identité Developer ID Application valide :

```sh
security find-identity -v -p codesigning
```

Pour la notarisation locale, enregistrer les identifiants dans le trousseau via l’invite interactive de `notarytool` :

```sh
xcrun notarytool store-credentials nxt5-notary
```

Puis, depuis `importer-app` :

```sh
pnpm install --frozen-lockfile
APPLE_KEYCHAIN_PROFILE=nxt5-notary pnpm run dist:mac
APPLE_KEYCHAIN_PROFILE=nxt5-notary pnpm run dist:mac:arm
```

`APPLE_KEYCHAIN` peut désigner un trousseau spécifique. Il est aussi possible d’utiliser les trois variables `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`, ou une clé API d’équipe App Store Connect via `APPLE_API_KEY`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER`. Avec electron-builder 26, `APPLE_API_KEY` doit désigner un **fichier `.p8` lisible**, pas son contenu base64. Éviter de mélanger plusieurs méthodes : les variables Apple ID ont priorité, puis la clé API, puis le profil de trousseau.

Les commandes `dist:mac` et `dist:mac:arm` refusent de construire sans accès de notarisation. La signature est obligatoire. Electron-builder signe et notarise l’application puis agrafe le ticket ; le script crée le ZIP avec `ditto`, l’extrait, vérifie cette copie et conserve l’archive dans `release/`.

Pour compiler un aperçu de développement sans compte Apple :

```sh
pnpm run dist:mac:preview
# Une seule architecture : pnpm run dist:mac:preview arm64
```

Ces aperçus sont signés ad hoc, sans notarisation, et placés dans `release-preview/`. Ils ne résolvent pas l’alerte Gatekeeper et ne sont pas publiés par le workflow. L’entitlement `allow-jit` est conservé pour le moteur JavaScript Electron ; les versions de distribution n’ajoutent pas d’exception de validation des bibliothèques.

## Références

- [Apple : Developer ID](https://developer.apple.com/developer-id/)
- [Apple : notarisation et distribution ZIP](https://developer.apple.com/documentation/security/customizing-the-notarization-workflow)
- [Electron Builder 26 : configuration macOS](https://www.electron.build/v26/docs/mac/)
- [Electron Notarize : prérequis](https://github.com/electron/notarize#prerequisites)
