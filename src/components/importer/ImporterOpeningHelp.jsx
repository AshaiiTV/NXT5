import { useLanguage } from "../../i18n/useLanguage.js";
import { t } from "../../i18n/translate.js";
import React, { useId, useState } from "react";
import { ExternalLink, Laptop, Monitor } from "lucide-react";
import { Button } from "../ui/Core.jsx";
import { GameOperationDialog } from "../games/GameOperationDialog.jsx";
import "./importer-opening-help.css";

const systems = [
  { id: "windows", label: "Windows", icon: Monitor },
  { id: "mac", label: "macOS", icon: Laptop },
];

export function ImporterOpeningHelp({ initialPlatform, onClose, returnFocusRef }) {
  useLanguage();
  const [platform, setPlatform] = useState(initialPlatform);
  const id = useId();
  const mac = platform === "mac";
  const officialHelp = mac
    ? "https://support.apple.com/fr-fr/102445"
    : "https://learn.microsoft.com/fr-fr/windows/apps/package-and-deploy/smartscreen-reputation";

  function switchWithKeyboard(event) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home" ? "windows" : event.key === "End" ? "mac" : mac ? "windows" : "mac";
    setPlatform(next);
    event.currentTarget.querySelector(`[data-platform="${next}"]`)?.focus();
  }

  return <GameOperationDialog title={t("Ouvrir NXT5 Importer")} description={t("Les étapes à suivre si ton ordinateur affiche une alerte au premier lancement.")} onClose={onClose} returnFocusRef={returnFocusRef} compact className="importer-opening-dialog">
    <div className="importer-opening-help">
      <div className="importer-help-tabs" role="tablist" aria-label={t("Système d’exploitation")} onKeyDown={switchWithKeyboard}>
        {systems.map(({ id: system, label, icon: Icon }) => <Button key={system} type="button" variant="ghost" icon={Icon} role="tab" id={`${id}-${system}-tab`} data-platform={system} aria-selected={platform === system} aria-controls={`${id}-panel`} tabIndex={platform === system ? 0 : -1} onClick={() => setPlatform(system)}>{t(label)}</Button>)}
      </div>

      <section role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${platform}-tab`} tabIndex={0} className="importer-help-content">
        <p className="importer-help-eyebrow">{mac ? t("Vérification Apple") : t("Microsoft Defender SmartScreen")}</p>
        <h3>{mac ? t("Apple ne peut pas vérifier l’app") : t("Windows a protégé votre ordinateur")}</h3>
        <p>{mac ? t("La version Mac de NXT5 Importer n’est pas encore notarisée par Apple. macOS peut donc indiquer qu’il ne peut pas vérifier si l’app contient un logiciel malveillant.") : t("SmartScreen vérifie la signature et la réputation du fichier téléchargé. Si l’éditeur ou cette version de NXT5 Importer n’est pas encore reconnu, Windows peut afficher cet avertissement.")}</p>
        <p>{t("Ces étapes concernent le fichier téléchargé depuis NXT5 et le message décrit ci-dessus.")}</p>

        {mac ? <ol key="mac" className="importer-help-steps">
          <li>{t("Extrais le fichier ZIP, puis ouvre ")}<strong>{t("NXT5 Importer")}</strong>.</li>
          <li>{t("Si l’alerte de vérification Apple apparaît, ferme le message.")}</li>
          <li>{t("Ouvre ")}<strong>{t("Réglages Système → Confidentialité et sécurité")}</strong>.</li>
          <li>{t("Dans la section Sécurité, clique sur ")}<strong>{t("Ouvrir quand même")}</strong>{t(", puis confirme avec ")}<strong>{t("Ouvrir")}</strong>{t(". Authentifie-toi si macOS le demande.")}</li>
        </ol> : <ol key="windows" className="importer-help-steps">
          <li>{t("Ouvre le fichier ")}<strong>{t(".exe de NXT5 Importer")}</strong>{t(" téléchargé.")}</li>
          <li>{t("Si « Windows a protégé votre ordinateur » apparaît, clique sur ")}<strong>{t("Informations complémentaires")}</strong>.</li>
          <li>{t("Vérifie que le fichier correspond à NXT5 Importer, puis clique sur ")}<strong>{t("Exécuter quand même")}</strong>{t(", si ce bouton est proposé.")}</li>
        </ol>}
        <p className="importer-help-note">{mac ? t("macOS mémorise cette autorisation pour l’application. Une autre version peut demander une nouvelle validation.") : t("L’absence de réputation ne prouve ni la présence ni l’absence d’un virus.")}</p>
      </section>

      <details className="importer-help-other" key={platform}>
        <summary>{t("Mon message est différent ou le bouton manque")}</summary>
        <p>{t("Si une menace précise est détectée, si l’app est signalée comme endommagée ou si l’ouverture reste bloquée, arrête-toi ici. Smart App Control ou les règles d’un ordinateur géré peuvent aussi empêcher l’ouverture.")}</p>
        <p>{t("Contacte l’équipe avec ton système, le nom du fichier et le texte exact de l’alerte. Garde l’antivirus et les protections du système activés.")}</p>
        <a href="/reseaux#contact" target="_blank" rel="noopener noreferrer" className="importer-help-link">{t("Contacter NXT5 ")}<ExternalLink aria-hidden="true" size={14} /><span className="sr-only">{t(" (nouvel onglet)")}</span></a>
      </details>

      <footer className="importer-help-actions">
        <a href={officialHelp} target="_blank" rel="noopener noreferrer" className="importer-help-link">{t("Aide ")}{mac ? t("Apple") : t("Microsoft")} <ExternalLink aria-hidden="true" size={14} /><span className="sr-only">{t(" (nouvel onglet)")}</span></a>
        <Button type="button" onClick={onClose}>{t("J’ai compris")}</Button>
      </footer>
    </div>
  </GameOperationDialog>;
}
