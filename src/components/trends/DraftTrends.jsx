import React from "react";
import { ArrowRight, ChevronRight } from "lucide-react";
import { RoleIcon } from "../brand/BrandAssets.jsx";
import { Surface } from "../ui/Core.jsx";
import { cx } from "../../app/helpers.js";
import { championAssetId, championDisplayName, compositionIdentity, championStyleTags, tagLabel, ROSTER_ROLE_ORDER, normalizeProfileRole, ChampionPortrait } from "../../pages/workspace/workspace-shared.jsx";
import { roleLabel } from "../../pages/workspace/shell-shared.jsx";
import { analysisCopy } from "./analysis-copy.js";
import "./draft-trends.css";

const DRAFT_SCORE_TAGS = [
  ["engage", ["engage", "dive", "lockdown", "pick"]],
  ["scaling", ["scaling", "front-to-back", "farm", "dps"]],
  ["frontline", ["frontline", "bruiser", "sustain"]],
  ["controle", ["control", "waveclear", "disengage", "peel", "vision"]],
  ["pression", ["early", "lane", "tempo", "snowball", "roam"]],
  ["side", ["side", "duel", "split", "siege"]],
];

const DRAFT_DETAIL_SECTIONS = [
  { id: "pick-repere", title: "Champion repère", description: "Comprends comment le champion repère est choisi et compare-le à tous les champions de la période." },
  { id: "confort", title: "Champions rejoués avec succès", description: "Retrouve tous les champions rejoués avec au moins 50% de victoires et leurs parties sources." },
  { id: "profil", title: "Profil des compositions", description: "Explore les marqueurs de style, leur présence dans les drafts et les résultats associés." },
  { id: "compositions", title: "Compositions fréquentes", description: "Consulte toutes les identités de composition, leur fréquence et leurs résultats." },
  { id: "duos", title: "Duos fréquents", description: "Explore tous les duos de champions suivis, par paire de rôles, avec leur bilan et leurs parties sources." },
  { id: "a-revoir", title: "À revoir en équipe", description: "Examine les signaux de draft et tous les champions rejoués avec moins de 50% de victoires." },
  { id: "roles", title: "Champions les plus joués par rôle", description: "Retrouve l’ensemble des champions joués à chaque rôle, leur fréquence et leurs résultats." },
];

function DraftSectionTitle({ title, href, onNavigate, sectionId }) {
  return <h4>{href ? <a id={sectionId ? `draft-detail-${sectionId}` : undefined} href={href} onClick={onNavigate} className="draft-detail-link" aria-label={`Voir le détail : ${title}`}><span>{title}</span><ArrowRight aria-hidden="true" /></a> : title}</h4>;
}

function draftRows(match, teamKey) {
  return (match?.participants || [])
    .filter((row) => row.team_key === teamKey)
    .map((row) => ({ ...row, match, role: normalizeProfileRole(row.role || row.raw?.teamPosition || row.raw?.individualPosition || row.raw?.lane) }))
    .sort((a, b) => ROSTER_ROLE_ORDER.indexOf(a.role) - ROSTER_ROLE_ORDER.indexOf(b.role));
}

function draftTagScores(rows) {
  const tags = rows.flatMap((row) => championStyleTags(row.champion));
  return DRAFT_SCORE_TAGS.map(([id, needles]) => {
    const count = tags.filter((tag) => needles.includes(tag)).length;
    return { id, label: tagLabel(id), value: Math.min(100, Math.round((count / Math.max(1, rows.length)) * 100)), count };
  });
}

function draftIdentityForRows(rows) {
  const identity = compositionIdentity(rows);
  const scores = draftTagScores(rows);
  const gaps = [
    !scores.find((score) => score.id === "engage")?.count && "Peu d'initiation claire",
    !scores.find((score) => score.id === "frontline")?.count && "Frontline faible",
    !scores.find((score) => score.id === "controle")?.count && "Contrôle limité",
    scores.find((score) => score.id === "scaling")?.count >= 3 && "Draft très scaling",
    scores.find((score) => score.id === "pression")?.count >= 3 && "Draft orientée tempo",
  ].filter(Boolean);
  return { ...identity, scores, gaps };
}

function buildDraftTrendModel(matches) {
  const scoped = Array.isArray(matches) ? matches : [];
  const buildSide = (teamKey) => {
    const rows = scoped.flatMap((match) => draftRows(match, teamKey));
    const sideWins = (match) => teamKey === "ALLY" ? match.result === "Victoire" : match.result === "Défaite";
    const matchDrafts = scoped.map((match) => {
      const draft = draftRows(match, teamKey);
      const identity = draftIdentityForRows(draft);
      return { match, rows: draft, identity, win: sideWins(match) };
    }).filter((entry) => entry.rows.length);
    const picks = Array.from(rows.reduce((map, row) => {
      const key = `${championAssetId(row.champion)}|${row.role || "ROLE"}`;
      const current = map.get(key) || { champion: row.champion, role: row.role || "ROLE", games: 0, wins: 0, kills: 0, deaths: 0, assists: 0, damage: 0, vision: 0, gold: 0, matches: [] };
      current.games += 1;
      current.wins += sideWins(row.match) ? 1 : 0;
      current.kills += Number(row.kills || 0);
      current.deaths += Number(row.deaths || 0);
      current.assists += Number(row.assists || 0);
      current.damage += Number(row.damage || 0);
      current.vision += Number(row.vision || 0);
      current.gold += Number(row.gold || 0);
      current.matches.push(row.match);
      map.set(key, current);
      return map;
    }, new Map()).values()).map((pick) => ({
      ...pick,
      wr: Math.round((pick.wins / Math.max(1, pick.games)) * 100),
      kda: Number(((pick.kills + pick.assists) / Math.max(1, pick.deaths)).toFixed(2)),
      avgDamage: Math.round(pick.damage / Math.max(1, pick.games)),
      avgVision: Math.round(pick.vision / Math.max(1, pick.games)),
      avgGold: Math.round(pick.gold / Math.max(1, pick.games)),
      tags: championStyleTags(pick.champion),
    })).sort((a, b) => b.games - a.games || b.wr - a.wr);
    const rolePicks = ROSTER_ROLE_ORDER.map((role) => ({ role, picks: picks.filter((pick) => pick.role === role).slice(0, 3) })).filter((entry) => entry.picks.length);
    const archetypes = Array.from(matchDrafts.reduce((map, entry) => {
      const key = entry.identity.primary;
      const current = map.get(key) || { tag: key, games: 0, wins: 0, matches: [] };
      current.games += 1;
      current.wins += entry.win ? 1 : 0;
      current.matches.push(entry.match);
      map.set(key, current);
      return map;
    }, new Map()).values()).map((entry) => ({ ...entry, wr: Math.round((entry.wins / Math.max(1, entry.games)) * 100) })).sort((a, b) => b.games - a.games || b.wr - a.wr);
    const pairRows = [];
    for (const entry of matchDrafts) {
      [["JGL", "MID"], ["ADC", "SUP"], ["TOP", "JGL"]].forEach(([a, b]) => {
        const left = entry.rows.find((row) => row.role === a);
        const right = entry.rows.find((row) => row.role === b);
        if (!left || !right) return;
        pairRows.push({ pair: `${roleLabel(a)} + ${roleLabel(b)}`, champions: `${championDisplayName(left.champion)} + ${championDisplayName(right.champion)}`, win: entry.win, match: entry.match });
      });
    }
    const allDuos = Array.from(pairRows.reduce((map, row) => {
      const key = `${row.pair}|${row.champions}`;
      const current = map.get(key) || { pair: row.pair, champions: row.champions, games: 0, wins: 0, matches: [] };
      current.games += 1;
      current.wins += row.win ? 1 : 0;
      current.matches.push(row.match);
      map.set(key, current);
      return map;
    }, new Map()).values()).map((entry) => ({ ...entry, wr: Math.round((entry.wins / Math.max(1, entry.games)) * 100) })).sort((a, b) => b.games - a.games || b.wr - a.wr);
    const duos = allDuos.slice(0, 6);
    const latestIdentity = draftIdentityForRows(rows);
    const comfort = picks.filter((pick) => pick.games >= 2 && pick.wr >= 50).slice(0, 5);
    const traps = picks.filter((pick) => pick.games >= 2 && pick.wr < 50).slice().sort((a, b) => a.wr - b.wr || b.games - a.games).slice(0, 5);
    const wins = matchDrafts.filter((entry) => entry.win).length;
    return { rows, matchDrafts, picks, rolePicks, archetypes, duos, allDuos, identity: latestIdentity, comfort, traps, games: matchDrafts.length, wins, wr: Math.round((wins / Math.max(1, matchDrafts.length)) * 100) };
  };
  const ally = buildSide("ALLY");
  const warnings = [
    ally.identity.gaps[0] && `Nos drafts : ${ally.identity.gaps[0].toLowerCase()}.`,
    ally.traps[0] && `${championDisplayName(ally.traps[0].champion)} revient souvent avec ${ally.traps[0].wr}% WR.`,
  ].filter(Boolean).slice(0, 4);
  return { ally, warnings };
}

function DraftMiniChampion({ item, onSources, detailed = false, totalGames = 0 }) {
  const content = <>
    <span className="draft-champion-portrait" aria-hidden="true"><ChampionPortrait champion={item.champion} alt="" /></span>
    <span className="draft-champion-copy">
      <strong>{championDisplayName(item.champion)}</strong>
      <span>{roleLabel(item.role)} · {item.games} partie{item.games > 1 ? "s" : ""} · KDA {item.kda}</span>
      {detailed && <span>{item.wins} V · {item.games - item.wins} D · Fréquence : {totalGames ? `${Math.round((item.games / totalGames) * 100)}%` : "—"}</span>}
      {detailed && item.tags?.length > 0 && <span>{item.tags.map(tagLabel).join(" · ")}</span>}
    </span>
    <span className={cx("draft-champion-result", item.wr >= 55 ? "draft-result-positive" : item.wr < 45 ? "draft-result-negative" : "")}>
      <strong>{item.wr}%</strong><span>victoires</span>
    </span>
    {onSources && <ChevronRight className="draft-source-chevron" aria-hidden="true" />}
  </>;
  return onSources
    ? <button type="button" onClick={onSources} className="draft-champion-row" aria-label={`Voir les parties sources : ${championDisplayName(item.champion)}, ${roleLabel(item.role)}, ${item.games} parties, ${item.wr}% de victoires, KDA ${item.kda}${detailed ? `, ${item.wins} victoires et ${item.games - item.wins} défaites, fréquence ${totalGames ? `${Math.round((item.games / totalGames) * 100)}% des drafts` : "indisponible"}${item.tags?.length ? `, styles : ${item.tags.map(tagLabel).join(", ")}` : ""}` : ""}`}>{content}</button>
    : <div className="draft-champion-row">{content}</div>;
}

// Kept as a public helper for consumers that use the existing score palette.
function draftScoreTone(scoreId) {
  if (scoreId === "engage") return "from-rose-300 via-orange-300 to-amber-400 text-rose-100 border-rose-200/20 bg-rose-400/[0.055]";
  if (scoreId === "scaling") return "from-cyan-300 via-blue-400 to-indigo-500 text-cyan-100 border-cyan-200/20 bg-cyan-400/[0.055]";
  if (scoreId === "frontline") return "from-emerald-300 via-teal-400 to-cyan-500 text-emerald-100 border-emerald-200/20 bg-emerald-400/[0.055]";
  if (scoreId === "side") return "from-yellow-300 via-amber-400 to-orange-500 text-yellow-100 border-yellow-200/20 bg-yellow-400/[0.055]";
  if (scoreId === "pression") return "from-fuchsia-300 via-sky-300 to-cyan-300 text-fuchsia-100 border-fuchsia-200/20 bg-fuchsia-400/[0.05]";
  return "from-violet-300 via-sky-300 to-cyan-300 text-violet-100 border-violet-200/20 bg-violet-400/[0.05]";
}

function DraftScoreBoard({ identity, games = 0, detailHref, onNavigateDetail, sectionId, showHeading = true }) {
  const scores = [...(identity?.scores || [])].sort((a, b) => b.count - a.count);
  const maxCount = Math.max(1, ...scores.map((score) => score.count));
  const primary = scores.find((score) => score.count > 0);
  const avgPerDraft = (score) => (Number(score?.count || 0) / Math.max(1, games)).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return <section className="draft-score-board">
    {showHeading && <div className="draft-section-heading">
      <DraftSectionTitle title="Profil des compositions" href={detailHref} onNavigate={onNavigateDetail} sectionId={sectionId} />
      {primary && <span className="draft-context">Dominante : {primary.label.toLowerCase()}</span>}
    </div>}
    {!games || !primary ? <p className="draft-empty">Pas encore assez de données pour dégager un profil de draft.</p> : <>
      <p className="draft-description">{analysisCopy(identity?.text)}</p>
      <div className="draft-score-labels" aria-hidden="true"><span>Marqueurs de style</span><span>Total</span><span>Par draft</span></div>
      <ul className="draft-score-list">
        {scores.map((score) => <li key={score.id} className="draft-score-row">
          <div className="draft-score-style">
            <span>{score.label}</span>
            <span className="draft-score-track" aria-hidden="true"><span style={{ width: `${Math.min(100, (score.count / maxCount) * 100)}%` }} /></span>
          </div>
          <strong className="draft-score-total">{score.count}<span className="sr-only"> marqueurs au total</span></strong>
          <span className="draft-score-average">{avgPerDraft(score)}<span className="sr-only"> marqueurs par draft</span></span>
        </li>)}
      </ul>
      <p className="draft-footnote">Un champion peut porter plusieurs marqueurs. Les barres comparent leur fréquence, pas leur efficacité.</p>
    </>}
  </section>;
}

function DraftTrendTable({ title, rows = [], empty, onSources, variant = "archetypes", detailHref, onNavigateDetail, sectionId, limit = 5, showHeading = true, description, totalGames }) {
  const isDuos = variant === "duos";
  const visibleRows = limit === null ? rows : rows.slice(0, limit);
  const showFrequency = totalGames !== undefined;
  return <section className="draft-trend-table">
    {showHeading && <div className="draft-section-heading"><DraftSectionTitle title={title} href={detailHref} onNavigate={onNavigateDetail} sectionId={sectionId} /></div>}
    {description !== false && <p className="draft-description">{description || <>{isDuos ? "Les duos les plus joués, regroupés par paire de rôles." : "Les identités de composition les plus jouées."} Tri par nombre de parties.</>}</p>}
    {rows.length ? <>
      <div className="draft-table-labels" aria-hidden="true"><span>{isDuos ? "Champions et rôles" : "Composition"}</span><span>Parties</span><span>Bilan</span><span>Victoires</span><span /></div>
      <ul className="draft-table-list">{visibleRows.map((row, index) => {
        const label = row.label || (row.tag ? tagLabel(row.tag) : row.champions);
        const content = <>
          <span className="draft-table-identity"><strong>{label}</strong>{row.pair && <span>{row.pair}</span>}{showFrequency && <span>Fréquence : {totalGames ? `${Math.round((row.games / totalGames) * 100)}%` : "—"} des drafts</span>}</span>
          <span className="draft-table-stat"><span className="draft-mobile-label">Parties</span><strong>{row.games}</strong></span>
          <span className="draft-table-stat"><span className="draft-mobile-label">Bilan</span><span>{row.wins} V · {row.games - row.wins} D</span></span>
          <span className={cx("draft-table-stat", row.wr >= 55 ? "draft-result-positive" : row.wr < 45 ? "draft-result-negative" : "")}><span className="draft-mobile-label">Victoires</span><strong>{row.wr}%</strong></span>
          {onSources ? <ChevronRight className="draft-table-chevron" aria-hidden="true" /> : <span />}
        </>;
        return <li key={`${row.tag || row.champions || row.champion}-${index}`}>
          {onSources ? <button type="button" className="draft-table-row" onClick={() => onSources(row)} aria-label={`Voir les parties sources : ${label}${row.pair ? `, ${row.pair}` : ""}, ${row.games} parties, ${row.wins} victoires et ${row.games - row.wins} défaites, ${row.wr}% de victoires${showFrequency ? `, fréquence ${totalGames ? `${Math.round((row.games / totalGames) * 100)}% des drafts` : "indisponible"}` : ""}`}>{content}</button> : <div className="draft-table-row">{content}</div>}
        </li>;
      })}</ul>
      {onSources && <p className="draft-footnote">Sélectionne une ligne pour voir ses parties sources.</p>}
    </> : <p className="draft-empty">{empty}</p>}
  </section>;
}

function DraftTrendsModule({ model, onOpenSources, sourceGamesForMatches, detailHref, onNavigateDetail }) {
  const active = model.ally;
  const sourceFor = (entry) => sourceGamesForMatches?.(entry.matches || []) || [];
  const openSources = (entry, title, subtitle) => onOpenSources?.({ title, subtitle, metrics: [{ label: "Parties", value: String(entry.games || entry.matches?.length || active.games) }, { label: "Victoires", value: `${entry.wr ?? active.wr}%` }], games: sourceFor(entry) });
  const mainPick = active.comfort[0] || active.picks[0];
  const sourceAction = (item) => onOpenSources ? () => openSources(item, `Champion de l’équipe : ${championDisplayName(item.champion)}`, `${roleLabel(item.role)} · ${item.games} parties · ${item.wr}% de victoires`) : undefined;
  const headingProps = (sectionId) => ({ sectionId, href: detailHref?.(sectionId), onNavigate: onNavigateDetail ? (event) => onNavigateDetail(event, sectionId) : undefined });
  const tableProps = (sectionId) => ({ sectionId, detailHref: detailHref?.(sectionId), onNavigateDetail: onNavigateDetail ? (event) => onNavigateDetail(event, sectionId) : undefined });
  return <Surface className="draft-trends-surface">
    <div className="draft-trends-content">
      <header className="draft-module-heading">
        <div><h3>Les choix de champions de l’équipe</h3><p className="draft-description">La draft est le choix des champions avant la partie. Compare les habitudes de l’équipe et ouvre les parties pour comprendre leurs résultats.</p></div>
        <p className="draft-context">{active.games} draft{active.games > 1 ? "s" : ""} disponible{active.games > 1 ? "s" : ""}</p>
      </header>
      {!active.games ? <p className="draft-empty">Les champions et les compositions apparaîtront avec les participants de tes parties importées.</p> : <>
        <dl className="draft-overview">
          <div><dt>Victoires</dt><dd>{active.wr}%</dd><dd className="draft-overview-detail">{active.wins} victoire{active.wins > 1 ? "s" : ""} · {active.games - active.wins} défaite{active.games - active.wins > 1 ? "s" : ""}</dd></div>
          <div><dt>Identité la plus représentée</dt><dd>{tagLabel(active.identity.primary)}</dd><dd className="draft-overview-detail">Sur l’ensemble des champions de la sélection</dd></div>
          <div><dt>Combinaisons champion / rôle</dt><dd>{active.picks.length}</dd><dd className="draft-overview-detail">Dans {active.games} draft{active.games > 1 ? "s" : ""}</dd></div>
        </dl>
        <div className="draft-analysis-layout">
          <div className="draft-picks-column">
            <section className="draft-key-pick">
              <DraftSectionTitle title="Champion repère" {...headingProps("pick-repere")} />
              {mainPick && <>
                <div className="draft-key-pick-identity"><span className="draft-key-portrait" aria-hidden="true"><ChampionPortrait champion={mainPick.champion} alt="" /></span><div><h5>{championDisplayName(mainPick.champion)}</h5><p>{roleLabel(mainPick.role)} · {mainPick.games} partie{mainPick.games > 1 ? "s" : ""} · {mainPick.wr}% de victoires</p></div></div>
                <p className="draft-description">{active.comfort.length ? "Le champion le plus joué parmi ceux qui ont au moins 2 parties et 50 % de victoires." : "Le champion le plus joué. Son résultat reste à confirmer avec davantage de parties."}</p>
                {onOpenSources && <button type="button" className="draft-source-link" onClick={sourceAction(mainPick)}>Voir les parties sources <ArrowRight aria-hidden="true" /></button>}
              </>}
            </section>
            <section className="draft-comfort">
              <div className="draft-section-heading"><DraftSectionTitle title="Champions rejoués avec succès" {...headingProps("confort")} /></div>
              <p className="draft-description">Au moins 2 parties et 50 % de victoires. Ces résultats restent à confirmer avec l’équipe.</p>
              {active.comfort.length ? <div className="draft-champion-list">{active.comfort.map((item) => <DraftMiniChampion key={`${item.role}-${item.champion}`} item={item} onSources={sourceAction(item)} />)}</div> : <p className="draft-empty">Aucun champion ne remplit encore ces critères sur cette période.</p>}
              <p className="draft-footnote">KDA : éliminations et assistances rapportées aux morts, avec un minimum de 1 au dénominateur.</p>
            </section>
          </div>
          <DraftScoreBoard identity={active.identity} games={active.games} {...tableProps("profil")} />
        </div>
        <details className="trends-secondary-disclosure draft-analysis-disclosure"><summary><span><strong>Comparer les compositions et les duos</strong><span>Retrouver les associations fréquentes et leurs parties sources</span></span></summary><div className="draft-tables-layout">
          <DraftTrendTable title="Compositions fréquentes" rows={active.archetypes} empty="Les compositions apparaîtront avec plus de données de draft." {...tableProps("compositions")} onSources={onOpenSources ? (row) => openSources(row, `Composition équipe : ${tagLabel(row.tag)}`, `${row.games} parties · ${row.wr}% de victoires`) : undefined} />
          <DraftTrendTable title="Duos fréquents" rows={active.duos} empty="Les duos apparaîtront avec plus de parties." variant="duos" {...tableProps("duos")} onSources={onOpenSources ? (row) => openSources(row, row.champions, `${row.pair} · ${row.games} parties · ${row.wr}% de victoires`) : undefined} />
        </div></details>
        <details className="trends-secondary-disclosure draft-analysis-disclosure"><summary><span><strong>Approfondir les choix de champions</strong><span>Points à vérifier et champions joués par rôle</span></span></summary><div className="draft-review-layout">
          <section className="draft-review"><DraftSectionTitle title="À revoir en équipe" {...headingProps("a-revoir")} />
            {model.warnings?.length ? <ul className="draft-warning-list">{model.warnings.slice(0, 4).map((warning) => <li key={warning}>{analysisCopy(warning)}</li>)}</ul> : <p className="draft-description">Aucun signal particulier sur cette sélection.</p>}
            {active.traps.length > 0 && <><p className="draft-description">Champions rejoués avec moins de 50% de victoires :</p><div className="draft-champion-list">{active.traps.map((item) => <DraftMiniChampion key={`${item.role}-${item.champion}`} item={item} onSources={sourceAction(item)} />)}</div></>}
          </section>
          <section className="draft-role-pools"><DraftSectionTitle title="Champions les plus joués par rôle" {...headingProps("roles")} /><p className="draft-description">Jusqu’à trois champions par rôle. Sélectionne un champion pour retrouver ses parties.</p>
            <ul>{active.rolePicks.map((entry) => <li className="draft-role-row" key={entry.role}>
              <div className="draft-role-name"><span aria-hidden="true"><RoleIcon role={entry.role} className="draft-role-icon" lightweight /></span><strong>{roleLabel(entry.role)}</strong></div>
              <div className="draft-role-champions">{entry.picks.map((pick) => onOpenSources ? <button type="button" className="draft-pool-link" onClick={sourceAction(pick)} key={pick.champion}>{championDisplayName(pick.champion)} <span>{pick.games} G</span></button> : <span className="draft-pool-link" key={pick.champion}>{championDisplayName(pick.champion)} <span>{pick.games} G</span></span>)}</div>
            </li>)}</ul>
          </section>
        </div></details>
      </>}
    </div>
  </Surface>;
}

export { buildDraftTrendModel, draftRows, draftIdentityForRows, draftTagScores, DRAFT_SCORE_TAGS, DRAFT_DETAIL_SECTIONS, DraftTrendsModule, DraftMiniChampion, DraftScoreBoard, draftScoreTone, DraftTrendTable };
