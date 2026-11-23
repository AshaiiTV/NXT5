import { useLanguage } from "../../i18n/useLanguage.js";
import { t } from "../../i18n/translate.js";
import React, { useRef, useState } from "react";
import { Check, Download, FileJson2, HelpCircle, Loader2, Upload } from "lucide-react";
import { Button, ReadingDetails, SelectInput } from "../../components/ui/Core.jsx";
import { ImporterOpeningHelp } from "../../components/importer/ImporterOpeningHelp.jsx";
import { ImporterTutorialLink } from "../../components/importer/ImporterTutorialLink.jsx";
import { NXT5_IMPORTER_MAC_URL, NXT5_IMPORTER_MAC_INTEL_URL, NXT5_IMPORTER_WINDOWS_URL } from "../../app/constants.jsx";

const downloads = [
  { id: "windows", label: "Windows (64 bits)", href: NXT5_IMPORTER_WINDOWS_URL },
  { id: "mac-silicon", label: "Mac Apple Silicon", href: NXT5_IMPORTER_MAC_URL },
  { id: "mac-intel", label: "Mac Intel", href: NXT5_IMPORTER_MAC_INTEL_URL },
];

export function ImporterDownloadPanel({ fileImporting, hasTeam, hasPreview, onImport, linkSettings, children }) {
  useLanguage();
  const fileInput = useRef(null);
  const [selectedVersion, setSelectedVersion] = useState(downloads[0].id);
  const [helpPlatform, setHelpPlatform] = useState(null);
  const helpTriggerRef = useRef(null);
  const selectedDownload = downloads.find(({ id }) => id === selectedVersion);
  const openHelp = (event) => {
    if (event.button > 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    helpTriggerRef.current = event.currentTarget;
    setHelpPlatform(selectedVersion === "windows" ? "windows" : "mac");
  };

  return <>
    <section aria-labelledby="importer-download-title" className={`importer-download-panel${hasPreview ? " importer-download-panel-loaded" : ""}`}>
      <div className="importer-file-row">
        <div className="importer-download-intro">
          {hasPreview ? <Check aria-hidden="true" className="importer-file-symbol" /> : <FileJson2 aria-hidden="true" className="importer-file-symbol" />}
          <div>
            <h3 id="importer-download-title">{hasPreview ? t("Fichier chargé") : t("Fichier JSON")}</h3>
            <p>{hasPreview ? t("Rien n’est encore enregistré.") : t("Export NXT5 Importer · 5 Mo maximum")}</p>
          </div>
        </div>
        <div className="importer-file-actions">
          <Button type="button" variant={hasPreview ? "ghost" : "primary"} icon={fileImporting ? Loader2 : Upload} disabled={fileImporting || !hasTeam} aria-busy={fileImporting} onClick={() => fileInput.current?.click()}>
            {fileImporting ? t("Chargement…") : hasPreview ? t("Changer de fichier") : t("Choisir mon fichier")}
          </Button>
          <input ref={fileInput} type="file" accept="application/json,.json" aria-label={t("Fichier JSON de la partie")} hidden disabled={fileImporting || !hasTeam} onChange={(event) => { onImport(event.target.files?.[0]); event.target.value = ""; }} />
          {!hasTeam && <p>{t("Sélectionne une équipe pour importer une partie.")}</p>}
        </div>
      </div>
      {children}
      {linkSettings}
      {!hasPreview && <div className="importer-resources">
        <ImporterTutorialLink compact />
        <ReadingDetails className="importer-download-details" title={<><Download aria-hidden="true" />{t("Pas encore de fichier ?")}</>} description={t("Obtenir NXT5 Importer")}>
          <p>{t("Ouvre League of Legends, exporte la partie avec NXT5 Importer, puis ajoute le .json ici.")}</p>
          <div className="importer-platform-actions">
            <SelectInput label={t("Version de l’application")} value={selectedVersion} onChange={setSelectedVersion}>
              {downloads.map(({ id, label }) => <option key={id} value={id}>{t(label)}</option>)}
            </SelectInput>
            <a href={selectedDownload.href} download onClick={openHelp} aria-haspopup="dialog" aria-label={t("Télécharger pour {0}", [t(selectedDownload.label)])} className="nxt5-cyber-button nxt5-control nxt5-button-secondary inline-flex min-h-12 items-center gap-2 border px-4">
              <Download aria-hidden="true" size={16} />{t("Télécharger")}
            </a>
          </div>
          <button type="button" onClick={openHelp} aria-haspopup="dialog" className="importer-help-link mt-2 text-left"><HelpCircle aria-hidden="true" size={16} />{t("Aide à l’ouverture sur Windows et Mac")}</button>
        </ReadingDetails>
      </div>}
    </section>
    {helpPlatform && <ImporterOpeningHelp initialPlatform={helpPlatform} onClose={() => setHelpPlatform(null)} returnFocusRef={helpTriggerRef} />}
  </>;
}
