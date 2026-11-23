import { useLanguage } from "../../i18n/useLanguage.js";
import { t } from "../../i18n/translate.js";
import React, { useState } from "react";
import { ArrowRight, BookOpen, CalendarDays } from "lucide-react";
import { Badge, Button, Surface } from "../../components/ui/Core.jsx";
import { RoleIcon } from "../../components/brand/BrandAssets.jsx";
import { matchDisplayName } from "../../utils/matches.js";
import { DEMO_MATCHES } from "./demo-data.js";
import { DEMO_MATCHUP, DEMO_PLANNING, DEMO_ROLES, championName, championPool, matchupGames, opponentChampions, playerHistory, roleDuels, teamRecord } from "./demo-workspace.js";
import "./public-demo.css";

const ROLE_NAMES = { TOP: "Haut", JGL: "Jungle", MID: "Milieu", ADC: "Tireur", SUP: "Support" };
const percent = (value) => value === null ? "—" : `${value} %`;
const kda = (row) => `${row.kills} / ${row.deaths} / ${row.assists}`;
const resultBadge = (match) => <Badge tone={match.result === "Victoire" ? "green" : "red"}>{t(match.result)}</Badge>;
const SAMPLE_NOTE = "Sur une, deux ou trois parties, un pourcentage donne une piste, pas une conclusion : revois le contexte dans les parties sources.";

function ViewIntro({ title, text }) {
  useLanguage();
  return <div className="demo-view-intro"><p className="nxt5-entry-eyebrow">{t("Données fictives · Lecture seule")}</p><h2>{t(title)}</h2><p>{t(text)}</p></div>;
}

/** Team record shown above the trends: the "2 victories out of 3" example. */
export function DemoRecord({ matches = DEMO_MATCHES }) {
  useLanguage();
  const record = teamRecord(matches);
  return <Surface className="demo-record">
    <p className="nxt5-entry-eyebrow">{t("Données fictives · Lecture seule")}</p>
    <dl className="demo-match-metrics demo-record-metrics">
      <div><dt>{t("Taux de victoire")}</dt><dd>{percent(record.rate)}</dd></div>
      <div><dt>{t("Bilan")}</dt><dd>{t("{0} victoires sur {1}", [record.wins, record.games])}</dd></div>
    </dl>
    <p className="demo-data-note">{t("Trois parties : 67 % correspond à deux victoires sur trois. Ce chiffre ne dit ni contre qui, ni comment ; ouvre les parties pour le contexte.")}</p>
  </Surface>;
}

/** Lane duels of one game, blue side kept on the left. */
export function DemoRoleDuels({ match }) {
  useLanguage();
  return <div className="demo-duels">
    <h3>{t("Duels par poste")}</h3>
    <div className="demo-table-scroll" role="region" aria-label={t("Duels par poste")} tabIndex={0}>
      <table className="demo-table demo-duel-table">
        <thead><tr><th scope="col">{t("Poste")}</th><th scope="col">{t("Équipe Horizon")}</th><th scope="col">{t("Adversaire")}</th></tr></thead>
        <tbody>{roleDuels(match).map(({ role, ally, enemy }) => <tr key={role}>
          <th scope="row"><span className="demo-role"><RoleIcon role={role} className="h-6 w-6" />{role}</span></th>
          <td><span className="demo-duel-cell"><strong>{championName(ally.champion)}</strong><span>{kda(ally)}</span></span></td>
          <td><span className="demo-duel-cell"><strong>{championName(enemy.champion)}</strong><span>{kda(enemy)}</span></span></td>
        </tr>)}</tbody>
      </table>
    </div>
    <p className="demo-data-note">{t("Score : éliminations / morts / assistances.")}</p>
  </div>;
}

export function DemoPlayers({ onOpenMatch }) {
  useLanguage();
  const [role, setRole] = useState("SUP");
  const history = playerHistory(role);
  return <div className="demo-view">
    <ViewIntro title="Profils et historique" text="Choisis un joueur pour suivre ses champions et ses scores sur les trois parties." />
    <div className="demo-choice" role="group" aria-label={t("Joueur affiché")}>{DEMO_ROLES.map((id) => <Button key={id} type="button" variant="ghost" aria-pressed={role === id} onClick={() => setRole(id)}><RoleIcon role={id} className="h-5 w-5" />{id}</Button>)}</div>
    <Surface className="demo-panel" key={role}>
      <div className="demo-profile-heading"><RoleIcon role={role} className="h-10 w-10" /><div><h3>{history.player}</h3><p>{t(ROLE_NAMES[role])} · {t("Joueur fictif")}</p></div></div>
      <dl className="demo-match-metrics">
        <div><dt>{t("Parties")}</dt><dd>{history.games.length}</dd></div>
        <div><dt>{t("Victoires")}</dt><dd>{history.record.wins}</dd></div>
        <div><dt>{t("Total du score")}</dt><dd>{history.kills} / {history.deaths} / {history.assists}</dd></div>
      </dl>
      <h4 className="demo-subheading">{t("Historique")}</h4>
      <ol className="demo-history">{history.games.map(({ match, row, opponent }) => <li key={match.id}>
        <span className="demo-history-main"><strong>{matchDisplayName(match)}</strong><span>{t("{0} contre {1}", [championName(row.champion), championName(opponent.champion)])}</span></span>
        <span className="demo-history-score"><strong>{kda(row)}</strong>{resultBadge(match)}</span>
        <Button type="button" variant="ghost" aria-label={t("Ouvrir {0}", [matchDisplayName(match)])} onClick={() => onOpenMatch(match)}>{t("Ouvrir")}</Button>
      </li>)}</ol>
      <p className="demo-data-note">{t("Score : éliminations / morts / assistances. Dans ton espace, chaque profil reprend les parties importées de ton équipe.")}</p>
    </Surface>
  </div>;
}

function ChampionRows({ rows, caption, resultLabel }) {
  useLanguage();
  return <div className="demo-table-scroll" role="region" aria-label={t(caption)} tabIndex={0}>
    <table className="demo-table">
      <caption className="sr-only">{t(caption)}</caption>
      <thead><tr><th scope="col">{t("Champion")}</th><th scope="col" className="is-number">{t("Parties")}</th><th scope="col" className="is-number">{t(resultLabel)}</th></tr></thead>
      <tbody>{rows.map((row) => <tr key={row.key}><th scope="row"><span className="demo-duel-cell"><strong>{championName(row.champion)}</strong><span>{row.role}</span></span></th><td className="is-number">{row.games}</td><td className="is-number">{percent(row.rate)} <span className="demo-table-detail">({t("{0} sur {1}", [row.wins, row.games])})</span></td></tr>)}</tbody>
    </table>
  </div>;
}

export function DemoChampions({ onOpenMatch }) {
  useLanguage();
  const pool = championPool();
  const notebookGames = matchupGames(DEMO_MATCHUP.role, DEMO_MATCHUP.champion, DEMO_MATCHUP.opponent);
  const notebookWins = notebookGames.filter(({ match }) => match.result === "Victoire").length;
  return <div className="demo-view">
    <ViewIntro title="Champion pool et matchups" text="Le champion pool rassemble les champions joués par chaque poste. Le carnet de matchup garde le plan de l’équipe pour un duel précis." />
    <Surface className="demo-panel">
      <h3>{t("Champion pool de l’équipe Horizon")}</h3>
      <ul className="demo-pool">{pool.map(({ role, player, champions }) => <li key={role}>
        <span className="demo-role"><RoleIcon role={role} className="h-6 w-6" /><span><strong>{player}</strong><span>{t("{0} champions", [champions.length])}</span></span></span>
        <span className="demo-pool-champions">{champions.map((champion) => <span key={champion.key}>{championName(champion.champion)} <span className="demo-table-detail">{t("{0} sur {1}", [champion.wins, champion.games])} · {percent(champion.rate)}</span></span>)}</span>
      </li>)}</ul>
      <p className="demo-data-note">{t("Victoires sur parties jouées, par champion.")}</p>
    </Surface>
    <Surface className="demo-panel demo-notebook">
      <div className="demo-match-heading"><h3><BookOpen aria-hidden="true" size={20} />{t("Carnet de matchup : {0} contre {1}", [championName(DEMO_MATCHUP.champion), championName(DEMO_MATCHUP.opponent)])}</h3><Badge tone="cyan">{t(DEMO_MATCHUP.status)}</Badge></div>
      <p className="demo-match-context">{t("Poste {0} · bilan dans ce duel : {1} victoire sur {2}", [DEMO_MATCHUP.role, notebookWins, notebookGames.length])}</p>
      <dl className="demo-notebook-plan">{DEMO_MATCHUP.plan.map(([title, value]) => <div key={title}><dt>{t(title)}</dt><dd>{t(value)}</dd></div>)}</dl>
      <p className="demo-notebook-experiment"><Badge tone="purple">{t(DEMO_MATCHUP.experiment.status)}</Badge> {t(DEMO_MATCHUP.experiment.text)}</p>
      <div className="demo-source-list">{notebookGames.map(({ match, ally, enemy }) => <Button key={match.id} type="button" variant="ghost" icon={ArrowRight} onClick={() => onOpenMatch(match)}>{t("Partie source : {0} · {1} contre {2}", [matchDisplayName(match), `${championName(ally.champion)} ${kda(ally)}`, `${championName(enemy.champion)} ${kda(enemy)}`])}</Button>)}</div>
      <p className="demo-data-note">{t("Notes rédigées pour la démo. Dans ton espace, chaque joueur complète ses propres carnets.")}</p>
    </Surface>
    <Surface className="demo-panel">
      <h3>{t("Champions adverses")}</h3>
      <p className="demo-match-context">{t("Résultat de l’adversaire qui jouait chaque champion contre l’équipe Horizon.")}</p>
      <ChampionRows rows={opponentChampions()} caption="Champions adverses" resultLabel="Victoires de l’adversaire" />
      <p className="demo-data-note">{t(SAMPLE_NOTE)}</p>
    </Surface>
  </div>;
}

export function DemoDraft({ onOpenMatch }) {
  useLanguage();
  const matches = [...DEMO_MATCHES].reverse();
  return <div className="demo-view">
    <ViewIntro title="Draft et compositions" text="La draft est la phase de choix et d’interdictions des champions. Compare les compositions des trois parties, poste par poste." />
    {matches.map((match) => <Surface key={match.id} className="demo-panel">
      <div className="demo-match-heading"><h3>{matchDisplayName(match)}</h3>{resultBadge(match)}</div>
      <p className="demo-match-context">{t(match.side === "blue" ? "Équipe Horizon côté bleu" : "Équipe Horizon côté rouge")}</p>
      <DemoRoleDuels match={match} />
      <Button type="button" variant="ghost" icon={ArrowRight} onClick={() => onOpenMatch(match)}>{t("Ouvrir la partie")}</Button>
    </Surface>)}
    <p className="demo-data-note">{t("Les interdictions ne figurent pas dans ces parties fictives. Dans ton espace, NXT5 Importer récupère choix et interdictions.")}</p>
  </div>;
}

const AVAILABILITY = { yes: ["Disponible", "green"], maybe: ["À confirmer", "yellow"], no: ["Absent", "red"] };

export function DemoPlanning({ onOpenMatch }) {
  useLanguage();
  return <div className="demo-view">
    <ViewIntro title="Planning de la semaine" text="Les actions choisies en débrief deviennent des séances, avec les disponibilités de chaque joueur." />
    <Surface className="demo-panel">
      <h3>{t("Séances prévues")}</h3>
      <ol className="demo-history demo-events">{DEMO_PLANNING.events.map((event) => {
        const source = DEMO_MATCHES.find((match) => match.game_id === event.source);
        return <li key={event.id}>
          <span className="demo-event-time"><CalendarDays aria-hidden="true" size={18} /><span><strong>{t(event.day)}</strong><span>{event.time}</span></span></span>
          <span className="demo-history-main"><strong>{t(event.title)}</strong><span>{t(event.detail)}</span></span>
          {source && <Button type="button" variant="ghost" aria-label={t("Ouvrir {0}", [matchDisplayName(source)])} onClick={() => onOpenMatch(source)}>{t("Partie source")}</Button>}
        </li>;
      })}</ol>
    </Surface>
    <Surface className="demo-panel">
      <h3>{t("Disponibilités")}</h3>
      <ul className="demo-availability">{DEMO_ROLES.map((role) => <li key={role}>
        <span className="demo-role"><RoleIcon role={role} className="h-6 w-6" /><strong>{`Horizon ${role}`}</strong></span>
        <span className="demo-availability-slots">{DEMO_PLANNING.availability[role].map((state, index) => {
          const [day, time] = DEMO_PLANNING.slots[index].split(" ");
          return <Badge key={index} tone={AVAILABILITY[state][1]}>{t(day)} {time} · {t(AVAILABILITY[state][0])}</Badge>;
        })}</span>
      </li>)}</ul>
      <p className="demo-data-note">{t("Semaine fictive. Dans ton espace, chaque joueur indique ses disponibilités et le staff place les séances.")}</p>
    </Surface>
  </div>;
}
