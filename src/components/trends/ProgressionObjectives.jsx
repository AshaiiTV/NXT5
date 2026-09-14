import React from "react";
import { ArrowUpRight, FileText, Users } from "lucide-react";
import { RoleIcon } from "../brand/BrandAssets.jsx";
import { roleLabel } from "../../pages/workspace/shell-shared.jsx";
import "./progression-objectives.css";

const readableTarget = (value) => String(value).replaceAll("<=", "≤").replaceAll(">=", "≥");

export function ProgressionObjectives({ teamObjective, roleObjectives, gamesCount, onOpenSources, onOpenContracts }) {
  return <section className="nxt5-objectives-content" aria-labelledby="progression-objectives-title">
    <header className="objectives-heading">
      <h3 id="progression-objectives-title">Objectifs du prochain bloc</h3>
      <p>{gamesCount} game{gamesCount > 1 ? "s" : ""} analysée{gamesCount > 1 ? "s" : ""}</p>
    </header>

    <div className="objectives-team">
      <div className="objectives-priority">
        <p className="objectives-eyebrow">Priorité équipe</p>
        <h4>{teamObjective.title}</h4>
        <p className="objectives-reason">{teamObjective.why}</p>
        <button type="button" className="objectives-link" onClick={() => onOpenSources({ title: "Sources objectif", subtitle: teamObjective.title, games: teamObjective.sourceGames })}>
          <FileText aria-hidden="true" /> Voir les games sources <ArrowUpRight aria-hidden="true" />
        </button>
      </div>
      <div className="objectives-measure">
        <p className="objectives-eyebrow">Cible collective</p>
        <p className="objectives-team-target">{readableTarget(teamObjective.target)}</p>
        <p className="objectives-current">Actuel <span>{teamObjective.current}</span></p>
        <p className="objectives-checkpoint">À vérifier sur {Math.min(3, Math.max(1, gamesCount)) === 1 ? "la prochaine game" : `les ${Math.min(3, gamesCount)} prochaines games`}.</p>
      </div>
    </div>

    <div className="objectives-roles-heading">
      <h4>Une consigne par rôle</h4>
      <button type="button" className="objectives-link" onClick={onOpenContracts}>
        <Users aria-hidden="true" /> Contrats joueurs <ArrowUpRight aria-hidden="true" />
      </button>
    </div>
    <div className="objectives-role-list">
      {roleObjectives.map((item) => <article key={item.role} className="objectives-role">
        <div className="objectives-role-identity">
          <span aria-hidden="true"><RoleIcon role={item.role} className="objectives-role-icon" lightweight /></span>
          <div>
            <p className="objectives-role-name">{roleLabel(item.role)}</p>
            <p className="objectives-role-current">{item.current}</p>
          </div>
        </div>
        <div className="objectives-role-instruction">
          <h5>{item.title}</h5>
          <p>{item.why}</p>
        </div>
        <div className="objectives-role-target">
          <p className="objectives-eyebrow">Cible</p>
          <p>{readableTarget(item.target)}</p>
        </div>
      </article>)}
    </div>
  </section>;
}
