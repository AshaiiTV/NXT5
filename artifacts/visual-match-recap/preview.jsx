import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { MatchDataPanel } from "../../src/pages/workspace/GameWorkspace.jsx";
import { Button } from "../../src/components/ui/Core.jsx";
import { MatchDraftingView } from "../../src/components/opponents/MatchDrafterPanel.jsx";
import { setLanguage } from "../../src/i18n/locale.js";
import { syntheticMatch, syntheticDraft, syntheticTeamName } from "./fixture.js";
import "../../src/index.css";
import "./preview.css";

function Preview() {
  const [variant, setVariant] = useState("complete");
  const [match, setMatch] = useState(() => syntheticMatch());
  const [notice, setNotice] = useState("");
  const changeVariant = (next) => { setVariant(next); setMatch(syntheticMatch(next)); };
  return <div className="preview-shell">
    <aside className="preview-controls" aria-label="Contrôles de l’aperçu">
      <strong>NXT5 · Aperçu local · Données fictives</strong>
      <div>
        <label>Scénario <select value={variant} onChange={(event) => changeVariant(event.target.value)}>
          <option value="complete">Carte avec éliminations et exécution</option>
          <option value="map-partial">Carte · Positions partielles</option>
          <option value="map-empty">Carte · Aucune élimination</option>
          <option value="map-missing">Carte · Chronologie absente</option>
          <option value="map-unsupported">Carte · Mode non pris en charge</option>
          <option value="lead-changes">Avantage alterné</option><option value="incomplete">Statistiques incomplètes</option><option value="zero">Or à égalité, dégâts et vision à zéro</option><option value="red">Notre équipe côté rouge</option><option value="long">Noms longs</option><option value="tie">Dégâts ex æquo</option>
        </select></label>
        <label>Langue <select defaultValue="fr" onChange={(event) => setLanguage(event.target.value, { persist: false })}><option value="fr">Français</option><option value="en">English</option><option value="es">Español</option></select></label>
        <button onClick={() => setMatch((current) => ({ ...current, duration: current.duration === "31:11" ? "31:12" : "31:11" }))}>Rafraîchir la partie</button>
        <button onClick={() => setMatch((current) => ({ ...current, id: `${current.id}-next` }))}>Autre partie</button>
      </div>
    </aside>
    <main className="preview-main">
      <header className="preview-heading"><span>Parties</span><h1>Comprends ta partie.</h1></header>
      <MatchDataPanel match={match} teamName={syntheticTeamName(variant)} hasReview onReview={() => setNotice("Le débrief serait ouvert ici.")}
        contextControls={<><span>Équipe adverse <strong>{match.opponent}</strong></span><Button variant="ghost" onClick={() => setNotice("Modification de l’adversaire demandée.")}>Modifier</Button></>}
        draftContent={<MatchDraftingView draft={syntheticDraft(variant)} canEdit onManage={() => setNotice("La gestion de la draft serait ouverte ici.")} />} />
      <p role="status" className="preview-status">{notice}</p>
    </main>
  </div>;
}

createRoot(document.getElementById("root")).render(<Preview />);
