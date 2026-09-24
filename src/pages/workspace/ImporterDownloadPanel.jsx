import React, { useRef, useState } from "react";
import { Check, Download, HelpCircle, Loader2, Upload } from "lucide-react";
import { Button, SelectInput, Surface } from "../../components/ui/Core.jsx";
import { ImporterOpeningHelp } from "../../components/importer/ImporterOpeningHelp.jsx";
import { NXT5_IMPORTER_MAC_URL, NXT5_IMPORTER_MAC_INTEL_URL, NXT5_IMPORTER_WINDOWS_URL } from "../../app/constants.jsx";

const downloads = [
  { id: "windows", label: "Windows (64 bits)", href: NXT5_IMPORTER_WINDOWS_URL },
  { id: "mac-silicon", label: "Mac Apple Silicon", href: NXT5_IMPORTER_MAC_URL },
  { id: "mac-intel", label: "Mac Intel", href: NXT5_IMPORTER_MAC_INTEL_URL },
];

export function ImporterDownloadPanel({ fileImporting, hasTeam, hasPreview, onImport, children }) {
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

  return (
    <><Surface className="min-w-0">
      <section aria-labelledby="importer-download-title" className="min-w-0 sm:p-2">
        <h3 id="importer-download-title" className="text-xl font-bold text-white">{hasPreview ? "Fichier chargé" : "Ajoute le fichier de ta partie"}</h3>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">{hasPreview ? "Choisis ton équipe ci-dessous, puis vérifie les joueurs avant de confirmer." : "Choisis le fichier .json créé par NXT5 Importer. Tu pourras vérifier les équipes et les joueurs avant l’enregistrement."}</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button type="button" variant={hasPreview ? "ghost" : "primary"} icon={fileImporting ? Loader2 : Upload} disabled={fileImporting || !hasTeam} aria-busy={fileImporting} onClick={() => fileInput.current?.click()} className="min-h-12">
            {fileImporting ? "Chargement…" : hasPreview ? "Changer de fichier" : "Choisir mon fichier"}
          </Button>
          <input ref={fileInput} type="file" accept="application/json,.json" aria-label="Fichier JSON de la partie" hidden disabled={fileImporting || !hasTeam} onChange={(event) => { onImport(event.target.files?.[0]); event.target.value = ""; }} />
          {!hasTeam && <p className="text-sm text-slate-300">Sélectionne une équipe pour importer une partie.</p>}
        </div>
        {hasPreview && <p role="status" className="mt-3 flex items-center gap-2 text-sm font-semibold text-cyan-100"><Check className="h-4 w-4 shrink-0" aria-hidden="true" />Fichier prêt à vérifier · Rien n’est encore enregistré.</p>}
        {children}
        <details className="importer-download-details mt-5 border-t border-cyan-100/10">
          <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold text-white">Pas encore de fichier ? Obtenir NXT5 Importer</summary>
          <p className="max-w-2xl text-sm leading-6 text-slate-300">Ouvre League of Legends sur ton ordinateur, puis utilise NXT5 Importer pour exporter ta partie. Reviens ici avec le fichier .json obtenu.</p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="w-full sm:w-72">
            <SelectInput label="Version de l’application" value={selectedVersion} onChange={setSelectedVersion}>
              {downloads.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
            </SelectInput>
          </div>
          <a href={selectedDownload.href} download onClick={openHelp} aria-haspopup="dialog" aria-label={`Télécharger pour ${selectedDownload.label}`} className="nxt5-cyber-button nxt5-control inline-flex min-h-12 items-center justify-center gap-2 border border-cyan-100/20 bg-cyan-400/[0.08] px-5 py-3 text-sm font-black text-white transition-colors hover:border-cyan-200/45 hover:bg-cyan-300/[0.14] active:bg-cyan-300/[0.20]">
            <Download className="h-4 w-4 shrink-0 text-cyan-200" aria-hidden="true" />
            Télécharger
          </a>
        </div>
        <button type="button" onClick={openHelp} aria-haspopup="dialog" className="importer-help-link mt-2 text-left"><HelpCircle aria-hidden="true" className="h-4 w-4" />Aide à l’ouverture sur Windows et Mac</button>

        </details>
      </section>
    </Surface>
    {helpPlatform && <ImporterOpeningHelp initialPlatform={helpPlatform} onClose={() => setHelpPlatform(null)} returnFocusRef={helpTriggerRef} />}</>
  );
}
