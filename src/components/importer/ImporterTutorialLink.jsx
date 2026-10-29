import React from "react";
import { PlayCircle } from "lucide-react";
import { t } from "../../i18n/translate.js";
import { useLanguage } from "../../i18n/useLanguage.js";
import { IMPORTER_TUTORIAL_URL } from "../../../shared/importer-tutorial.js";

export function ImporterTutorialLink({ className = "" }) {
  useLanguage();
  return <a href={IMPORTER_TUTORIAL_URL} target="_blank" rel="noopener noreferrer" className={`nxt5-cyber-button nxt5-control nxt5-button-secondary inline-flex min-h-11 max-w-full items-center gap-2 border px-4 py-2.5 text-sm font-semibold leading-5 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200 ${className}`}>
    <PlayCircle aria-hidden="true" className="h-4 w-4 shrink-0" />
    <span>{t("Tuto vidéo : importer une partie sur Windows")}<span className="block text-xs font-normal text-slate-300">{t("YouTube · 2 min 31 · En français · Nouvel onglet")}</span></span>
  </a>;
}
