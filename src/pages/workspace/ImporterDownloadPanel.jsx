import React, { useRef } from "react";
import { Check, Download, Loader2, Upload } from "lucide-react";
import { Button, Surface } from "../../components/ui/Core.jsx";
import { NXT5_IMPORTER_MAC_URL, NXT5_IMPORTER_MAC_INTEL_URL, NXT5_IMPORTER_WINDOWS_URL } from "../../app/constants.jsx";

const downloads = [
  { label: "Windows", detail: "64 bits", href: NXT5_IMPORTER_WINDOWS_URL },
  { label: "Mac", detail: "Apple Silicon", href: NXT5_IMPORTER_MAC_URL },
  { label: "Mac", detail: "Intel", href: NXT5_IMPORTER_MAC_INTEL_URL },
];

export function ImporterDownloadPanel({ fileImporting, hasTeam, hasPreview, onImport, children }) {
  const fileInput = useRef(null);

  return (
    <Surface className="min-w-0">
      <section aria-labelledby="importer-download-title" className="min-w-0 sm:p-2">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-100">Application de bureau</p>
        <h3 id="importer-download-title" className="mt-2 text-2xl font-black text-white">Télécharge NXT5 Importer</h3>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Exporte la game depuis le client League sur ton ordinateur, puis importe le fichier JSON ici.</p>

        <div role="group" className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap" aria-label="Versions de NXT5 Importer">
          {downloads.map(({ label, detail, href }) => (
            <a key={href} href={href} download aria-label={`Télécharger pour ${label} ${detail}`} className="nxt5-cyber-button nxt5-control inline-flex min-h-12 items-center justify-center gap-3 border border-cyan-100/20 bg-cyan-400/[0.08] px-4 py-3 text-sm text-white transition-colors hover:border-cyan-200/45 hover:bg-cyan-300/[0.14] active:bg-cyan-300/[0.20]">
              <Download className="h-4 w-4 shrink-0 text-cyan-200" aria-hidden="true" />
              <span><span className="font-black">{label}</span><span className="ml-2 text-slate-300">{detail}</span></span>
            </a>
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-3 border-t border-cyan-100/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-bold text-white">Déjà un fichier JSON ?</p>
            <p className="mt-1 text-sm leading-6 text-slate-300">{hasTeam ? "Charge-le pour choisir ton side et associer les joueurs." : "Sélectionne une équipe pour importer une game."}</p>
          </div>
          <Button type="button" variant="ghost" icon={fileImporting ? Loader2 : Upload} disabled={fileImporting || !hasTeam} aria-busy={fileImporting} onClick={() => fileInput.current?.click()} className="min-h-12 shrink-0">
            {fileImporting ? "Chargement..." : hasPreview ? "Changer de JSON" : "Importer un JSON"}
          </Button>
          <input ref={fileInput} type="file" accept="application/json,.json" aria-label="Fichier JSON de la game" hidden disabled={fileImporting || !hasTeam} onChange={(event) => { onImport(event.target.files?.[0]); event.target.value = ""; }} />
        </div>
        {hasPreview && <p role="status" className="mt-3 flex items-center gap-2 text-sm font-semibold text-cyan-100"><Check className="h-4 w-4 shrink-0" aria-hidden="true" />JSON chargé · Termine l’assignation ci-dessous.</p>}
        {children}
      </section>
    </Surface>
  );
}
