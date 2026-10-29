import React from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useLanguage } from "../../i18n/useLanguage.js";
import { t } from "../../i18n/translate.js";
import "./sort-button.css";

export function SortButton({ label, active = false, direction = "descending", onClick, className = "" }) {
  useLanguage();
  const Icon = active ? direction === "ascending" ? ArrowUp : ArrowDown : ArrowUpDown;
  const order = direction === "ascending" ? t("Valeur croissante") : t("Valeur décroissante");
  return <button type="button" className={`nxt5-sort-button ${className}`.trim()} aria-label={t(label)} aria-pressed={active} aria-description={active ? order : t("Trier par")} title={`${t(label)} · ${order}`} onClick={onClick}>
    <span>{t(label)}</span><Icon size={14} aria-hidden="true" />
  </button>;
}
