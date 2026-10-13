import { useLanguage } from "../../i18n/useLanguage.js";
import { t } from "../../i18n/translate.js";
import { canonicalRole, ROLES } from "../../../shared/roles.js";
import { RoleIcon } from "../brand/BrandAssets.jsx";
import { ChampionPortrait, championDisplayName, championStyleTags, compositionIdentity, teamRows } from "../../pages/workspace/workspace-shared.jsx";
import "./match-drafting.css";

const hasChampion = (row) => Boolean(String(row?.champion ?? "").trim());
const roleOrder = new Map(ROLES.map((role, index) => [role, index]));

function compositionPlan(rows) {
  const picks = rows.filter(hasChampion);
  if (picks.length !== 5 || picks.some((row) => championStyleTags(row.champion).includes("standard"))) return null;
  const ordered = [...picks].sort((a, b) => (roleOrder.get(canonicalRole(a.role)) ?? 5) - (roleOrder.get(canonicalRole(b.role)) ?? 5) || String(a.champion).localeCompare(String(b.champion)));
  switch (compositionIdentity(ordered).primary) {
    case "engage": case "dive":
      return t("Engager ensemble et suivre la première initiation.");
    case "pick": case "lockdown": case "assassin": case "burst":
      return t("Isoler une cible, puis profiter de l’avantage pour prendre un objectif.");
    case "scaling": case "front-to-back": case "peel": case "sustain": case "utility":
      return t("Protéger les champions qui portent les dégâts et gagner du temps pour devenir plus fort.");
    case "poke": case "siege": case "control": case "waveclear":
      return t("Affaiblir à distance et contrôler la zone avant le combat.");
    case "side": case "duel":
      return t("Mettre la pression sur une voie latérale pour disperser l’adversaire.");
    case "teamfight": case "frontline":
      return t("Se regrouper et coordonner les combats à cinq.");
    case "early": case "snowball": case "tempo": case "roam":
      return t("Créer un avantage tôt et accélérer autour des objectifs.");
    default:
      return null;
  }
}

function DraftTeam({ match, teamKey, title, name }) {
  const rows = teamRows(match, teamKey);
  const byRole = new Map();
  const unassigned = [];
  for (const row of rows) {
    const role = canonicalRole(row.role);
    if (role && !byRole.has(role)) byRole.set(role, row);
    else if (hasChampion(row)) unassigned.push(row);
  }
  const plan = compositionPlan(rows);
  return <section className="games-drafting-team" data-team={teamKey} aria-label={title}>
    <header className="games-drafting-heading">
      <h4>{title}</h4>
      <p>{name}</p>
    </header>
    <ol className="games-drafting-picks">
      {ROLES.map((role) => {
        const row = byRole.get(role);
        return <li key={role}>
          <span className="games-drafting-role"><span aria-hidden="true"><RoleIcon role={role} className="h-4 w-4" /></span>{role}</span>
          <span className="games-drafting-portrait" aria-hidden="true">
            {hasChampion(row) ? <ChampionPortrait row={row} champion={row.champion} /> : <span>—</span>}
          </span>
          <span className={hasChampion(row) ? "games-drafting-champion" : "games-drafting-missing"}>{hasChampion(row) ? championDisplayName(row.champion) : t("Non renseigné")}</span>
        </li>;
      })}
    </ol>
    {unassigned.length > 0 && <div className="games-drafting-unassigned">
      <h5>{t("Postes à confirmer")}</h5>
      <ul>{unassigned.map((row, index) => <li key={row.id || index}>{championDisplayName(row.champion)}</li>)}</ul>
    </div>}
    <div className="games-drafting-plan">
      {plan ? <><h5>{t("Plan possible")}</h5><p>{plan}</p></> : <p>{rows.filter(hasChampion).length < 5 ? t("Composition incomplète : le plan de jeu reste à confirmer.") : t("Le plan de jeu reste à confirmer pour cette composition.")}</p>}
    </div>
  </section>;
}

export function MatchDrafting({ match, teamName }) {
  useLanguage();
  return <div className="games-drafting">
    <div className="games-drafting-grid">
      <DraftTeam match={match} teamKey="ENEMY" title={t("La leur")} name={t("Équipe adverse")} />
      <DraftTeam match={match} teamKey="ALLY" title={t("La nôtre")} name={teamName || t("Notre équipe")} />
    </div>
    <p className="games-drafting-note">{t("Lecture indicative des champions joués, à confirmer en débrief.")}</p>
  </div>;
}
