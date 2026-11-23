import { useLanguage } from "../../i18n/useLanguage.js";
import { t } from "../../i18n/translate.js";
import React, { useEffect, useRef } from "react";
import { ArrowLeft } from "lucide-react";
import { Button, Surface } from "../../components/ui/Core.jsx";
import { ImportedGames } from "../../components/games/ImportedGames.jsx";
import { TrendEvolution } from "../../components/trends/TrendEvolution.jsx";
import { matchDisplayName } from "../../utils/matches.js";
import { DEMO_MATCHES } from "./demo-data.js";
import { DEMO_PATH, demoPath, findDemoMatch, parseDemoPath } from "../../app/demo-routes.js";
import { DemoMatchSummary } from "./DemoMatchSummary.jsx";
import { DemoChampions, DemoDraft, DemoPlanning, DemoPlayers, DemoRecord } from "./DemoTeamViews.jsx";
import "./public-demo.css";

export const DEMO_NAVIGATION = [["parties", "Parties"], ["analyses", "Analyses"], ["debrief", "Notes"], ["joueurs", "Joueurs"], ["champions", "Champions"], ["draft", "Draft"], ["planning", "Planning"]];

// The URL owns the section and the selected game, so Back/Forward and shared links work.
export function DemoExplorer({ path = DEMO_PATH, navigate }) {
  useLanguage();
  const { section, match: selected, known } = parseDemoPath(path);
  const contentRef = useRef(null);
  const previousPath = useRef(path);
  useEffect(() => { if (!known) navigate?.(DEMO_PATH, { replace: true }); }, [known, navigate]);
  useEffect(() => {
    if (previousPath.current === path) return;
    previousPath.current = path;
    contentRef.current?.focus({ preventScroll: true });
    contentRef.current?.scrollIntoView?.({ block: "start", behavior: "auto" });
  }, [path]);
  const go = (target) => { if (target !== path) navigate?.(target); };
  function openMatch(match) {
    match = typeof match === "string" ? findDemoMatch(match) : match;
    go(match ? demoPath("parties", match) : DEMO_PATH);
  }
  const showReview = () => go(demoPath("debrief", selected));
  const reviewMatch = selected || DEMO_MATCHES[2];
  const sectionLabel = DEMO_NAVIGATION.find(([id]) => id === section)?.[1] || "Parties";
  return <div className="demo-explorer">
    <div className="demo-navigation" role="group" aria-label={t("Explorer la démonstration")}>{DEMO_NAVIGATION.map(([id, label]) => <Button key={id} type="button" variant="ghost" aria-pressed={section === id} onClick={() => go(demoPath(id, id === "debrief" ? reviewMatch : null))}>{t(label)}</Button>)}</div>
    <section ref={contentRef} tabIndex={-1} className="demo-content" aria-label={t("{0} · démonstration", [t(sectionLabel)])}>
      {section === "parties" && (selected ? <>
        <div className="demo-detail-actions"><Button variant="ghost" type="button" icon={ArrowLeft} onClick={() => go(DEMO_PATH)}>{t("Toutes les parties")}</Button></div>
        <DemoMatchSummary match={selected} onOpenReview={showReview} timeline detailsOpen duels />
      </> : <ImportedGames matches={DEMO_MATCHES} showSelection={false} dateTimeZone="Europe/Paris" onSelectMatch={openMatch} title={t("Les scrims de l’équipe Horizon")} description={t("Choisis une partie. Horaires à l’heure de Paris.")} />)}
      {section === "analyses" && <><DemoRecord /><TrendEvolution matches={DEMO_MATCHES} onOpenMatch={openMatch} /></>}
      {section === "joueurs" && <DemoPlayers onOpenMatch={openMatch} />}
      {section === "champions" && <DemoChampions onOpenMatch={openMatch} />}
      {section === "draft" && <DemoDraft onOpenMatch={openMatch} />}
      {section === "planning" && <DemoPlanning onOpenMatch={openMatch} />}
      {section === "debrief" && <Surface className="demo-review"><p className="nxt5-entry-eyebrow">{t("Exemple rédigé pour la démonstration")}</p><h2>{t("Note de débrief : préparer la prochaine séance")}</h2><p className="demo-match-context">{matchDisplayName(reviewMatch)}</p><ol>{[["Le fait observé", reviewMatch.demoReview.observation], ["La question à vérifier", reviewMatch.demoReview.question], ["L’action pour la prochaine séance", reviewMatch.demoReview.action]].map(([title, value]) => <li key={title}><h3>{t(title)}</h3><p>{t(value)}</p></li>)}</ol><p className="demo-data-note">{t("Débrief rédigé pour la démo. Dans ton espace, l’équipe écrit ses observations.")}</p><Button variant="ghost" type="button" onClick={() => openMatch(reviewMatch)}>{t("Revoir la partie source")}</Button></Surface>}
    </section>
  </div>;
}
