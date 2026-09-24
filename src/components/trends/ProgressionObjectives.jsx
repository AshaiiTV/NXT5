import React from "react";
import { ArrowUpRight, FileText, Users } from "lucide-react";
import { RoleIcon } from "../brand/BrandAssets.jsx";
import { roleLabel } from "../../pages/workspace/shell-shared.jsx";
import "./progression-objectives.css";
import { analysisCopy } from "./analysis-copy.js";

const readableTarget = (value, options) => analysisCopy(value, options).replaceAll("<=", "≤").replaceAll(">=", "≥");

export function ProgressionObjectives({ teamObjective, roleObjectives, gamesCount, onOpenSources, onOpenContracts }) {
  return <section className="nxt5-objectives-content" aria-labelledby="progression-objectives-title">
    <header className="objectives-heading">
      <h3 id="progression-objectives-title">Objectifs de la prochaine session</h3>
      <p>{gamesCount} partie{gamesCount > 1 ? "s" : ""} analysée{gamesCount > 1 ? "s" : ""}</p>
    </header>
    <p className="objectives-intro">Des cibles proposées à partir de la sélection. Vérifie les parties sources avec l’équipe avant de retenir une consigne.</p>

    <div className="objectives-team">
      <div className="objectives-priority">
        <p className="objectives-eyebrow">Priorité équipe</p>
        <h4>{analysisCopy(teamObjective.title)}</h4>
        <p className="objectives-reason">{analysisCopy(teamObjective.why)}</p>
        <button type="button" className="objectives-link" onClick={() => onOpenSources({ title: "Sources objectif", subtitle: teamObjective.title, games: teamObjective.sourceGames })}>
          <FileText aria-hidden="true" /> Voir les parties sources <ArrowUpRight aria-hidden="true" />
        </button>
      </div>
      <div className="objectives-measure">
        <p className="objectives-eyebrow">Cible collective</p>
        <p className="objectives-team-target">{readableTarget(teamObjective.target)}</p>
        <p className="objectives-current">Actuel <span>{analysisCopy(teamObjective.current)}</span></p>
        <p className="objectives-checkpoint">À vérifier sur {Math.min(3, Math.max(1, gamesCount)) === 1 ? "la prochaine partie" : `les ${Math.min(3, gamesCount)} prochaines parties`}.</p>
      </div>
    </div>

    <div className="objectives-roles-heading">
      <h4>Une consigne par rôle</h4>
      <button type="button" className="objectives-link" onClick={onOpenContracts}>
        <Users aria-hidden="true" /> Objectifs par joueur <ArrowUpRight aria-hidden="true" />
      </button>
    </div>
    {!roleObjectives.length && <p className="objectives-empty">Les consignes par rôle apparaîtront lorsque les participants seront renseignés dans les parties de cette sélection.</p>}
    <div className="objectives-role-list">
      {roleObjectives.map((item) => <article key={item.role} className="objectives-role">
        <div className="objectives-role-identity">
          <span aria-hidden="true"><RoleIcon role={item.role} className="objectives-role-icon" lightweight /></span>
          <div>
            <p className="objectives-role-name">{roleLabel(item.role)}</p>
            <p className="objectives-role-current">{analysisCopy(item.current, { csComparison: true })}</p>
          </div>
        </div>
        <div className="objectives-role-instruction">
          <h5>{analysisCopy(item.title)}</h5>
          <p>{analysisCopy(item.why, { csComparison: true })}</p>
        </div>
        <div className="objectives-role-target">
          <p className="objectives-eyebrow">Cible</p>
          <p>{readableTarget(item.target, { csComparison: true })}</p>
        </div>
      </article>)}
    </div>
  </section>;
}
