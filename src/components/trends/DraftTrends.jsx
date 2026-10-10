import { useLanguage } from "../../i18n/useLanguage.js";
import { t } from "../../i18n/translate.js";
import { getLocale } from "../../i18n/locale.js";
import { availableNumber, resultSummary, resultLabel, winrateLabel, matchResult } from "../../utils/statistics.js";
import React from "react";
import { ArrowRight, ChevronRight } from "lucide-react";
import { RoleIcon } from "../brand/BrandAssets.jsx";
import { Surface } from "../ui/Core.jsx";
import { cx } from "../../app/helpers.js";
import { championAssetId, championDisplayName, compositionIdentity, championStyleTags, tagLabel, ROSTER_ROLE_ORDER, normalizeProfileRole, ChampionPortrait } from "../../pages/workspace/workspace-shared.jsx";
import { roleLabel } from "../../pages/workspace/shell-shared.jsx";
import { analysisCopy } from "./analysis-copy.js";
import { ChampionAnalysis, DraftSignals } from "./ChampionAnalysis.jsx";
import { buildChampionAnalysis } from "../../utils/champion-analysis.js";
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
  useLanguage();
  return <h4>{href ? <a id={sectionId ? `draft-detail-${sectionId}` : undefined} href={href} onClick={onNavigate} className="draft-detail-link" aria-label={t("Voir le détail : {0}", [t(title)])}><span>{t(title)}</span><ArrowRight aria-hidden="true" /></a> : t(title)}</h4>;
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
    const sideWins = (match) => {
      const result = matchResult(match);
      return result === null ? null : teamKey === "ALLY" ? result === 1 : result === 0;
    };
    const resultsFor = (matches) => {
      const result = resultSummary(matches);
      if (teamKey === "ENEMY") return { ...result, wins: result.losses, losses: result.wins, wr: result.winrate === null ? null : 100 - result.winrate };
      return { ...result, wr: result.winrate };
    };
    const matchDrafts = scoped.map((match) => {
      const draft = draftRows(match, teamKey);
      const identity = draftIdentityForRows(draft);
      return { match, rows: draft, identity, win: sideWins(match) };
    }).filter((entry) => entry.rows.length);
    const picks = Array.from(rows.reduce((map, row) => {
      const key = `${championAssetId(row.champion)}|${row.role || "ROLE"}`;
      const current = map.get(key) || { champion: row.champion, role: row.role || "ROLE", games: 0, wins: 0, kills: 0, deaths: 0, assists: 0, kdaGames: 0, damage: 0, vision: 0, gold: 0, matches: [] };
      current.games += 1;
      current.wins += sideWins(row.match) ? 1 : 0;
      const kdaValues = [row.kills, row.deaths, row.assists].map(availableNumber);
      if (kdaValues.every((value) => value !== null && value >= 0)) {
        current.kills += kdaValues[0];
        current.deaths += kdaValues[1];
        current.assists += kdaValues[2];
        current.kdaGames += 1;
      }
      current.damage += Number(row.damage || 0);
      current.vision += Number(row.vision || 0);
      current.gold += Number(row.gold || 0);
      current.matches.push(row.match);
      map.set(key, current);
      return map;
    }, new Map()).values()).map((pick) => ({
      ...pick,
      ...resultsFor(pick.matches),
      kda: pick.kdaGames ? Number(((pick.kills + pick.assists) / Math.max(1, pick.deaths)).toFixed(2)) : null,
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
    }, new Map()).values()).map((entry) => ({ ...entry, ...resultsFor(entry.matches) })).sort((a, b) => b.games - a.games || b.wr - a.wr);
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
    }, new Map()).values()).map((entry) => ({ ...entry, ...resultsFor(entry.matches) })).sort((a, b) => b.games - a.games || b.wr - a.wr);
    const duos = allDuos.slice(0, 6);
    const latestIdentity = draftIdentityForRows(rows);
    const comfort = picks.filter((pick) => pick.known >= 2 && pick.wr >= 50).slice(0, 5);
    const traps = picks.filter((pick) => pick.known >= 2 && pick.wr < 50).slice().sort((a, b) => a.wr - b.wr || b.games - a.games).slice(0, 5);
    return { rows, matchDrafts, picks, rolePicks, archetypes, duos, allDuos, identity: latestIdentity, comfort, traps, ...resultsFor(matchDrafts.map((entry) => entry.match)) };
  };
  const ally = buildSide("ALLY");
  const analysis = buildChampionAnalysis(ally);
  const warnings = [
    ...analysis.signals.slice(0, 3).map((signal) => `${signal.label} : ${signal.games}/${analysis.completeGames} compositions complètes.`),
    ally.traps[0] && `${championDisplayName(ally.traps[0].champion)} revient souvent avec ${winrateLabel(ally.traps[0].wr)} WR.`,
  ].filter(Boolean).slice(0, 4);
  return { ally, analysis, warnings };
}

function DraftMiniChampion({ item, onSources, detailed = false, totalGames = 0 }) {
  useLanguage();
  const content = <>
    <span className="draft-champion-portrait" aria-hidden="true"><ChampionPortrait champion={item.champion} alt="" /></span>
    <span className="draft-champion-copy">
      <strong>{championDisplayName(item.champion)}</strong>
      <span>{t(roleLabel(item.role))} · {item.games}{t(item.games > 1 ? " parties" : " partie")}{t(" · KDA ")}{item.kda ?? "—"}</span>
      {item.kdaGames < item.games && <span>{t("KDA sur ")}{item.kdaGames}{t(item.kdaGames > 1 ? " parties" : " partie")}{t(item.kdaGames > 1 ? " renseignées" : " renseignée")}</span>}
      {detailed && <span>{t(resultLabel(item))}{t(" · Fréquence : ")}{totalGames ? `${Math.round((item.games / totalGames) * 100)}%` : "—"}</span>}
      {detailed && item.tags?.length > 0 && <span>{item.tags.map(tag => t(tagLabel(tag))).join(" · ")}</span>}
    </span>
    <span className={cx("draft-champion-result", Number.isFinite(item.wr) && item.wr >= 55 ? "draft-result-positive" : Number.isFinite(item.wr) && item.wr < 45 ? "draft-result-negative" : "")}>
      <strong>{t(winrateLabel(item.wr))}</strong><span>{t("victoires")}</span><span>{item.known}{t(item.known > 1 ? " résultats" : " résultat")}</span>
    </span>
    {onSources && <ChevronRight className="draft-source-chevron" aria-hidden="true" />}
  </>;
  return onSources
    ? <button type="button" onClick={onSources} className="draft-champion-row" aria-label={t("Voir les parties sources : {0}, {1}, {2} parties, {3} de victoires sur {4} résultats connus, KDA {5}{6}", [championDisplayName(item.champion), t(roleLabel(item.role)), item.games, t(winrateLabel(item.wr)), item.known, item.kda ?? "indisponible", detailed ? t(", {0}, fréquence {1}{2}", [t(resultLabel(item)), totalGames ? t("{0}% des drafts", [Math.round((item.games / totalGames) * 100)]) : "indisponible", item.tags?.length ? t(", styles : {0}", [item.tags.map(tag => t(tagLabel(tag))).join(", ")]) : ""]) : ""])}>{content}</button>
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
  useLanguage();
  const scores = [...(identity?.scores || [])].sort((a, b) => b.count - a.count);
  const maxCount = Math.max(1, ...scores.map((score) => score.count));
  const primary = scores.find((score) => score.count > 0);
  const avgPerDraft = (score) => (Number(score?.count || 0) / Math.max(1, games)).toLocaleString(getLocale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return <section className="draft-score-board">
    {showHeading && <div className="draft-section-heading">
      <DraftSectionTitle title={t("Profil des compositions")} href={detailHref} onNavigate={onNavigateDetail} sectionId={sectionId} />
      {primary && <span className="draft-context">{t("Dominante : ")}{t(primary.label).toLowerCase()}</span>}
    </div>}
    {!games || !primary ? <p className="draft-empty">{t("Pas encore assez de données pour dégager un profil de draft.")}</p> : <>
      <p className="draft-description">{t(analysisCopy(identity?.text))}</p>
      <div className="draft-score-labels" aria-hidden="true"><span>{t("Marqueurs de style")}</span><span>{t("Total")}</span><span>{t("Par draft")}</span></div>
      <ul className="draft-score-list">
        {scores.map((score) => <li key={score.id} className="draft-score-row">
          <div className="draft-score-style">
            <span>{t(score.label)}</span>
            <span className="draft-score-track" aria-hidden="true"><span style={{ width: `${Math.min(100, (score.count / maxCount) * 100)}%` }} /></span>
          </div>
          <strong className="draft-score-total">{score.count}<span className="sr-only">{t(" marqueurs au total")}</span></strong>
          <span className="draft-score-average">{avgPerDraft(score)}<span className="sr-only">{t(" marqueurs par draft")}</span></span>
        </li>)}
      </ul>
      <p className="draft-footnote">{t("Un champion peut porter plusieurs marqueurs. Les barres comparent leur fréquence, pas leur efficacité.")}</p>
    </>}
  </section>;
}

function DraftTrendTable({ title, rows = [], empty, onSources, variant = "archetypes", detailHref, onNavigateDetail, sectionId, limit = 5, showHeading = true, description, totalGames }) {
  useLanguage();
  const isDuos = variant === "duos";
  const visibleRows = limit === null ? rows : rows.slice(0, limit);
  const showFrequency = totalGames !== undefined;
  return <section className="draft-trend-table">
    {showHeading && <div className="draft-section-heading"><DraftSectionTitle title={t(title)} href={detailHref} onNavigate={onNavigateDetail} sectionId={sectionId} /></div>}
    {description !== false && <p className="draft-description">{description || <>{isDuos ? t("Les duos les plus joués, regroupés par paire de rôles.") : t("Les identités de composition les plus jouées.")}{t(" Tri par nombre de parties.")}</>}</p>}
    {rows.length ? <>
      <div className="draft-table-labels" aria-hidden="true"><span>{isDuos ? t("Champions et rôles") : t("Composition")}</span><span>{t("Parties")}</span><span>{t("Bilan")}</span><span>{t("Victoires")}</span><span /></div>
      <ul className="draft-table-list">{visibleRows.map((row, index) => {
        const label = row.label || (row.tag ? tagLabel(row.tag) : row.champions);
        const content = <>
          <span className="draft-table-identity"><strong>{t(label)}</strong>{row.pair && <span>{row.pair}</span>}{showFrequency && <span>{t("Fréquence : ")}{totalGames ? `${Math.round((row.games / totalGames) * 100)}%` : "—"}{t(" des drafts")}</span>}</span>
          <span className="draft-table-stat"><span className="draft-mobile-label">{t("Parties")}</span><strong>{row.games}</strong></span>
          <span className="draft-table-stat"><span className="draft-mobile-label">{t("Bilan")}</span><span>{t(resultLabel(row))}</span></span>
          <span className={cx("draft-table-stat", Number.isFinite(row.wr) && row.wr >= 55 ? "draft-result-positive" : Number.isFinite(row.wr) && row.wr < 45 ? "draft-result-negative" : "")}><span className="draft-mobile-label">{t("Victoires")}</span><strong>{t(winrateLabel(row.wr))}</strong></span>
          {onSources ? <ChevronRight className="draft-table-chevron" aria-hidden="true" /> : <span />}
        </>;
        return <li key={`${row.tag || row.champions || row.champion}-${index}`}>
          {onSources ? <button type="button" className="draft-table-row" onClick={() => onSources(row)} aria-label={t("Voir les parties sources : {0}{1}, {2} parties, {3}, {4} de victoires{5}", [t(label), row.pair ? `, ${row.pair}` : "", row.games, t(resultLabel(row)), t(winrateLabel(row.wr)), showFrequency ? t(", fréquence {0}", [totalGames ? t("{0}% des drafts", [Math.round((row.games / totalGames) * 100)]) : "indisponible"]) : ""])}>{content}</button> : <div className="draft-table-row">{content}</div>}
        </li>;
      })}</ul>
      {onSources && <p className="draft-footnote">{t("Sélectionne une ligne pour voir ses parties sources.")}</p>}
    </> : <p className="draft-empty">{empty}</p>}
  </section>;
}

function DraftTrendsModule({ model, onOpenSources, sourceGamesForMatches, detailHref, onNavigateDetail }) {
  useLanguage();
  const active = model.ally;
  const analysis = model.analysis;
  const sourceFor = (entry) => sourceGamesForMatches?.(entry.matches || []) || [];
  const openSources = (entry, title, subtitle) => onOpenSources?.({ title, subtitle, metrics: [{ label: "Parties", value: String(entry.games || entry.matches?.length || active.games) }, { label: "Victoires", value: winrateLabel(entry.wr === undefined ? active.wr : entry.wr) }, { label: "Bilan", value: resultLabel(entry.wr === undefined ? active : entry) }], games: sourceFor(entry) });
  const mainPick = active.comfort[0] || active.picks[0];
  const sourceAction = (item) => onOpenSources ? () => openSources(item, `Champion de l’équipe : ${championDisplayName(item.champion)}`, `${roleLabel(item.role)} · ${item.games} parties · ${winrateLabel(item.wr)} de victoires`) : undefined;
  const headingProps = (sectionId) => ({ sectionId, href: detailHref?.(sectionId), onNavigate: onNavigateDetail ? (event) => onNavigateDetail(event, sectionId) : undefined });
  const tableProps = (sectionId) => ({ sectionId, detailHref: detailHref?.(sectionId), onNavigateDetail: onNavigateDetail ? (event) => onNavigateDetail(event, sectionId) : undefined });
  return <Surface className="draft-trends-surface">
    <div className="draft-trends-content">
      <header className="draft-module-heading">
        <div><h3>{t("Les choix de champions de l’équipe")}</h3><p className="draft-description">{t("La draft est le choix des champions avant la partie. Compare les habitudes de l’équipe et ouvre les parties pour comprendre leurs résultats.")}</p></div>
        <p className="draft-context">{active.games}{t(active.games > 1 ? " drafts" : " draft")}{t(active.games > 1 ? " disponibles" : " disponible")}</p>
      </header>
      {!active.games ? <p className="draft-empty">{t("Les champions et les compositions apparaîtront avec les participants de tes parties importées.")}</p> : <>
        <dl className="draft-overview">
          <div><dt>{t("Victoires")}</dt><dd>{t(winrateLabel(active.wr))}</dd><dd className="draft-overview-detail">{t(resultLabel(active))}</dd></div>
          <div><dt>{t("Compositions complètes")}</dt><dd>{analysis.completeGames} / {active.games}</dd><dd className="draft-overview-detail">{t("Cinq champions et cinq rôles renseignés")}</dd></div>
          <div><dt>{t("Combinaisons champion / rôle")}</dt><dd>{active.picks.length}</dd><dd className="draft-overview-detail">{t("Dans ")}{active.games}{t(active.games > 1 ? " drafts" : " draft")}</dd></div>
        </dl>
        <ChampionAnalysis active={active} analysis={model.analysis} onSources={onOpenSources ? openSources : undefined} />
        <details className="trends-secondary-disclosure draft-analysis-disclosure"><summary><span><strong>{t("Comparer les compositions et les duos")}</strong><span>{t("Retrouver les associations fréquentes et leurs parties sources")}</span></span></summary><div className="draft-tables-layout">
          <DraftTrendTable title={t("Compositions fréquentes")} rows={active.archetypes} empty="Les compositions apparaîtront avec plus de données de draft." {...tableProps("compositions")} onSources={onOpenSources ? (row) => openSources(row, `Composition équipe : ${tagLabel(row.tag)}`, `${row.games} parties · ${winrateLabel(row.wr)} de victoires`) : undefined} />
          <DraftTrendTable title={t("Duos fréquents")} rows={active.duos} empty="Les duos apparaîtront avec plus de parties." variant="duos" {...tableProps("duos")} onSources={onOpenSources ? (row) => openSources(row, row.champions, `${row.pair} · ${row.games} parties · ${winrateLabel(row.wr)} de victoires`) : undefined} />
        </div></details>
        <details className="trends-secondary-disclosure draft-analysis-disclosure"><summary><span><strong>{t("Approfondir les choix de champions")}</strong><span>{t("Champion repère, habitudes, points à vérifier et champions par rôle")}</span></span></summary>
        <div className="draft-analysis-layout">
          <div className="draft-picks-column">
            <section className="draft-key-pick">
              <DraftSectionTitle title={t("Champion repère")} {...headingProps("pick-repere")} />
              {mainPick && <>
                <div className="draft-key-pick-identity"><span className="draft-key-portrait" aria-hidden="true"><ChampionPortrait champion={mainPick.champion} alt="" /></span><div><h5>{championDisplayName(mainPick.champion)}</h5><p>{t(roleLabel(mainPick.role))} · {mainPick.games}{t(mainPick.games > 1 ? " parties" : " partie")} · {t(winrateLabel(mainPick.wr))}{t(" de victoires")}</p></div></div>
                <p className="draft-description">{active.comfort.length ? t("Le champion le plus joué parmi ceux qui ont au moins 2 résultats connus et 50 % de victoires.") : t("Le champion le plus joué. Son résultat reste à confirmer avec davantage de parties.")}</p>
                {onOpenSources && <button type="button" className="draft-source-link" onClick={sourceAction(mainPick)}>{t("Voir les parties sources ")}<ArrowRight aria-hidden="true" /></button>}
              </>}
            </section>
            <section className="draft-comfort">
              <div className="draft-section-heading"><DraftSectionTitle title={t("Champions rejoués avec succès")} {...headingProps("confort")} /></div>
              <p className="draft-description">{t("Au moins 2 résultats connus et 50 % de victoires. Ces résultats restent à confirmer avec l’équipe.")}</p>
              {active.comfort.length ? <div className="draft-champion-list">{active.comfort.map((item) => <DraftMiniChampion key={`${item.role}-${item.champion}`} item={item} onSources={sourceAction(item)} />)}</div> : <p className="draft-empty">{t("Aucun champion ne remplit encore ces critères sur cette période.")}</p>}
              <p className="draft-footnote">{t("KDA : éliminations et assistances rapportées aux morts, avec un minimum de 1 au dénominateur.")}</p>
            </section>
          </div>
          <DraftScoreBoard identity={active.identity} games={active.games} {...tableProps("profil")} />
        </div>
        <div className="draft-review-layout">
          <section className="draft-review"><DraftSectionTitle title={t("À revoir en équipe")} {...headingProps("a-revoir")} />
            <DraftSignals analysis={analysis} onSources={onOpenSources ? openSources : undefined} />
            {active.traps.length > 0 && <><p className="draft-description">{t("Champions rejoués avec moins de 50% de victoires :")}</p><div className="draft-champion-list">{active.traps.map((item) => <DraftMiniChampion key={`${item.role}-${item.champion}`} item={item} onSources={sourceAction(item)} />)}</div></>}
          </section>
          <section className="draft-role-pools"><DraftSectionTitle title={t("Champions les plus joués par rôle")} {...headingProps("roles")} /><p className="draft-description">{t("Jusqu’à trois champions par rôle. Sélectionne un champion pour retrouver ses parties.")}</p>
            <ul>{active.rolePicks.map((entry) => <li className="draft-role-row" key={entry.role}>
              <div className="draft-role-name"><span aria-hidden="true"><RoleIcon role={entry.role} className="draft-role-icon" lightweight /></span><strong>{t(roleLabel(entry.role))}</strong></div>
              <div className="draft-role-champions">{entry.picks.map((pick) => onOpenSources ? <button type="button" className="draft-pool-link" onClick={sourceAction(pick)} key={pick.champion}>{championDisplayName(pick.champion)} <span>{pick.games} G</span></button> : <span className="draft-pool-link" key={pick.champion}>{championDisplayName(pick.champion)} <span>{pick.games} G</span></span>)}</div>
            </li>)}</ul>
          </section>
        </div></details>
      </>}
    </div>
  </Surface>;
}

export { buildDraftTrendModel, draftRows, draftIdentityForRows, draftTagScores, DRAFT_SCORE_TAGS, DRAFT_DETAIL_SECTIONS, DraftTrendsModule, DraftMiniChampion, DraftScoreBoard, draftScoreTone, DraftTrendTable };
