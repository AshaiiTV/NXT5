import React, { useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button, Surface } from "../../components/ui/Core.jsx";
import { ImportedGames } from "../../components/games/ImportedGames.jsx";
import { TrendEvolution } from "../../components/trends/TrendEvolution.jsx";
import { matchDisplayName } from "../../utils/matches.js";
import { DEMO_MATCHES } from "./demo-data.js";
import { DemoMatchSummary } from "./DemoMatchSummary.jsx";
import "./public-demo.css";

export function DemoExplorer() {
  const [section, setSection] = useState("parties");
  const [selected, setSelected] = useState(null);
  const contentRef = useRef(null);
  function openMatch(match) {
    if (typeof match === "string") match = DEMO_MATCHES.find((item) => item.id === match);
    if (!match) return;
    setSelected(match);
    setSection("parties");
    contentRef.current?.focus({ preventScroll: true });
    contentRef.current?.scrollIntoView?.({ block: "start", behavior: "auto" });
  }
  function showReview() { setSection("debrief"); contentRef.current?.focus({ preventScroll: true }); }
  const reviewMatch = selected || DEMO_MATCHES[2];
  return <div className="demo-explorer">
    <div className="demo-navigation" role="group" aria-label="Explorer la démonstration">{[["parties", "1. Parties"], ["analyses", "2. Analyses"], ["debrief", "3. Débrief"]].map(([id, label]) => <Button key={id} type="button" variant="ghost" aria-pressed={section === id} onClick={() => setSection(id)}>{label}</Button>)}</div>
    <section ref={contentRef} tabIndex={-1} className="demo-content" aria-label={section === "parties" ? "Parties de démonstration" : section === "analyses" ? "Analyses de démonstration" : "Débrief de démonstration"}>
      {section === "parties" && (selected ? <>
        <div className="demo-detail-actions"><Button variant="ghost" type="button" icon={ArrowLeft} onClick={() => setSelected(null)}>Toutes les parties</Button><Button variant="ghost" type="button" onClick={showReview}>Lire le débrief <ArrowRight aria-hidden="true" size={16} /></Button></div>
        <DemoMatchSummary match={selected} />
      </> : <ImportedGames matches={DEMO_MATCHES} showSelection={false} onSelectMatch={openMatch} title="Les trois scrims de l’équipe Horizon" description="Sélectionne une partie fictive pour lire son bilan. La recherche et les filtres fonctionnent comme dans ton espace équipe." />)}
      {section === "analyses" && <TrendEvolution matches={DEMO_MATCHES} onOpenMatch={openMatch} />}
      {section === "debrief" && <Surface className="demo-review"><p className="nxt5-entry-eyebrow">Exemple rédigé pour la démonstration</p><h2>Du constat au travail d’équipe</h2><p className="demo-match-context">{matchDisplayName(reviewMatch)}</p><ol>{[["Le fait observé", reviewMatch.demoReview.observation], ["La question à vérifier", reviewMatch.demoReview.question], ["L’action pour la prochaine séance", reviewMatch.demoReview.action]].map(([title, value]) => <li key={title}><h3>{title}</h3><p>{value}</p></li>)}</ol><p className="demo-data-note">Ce débrief est un exemple écrit, pas un diagnostic automatique. Dans ton espace, les membres de l’équipe rédigent leurs propres observations.</p><Button variant="ghost" type="button" onClick={() => openMatch(reviewMatch)}>Revoir la partie source</Button></Surface>}
    </section>
  </div>;
}
