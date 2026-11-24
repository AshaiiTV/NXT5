# Importer : mises à jour automatiques (24/11/2026)

Demande : que l'Importer se mette à jour seul et redémarre, comme les applications Claude ou Codex, sans retéléchargement, sans doublon sur le PC et en gardant le raccourci.

## Fonctionnement (0.5.0)

1. Au démarrage puis toutes les 6 h, l'Importer interroge la publication `nxt5-match-exporter-latest`.
2. Si une version plus récente existe, il télécharge le fichier de sa plateforme dans `userData/updates` et le compare à `SHA256SUMS.txt` publié par `build-importer.yml`. Sans empreinte ou si elle diffère, rien n'est installé.
3. Bannière « Mise à jour vX prête » → « Redémarrer pour mettre à jour ». Si l'utilisateur ferme simplement l'application, la mise à jour s'applique à la fermeture.
4. Un petit script détaché remplace le fichier **au même chemin**, puis relance l'application :
   - Windows (exe portable) : chemin donné par `PORTABLE_EXECUTABLE_FILE`, copie à côté puis `File.Replace` en boucle tant que l'exe est verrouillé, puis `Unblock-File`. Le nom du fichier garde son ancien numéro de version (ex. `NXT5-Importer-Windows-0.4.9.exe` contient la 0.5.1) : c'est voulu pour que les raccourcis restent valides.
   - macOS : extraction `ditto` à côté du `.app`, échange des dossiers avec retour à l'ancien en cas d'échec.
5. Repli sur le bouton « Télécharger » : application lancée depuis un DMG ou en translocation Gatekeeper (non rangée dans Applications), dossier non modifiable, échec réseau ou d'empreinte, mode développement.

Code : `importer-app/src/updater.js`, gestion dans `src/main.js`, bannière dans `src/renderer.js`.

## Vérifié

- Tests unitaires (`importer-app/test/updater.test.mjs`) : empreintes, choix du fichier, refus d'un fichier modifié ou trop gros, chemins passés en arguments au script.
- Remplacement réel d'un faux bundle `.app` par le script macOS.
- Test Electron (24 scénarios), dont le repli « Télécharger » quand l'installation automatique est impossible.

## Non vérifié

- Le script PowerShell n'a pas pu être exécuté depuis le Mac : le premier passage 0.5.0 → 0.5.1 sur un PC Windows servira de test réel.
- Les utilisateurs en 0.4.9 ou avant doivent installer la 0.5.0 à la main une dernière fois.
