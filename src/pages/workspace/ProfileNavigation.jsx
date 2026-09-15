import React from "react";
import { SelectInput } from "../../components/ui/Core.jsx";

export const PROFILE_SECTIONS = [
  { id: "overview", label: "Synthèse", description: "L’essentiel du joueur" },
  { id: "champions", label: "Champions", description: "Résultats et duels" },
  { id: "pool", label: "Pool déclaré", description: "Options pour la draft" },
  { id: "history", label: "Historique", description: "Retrouver une game" },
  { id: "coaching", label: "Suivi", description: "Objectifs et notes" },
];

export function ProfileNavigation({ activeId, onChange }) {
  function onKeyDown(event, index) {
    let next;
    if (event.key === "ArrowRight") next = (index + 1) % PROFILE_SECTIONS.length;
    if (event.key === "ArrowLeft") next = (index + PROFILE_SECTIONS.length - 1) % PROFILE_SECTIONS.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = PROFILE_SECTIONS.length - 1;
    if (next === undefined) return;
    event.preventDefault();
    onChange(PROFILE_SECTIONS[next].id);
    document.getElementById(`profile-tab-${PROFILE_SECTIONS[next].id}`)?.focus();
  }
  return <div className="profile-navigation">
    <div className="profile-tabs" role="tablist" aria-label="Rubriques du profil">
      {PROFILE_SECTIONS.map((section, index) => <button key={section.id} type="button" role="tab" id={`profile-tab-${section.id}`} aria-controls="profile-panel" aria-selected={activeId === section.id} tabIndex={activeId === section.id ? 0 : -1} onClick={() => onChange(section.id)} onKeyDown={(event) => onKeyDown(event, index)}>
        <strong>{section.label}</strong><span>{section.description}</span>
      </button>)}
    </div>
    <div className="profile-mobile-navigation"><SelectInput label="Rubrique du profil" value={activeId} onChange={onChange}>{PROFILE_SECTIONS.map((section) => <option key={section.id} value={section.id}>{section.label} · {section.description}</option>)}</SelectInput></div>
  </div>;
}
