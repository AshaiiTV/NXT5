import { useLanguage } from "../../i18n/useLanguage.js";
import { t } from "../../i18n/translate.js";
import React from "react";
import { ArrowUpRight, FileText, Users } from "lucide-react";
import { RoleIcon } from "../brand/BrandAssets.jsx";
import { roleLabel } from "../../pages/workspace/shell-shared.jsx";
import "./progression-objectives.css";
import { analysisCopy } from "./analysis-copy.js";

const readableTarget = (value, options) => analysisCopy(value, options).replaceAll("<=", "≤").replaceAll(">=", "≥");

export function ProgressionObjectives({ teamObjective, roleObjectives, gamesCount, onOpenSources, onOpenContracts }) {
  useLanguage();
  return <section className="nxt5-objectives-content" aria-labelledby="progression-objectives-title">
    <header className="objectives-heading">
      <h3 id="progression-objectives-title">{t("Objectifs de la prochaine session")}</h3>
      <p>{gamesCount}{t(gamesCount > 1 ? " parties" : " partie")}{t(gamesCount > 1 ? " analysées" : " analysée")}</p>
    </header>
    <p className="objectives-intro">{t("Des cibles proposées à partir de la sélection. Vérifie les parties sources avec l’équipe avant de retenir une consigne.")}</p>

    <div className="objectives-team">
      <div className="objectives-priority">
        <p className="objectives-eyebrow">{t("Priorité équipe")}</p>
        <h4>{t(analysisCopy(teamObjective.title))}</h4>
        <p className="objectives-reason">{t(analysisCopy(teamObjective.why))}</p>
        <button type="button" className="objectives-link" onClick={() => onOpenSources({ title: "Sources objectif", subtitle: teamObjective.title, games: teamObjective.sourceGames })}>
          <FileText aria-hidden="true" />{t(" Voir les parties sources ")}<ArrowUpRight aria-hidden="true" />
        </button>
      </div>
      <div className="objectives-measure">
        <p className="objectives-eyebrow">{t("Cible collective")}</p>
        <p className="objectives-team-target">{t(readableTarget(teamObjective.target))}</p>
        <p className="objectives-current">{t("Actuel ")}<span>{t(analysisCopy(teamObjective.current))}</span></p>
        <p className="objectives-checkpoint">{t("À vérifier sur les 3 prochaines parties.")}</p>
      </div>
    </div>

    <div className="objectives-roles-heading">
      <h4>{t("Une consigne par rôle")}</h4>
      <button type="button" className="objectives-link" onClick={onOpenContracts}>
        <Users aria-hidden="true" />{t(" Objectifs par joueur ")}<ArrowUpRight aria-hidden="true" />
      </button>
    </div>
    {!roleObjectives.length && <p className="objectives-empty">{t("Les consignes par rôle apparaîtront lorsque les participants seront renseignés dans les parties de cette sélection.")}</p>}
    <div className="objectives-role-list">
      {roleObjectives.map((item) => <article key={item.role} className="objectives-role">
        <div className="objectives-role-identity">
          <span aria-hidden="true"><RoleIcon role={item.role} className="objectives-role-icon" lightweight /></span>
          <div>
            <p className="objectives-role-name">{t(roleLabel(item.role))}</p>
            <p className="objectives-role-current">{t(analysisCopy(item.current, { csComparison: true }))}</p>
          </div>
        </div>
        <div className="objectives-role-instruction">
          <h5>{t(analysisCopy(item.title))}</h5>
          <p>{t(analysisCopy(item.why, { csComparison: true }))}</p>
        </div>
        <div className="objectives-role-target">
          <p className="objectives-eyebrow">{t("Cible")}</p>
          <p>{t(readableTarget(item.target, { csComparison: true }))}</p>
        </div>
      </article>)}
    </div>
  </section>;
}
