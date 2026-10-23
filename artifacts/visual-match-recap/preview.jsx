import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { MatchDataPanel } from "../../src/pages/workspace/GameWorkspace.jsx";
import { Button } from "../../src/components/ui/Core.jsx";
import { setLanguage } from "../../src/i18n/locale.js";
import { syntheticMatch } from "./fixture.js";
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
          <option value="complete">Complet</option><option value="incomplete">Incomplet</option><option value="zero">Zéro mesuré</option><option value="red">Côté rouge</option>
        </select></label>
        <label>Langue <select defaultValue="fr" onChange={(event) => setLanguage(event.target.value, { persist: false })}><option value="fr">Français</option><option value="en">English</option><option value="es">Español</option></select></label>
        <button onClick={() => setMatch((current) => ({ ...current, duration: current.duration === "31:11" ? "31:12" : "31:11" }))}>Rafraîchir la partie</button>
        <button onClick={() => setMatch((current) => ({ ...current, id: `${current.id}-next` }))}>Autre partie</button>
      </div>
    </aside>
    <main className="preview-main">
      <header className="preview-heading"><span>Parties</span><h1>Comprends ta partie.</h1></header>
      <MatchDataPanel match={match} teamName="Atlas" hasReview onReview={() => setNotice("Le débrief serait ouvert ici.")}
        contextControls={<><span>Équipe adverse <strong>Orion</strong></span><Button variant="ghost" onClick={() => setNotice("Modification de l’adversaire demandée.")}>Modifier</Button><span>Draft liée <strong>Partie 3</strong></span><Button variant="ghost" onClick={() => setNotice("La draft serait ouverte ici.")}>Voir la draft</Button></>} />
      <p role="status" className="preview-status">{notice}</p>
    </main>
  </div>;
}

createRoot(document.getElementById("root")).render(<Preview />);
