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

  return <GameOperationDialog title="Ouvrir NXT5 Importer" description="Les étapes à suivre si ton ordinateur affiche une alerte au premier lancement." onClose={onClose} returnFocusRef={returnFocusRef} compact className="importer-opening-dialog">
    <div className="importer-opening-help">
      <div className="importer-help-tabs" role="tablist" aria-label="Système d’exploitation" onKeyDown={switchWithKeyboard}>
        {systems.map(({ id: system, label, icon: Icon }) => <Button key={system} type="button" variant="ghost" icon={Icon} role="tab" id={`${id}-${system}-tab`} data-platform={system} aria-selected={platform === system} aria-controls={`${id}-panel`} tabIndex={platform === system ? 0 : -1} onClick={() => setPlatform(system)}>{label}</Button>)}
      </div>

      <section role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${platform}-tab`} tabIndex={0} className="importer-help-content">
        <p className="importer-help-eyebrow">{mac ? "Vérification Apple" : "Microsoft Defender SmartScreen"}</p>
        <h3>{mac ? "Apple ne peut pas vérifier l’app" : "Windows a protégé votre ordinateur"}</h3>
        <p>{mac
          ? "La version Mac de NXT5 Importer n’est pas encore notarisée par Apple. macOS peut donc indiquer qu’il ne peut pas vérifier si l’app contient un logiciel malveillant."
          : "SmartScreen vérifie la signature et la réputation du fichier téléchargé. Si l’éditeur ou cette version de NXT5 Importer n’est pas encore reconnu, Windows peut afficher cet avertissement."}</p>
        <p>Ces étapes concernent le fichier téléchargé depuis NXT5 et le message décrit ci-dessus.</p>

        {mac ? <ol key="mac" className="importer-help-steps">
          <li>Extrais le fichier ZIP, puis ouvre <strong>NXT5 Importer</strong>.</li>
          <li>Si l’alerte de vérification Apple apparaît, ferme le message.</li>
          <li>Ouvre <strong>Réglages Système → Confidentialité et sécurité</strong>.</li>
          <li>Dans la section Sécurité, clique sur <strong>Ouvrir quand même</strong>, puis confirme avec <strong>Ouvrir</strong>. Authentifie-toi si macOS le demande.</li>
        </ol> : <ol key="windows" className="importer-help-steps">
          <li>Ouvre le fichier <strong>.exe de NXT5 Importer</strong> téléchargé.</li>
          <li>Si « Windows a protégé votre ordinateur » apparaît, clique sur <strong>Informations complémentaires</strong>.</li>
          <li>Vérifie que le fichier correspond à NXT5 Importer, puis clique sur <strong>Exécuter quand même</strong>, si ce bouton est proposé.</li>
        </ol>}
        <p className="importer-help-note">{mac ? "macOS mémorise cette autorisation pour l’application. Une autre version peut demander une nouvelle validation." : "L’absence de réputation ne prouve ni la présence ni l’absence d’un virus."}</p>
      </section>

      <details className="importer-help-other" key={platform}>
        <summary>Mon message est différent ou le bouton manque</summary>
        <p>Si une menace précise est détectée, si l’app est signalée comme endommagée ou si l’ouverture reste bloquée, arrête-toi ici. Smart App Control ou les règles d’un ordinateur géré peuvent aussi empêcher l’ouverture.</p>
        <p>Contacte l’équipe avec ton système, le nom du fichier et le texte exact de l’alerte. Garde l’antivirus et les protections du système activés.</p>
        <a href="/reseaux#contact" target="_blank" rel="noopener noreferrer" className="importer-help-link">Contacter NXT5 <ExternalLink aria-hidden="true" size={14} /><span className="sr-only"> (nouvel onglet)</span></a>
      </details>

      <footer className="importer-help-actions">
        <a href={officialHelp} target="_blank" rel="noopener noreferrer" className="importer-help-link">Aide {mac ? "Apple" : "Microsoft"} <ExternalLink aria-hidden="true" size={14} /><span className="sr-only"> (nouvel onglet)</span></a>
        <Button type="button" onClick={onClose}>J’ai compris</Button>
      </footer>
    </div>
  </GameOperationDialog>;
}
