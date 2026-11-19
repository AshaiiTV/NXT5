import React from "react";
import { championDisplayName } from "../../../shared/champions.js";
import { t } from "../../i18n/translate.js";
import { TextInput } from "../ui/Core.jsx";

function selectionText(snapshot, side, kind) {
  return (snapshot[`${side}${kind}`] || []).map((value, index) => value ? championDisplayName(value)
    : snapshot.banStates?.[side]?.[index] === "skipped" ? "-" : "?").join(", ");
}

export function TeamDraftSelections({ snapshot, edits, onEdit, disabled = false }) {
  const editing = Boolean(onEdit);
  return <div className="team-draft-selections">
    <p className="opponents-help">{t(editing
      ? "Vérifie que le lien correspond à cette partie. Complète ou corrige les champions. Leur ordre de sélection est inconnu."
      : "Sélections de la partie liées par le staff. L’ordre de la draft est inconnu.")}</p>
    {editing && <p className="opponents-help">{t("Sépare les noms par des virgules. Utilise « ? » pour un ban inconnu et « - » pour un ban passé.")}</p>}
    <div className="opponents-draft-camps">{["blue", "red"].map(side => <section key={side} className="opponents-camp" data-side={side}>
      <h4>{t(side === "blue" ? "Côté bleu" : "Côté rouge")}</h4>
      {["Picks", "Bans"].map(kind => {
        const field = `${side}${kind}`;
        const original = selectionText(snapshot, side, kind);
        const source = edits?.[field] !== undefined ? "staff" : snapshot.selectionSources[field];
        const origin = t(source === "staff" ? "Saisie du staff · ordre non confirmé" : source === "match" ? "Fichier de partie · ordre inconnu" : "Non renseigné");
        const label = side === "blue" ? t(kind === "Picks" ? "Picks bleus" : "Bans bleus") : t(kind === "Picks" ? "Picks rouges" : "Bans rouges");
        return <div key={field}>{editing ? <TextInput label={label} value={edits[field] ?? original} disabled={disabled} maxLength={300}
          onChange={value => onEdit(previous => {
            const next = { ...previous };
            if (value === original) delete next[field];
            else next[field] = value;
            return next;
          })} /> : <><h5>{label}</h5><p>{original || "—"}</p></>}
          <small className="opponents-help">{origin}</small>
        </div>;
      })}
    </section>)}</div>
  </div>;
}
