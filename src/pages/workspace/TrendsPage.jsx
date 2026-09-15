import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Activity, AlertTriangle, ArrowLeft, Crown, Eye, Flame, Gauge, Image as ImageIcon, RefreshCw, Shield, Target, Trophy, Upload } from "lucide-react";
import { openAppPath } from "../../app/routing.js";
import { Button, EmptyState, SkeletonRows, Surface, PageHeader, SelectInput } from "../../components/ui/Core.jsx";
import { matchDisplayName, matchHasCategory } from "../../utils/matches.js";
import { csAtMinute } from "../../utils/match-timeline.js";
import { championAssetId, championPortraitSources, championDisplayName, compositionIdentity, championStyleTags, championStyleTone, tagLabel, sortPlayersByRole, ROSTER_ROLE_ORDER, isGameplayRole, formatPoints, formatGoldDiff, buildStaffAlerts, formatCountdown, normalizeProfileRole, playerIntegratedRows, parsePercent, statValue, teamRows, sumRows, shareOfTeam, objectiveEventType, objectiveEvents, objectiveTeamId, objectiveTeamSummary, diffTone, lazyNamed, loadNextPhase } from "./workspace-shared.jsx";
import { roleLabel } from "./shell-shared.jsx";
import { hasTrendTimeline, sortTrendMatches } from "../../utils/trends.js";
import { TrendEvolution, TrendPeriodFilter } from "../../components/trends/TrendEvolution.jsx";
import { ProgressionObjectives } from "../../components/trends/ProgressionObjectives.jsx";
import { TrendNavigation, TrendsOverview } from "../../components/trends/TrendsOverview.jsx";
import { TrendSourcesDialog, TrendContractsDialog } from "../../components/trends/TrendsDialogs.jsx";
import "../../components/trends/trends-page.css";
import { PNG_THEME, pngAccent, pngFitText, pngWrapText, pngPanel, pngBackground, pngHeader, pngMetricStrip, pngFooter, pngLoadImage, pngImageCover, pngDownload } from "../../utils/png-report.js";

import { useTrendsNavigation } from "../../hooks/useTrendsNavigation.js";
import { DraftTrendDetails } from "../../components/trends/DraftTrendDetails.jsx";
import { buildDraftTrendModel, DRAFT_DETAIL_SECTIONS, DraftTrendsModule } from "../../components/trends/DraftTrends.jsx";

const BlockComparisonPanel = lazyNamed(loadNextPhase, "BlockComparisonPanel");

async function exportTrendsPng({ title, subtitle, metrics = [], sections = [], champions = [], filename }) {
  await document.fonts?.ready;
  const canvas = document.createElement("canvas");
  canvas.width = 1920;
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const margin = 64;
  const gap = 24;
  const contentWidth = W - margin * 2;
  const columnWidth = (contentWidth - gap) / 2;
  const bodyFont = "500 18px Inter, Arial, sans-serif";
  const lineHeight = 27;
  const wrap = (text, width, font = bodyFont) => pngWrapText(ctx, String(text ?? ""), width, { font, maxLines: Infinity });
  const fit = (text, x, y, width, options) => pngFitText(ctx, text, x, y, width, options);
  const metricItems = metrics.slice(0, 4);
  const sectionLayouts = sections.map((section) => {
    const items = section.items?.length ? section.items : ["Pas assez de données sur cette sélection."];
    const itemLines = items.map((item) => wrap(item, columnWidth - 76));
    return { ...section, itemLines, height: Math.max(156, 76 + itemLines.reduce((total, lines) => total + lines.length * lineHeight + 16, 0)) };
  });
  let contentBottom = metricItems.length ? 344 : 200;
  sectionLayouts.forEach((section, index) => {
    if (index % 2) return;
    const rowHeight = Math.max(section.height, sectionLayouts[index + 1]?.height || 0);
    section.y = contentBottom;
    section.rowHeight = rowHeight;
    if (sectionLayouts[index + 1]) {
      sectionLayouts[index + 1].y = contentBottom;
      sectionLayouts[index + 1].rowHeight = rowHeight;
    }
    contentBottom += rowHeight + gap;
  });
  const championsY = contentBottom;
  canvas.height = Math.max(1080, championsY + 142 + 112);
  const H = canvas.height;
  const imageCache = new Map();
  const imageUrls = new Set(["/assets/nxt5-wordmark.png"]);
  champions.slice(0, 6).forEach((stat) => championPortraitSources(stat.champion, stat.champion).forEach((url) => imageUrls.add(url)));
  await Promise.all([...imageUrls].filter(Boolean).map(async (url) => imageCache.set(url, await pngLoadImage(url))));

  pngBackground(ctx, W, H);
  pngHeader(ctx, {
    width: W,
    title: title || "Tendances NXT5",
    subtitle: subtitle || "Analyse de l’équipe",
    eyebrow: "Tendances",
    logo: imageCache.get("/assets/nxt5-wordmark.png"),
    meta: "Synthèse stratégique",
  });

  pngMetricStrip(ctx, { x: margin, width: contentWidth, items: metricItems.map((metric) => ({
    label: metric.label,
    value: metric.value,
    detail: metric.hint,
    accent: metric.tone || "cyan",
  })) });

  sectionLayouts.forEach((section, index) => {
    const x = margin + (index % 2) * (columnWidth + gap);
    const y = section.y;
    pngPanel(ctx, x, y, columnWidth, section.rowHeight);
    fit(section.title, x + 28, y + 42, columnWidth - 56, { font: "700 24px Inter, Arial, sans-serif", color: PNG_THEME.text, min: 18 });
    let itemY = y + 78;
    section.itemLines.forEach((lines, itemIndex) => {
      ctx.fillStyle = pngAccent(section.tone);
      ctx.beginPath();
      ctx.arc(x + 30, itemY - 6, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = bodyFont;
      ctx.fillStyle = itemIndex === 0 ? PNG_THEME.text : PNG_THEME.muted;
      lines.forEach((line, lineIndex) => ctx.fillText(line, x + 48, itemY + lineIndex * lineHeight));
      itemY += lines.length * lineHeight + 16;
    });
  });

  pngPanel(ctx, margin, championsY, contentWidth, 142);
  fit("Champions récurrents", margin + 28, championsY + 40, contentWidth - 56, { font: "700 24px Inter, Arial, sans-serif", color: PNG_THEME.text, min: 18 });
  const championWidth = (contentWidth - 56) / 6;
  champions.slice(0, 6).forEach((stat, index) => {
    const x = margin + 28 + index * championWidth;
    const image = championPortraitSources(stat.champion, stat.champion).map((url) => imageCache.get(url)).find(Boolean);
    pngPanel(ctx, x, championsY + 66, 48, 48, { fill: PNG_THEME.panelAlt, radius: 10 });
    pngImageCover(ctx, image, x, championsY + 66, 48, 48, 10);
    fit(championDisplayName(stat.champion), x + 60, championsY + 86, championWidth - 76, { font: "600 18px Inter, Arial, sans-serif", color: PNG_THEME.text, min: 14 });
    fit(`${stat.games}G · ${Math.round((stat.wins / Math.max(1, stat.games)) * 100)}% de victoires`, x + 60, championsY + 110, championWidth - 76, { font: "500 15px Inter, Arial, sans-serif", color: PNG_THEME.muted, min: 12 });
  });
  if (!champions.length) fit("Aucun champion dans cette sélection.", margin + 28, championsY + 92, contentWidth - 56, { font: bodyFont, color: PNG_THEME.muted });
  pngFooter(ctx, { width: W, height: H, label: "Tendances · Synthèse stratégique" });
  await pngDownload(canvas, filename || "nxt5-tendances.png");
}

function TrendsPage({ data, selectedTeamId }) {
  const baseMatches = useMemo(() => (data.matches || []).filter((match) => match.team_id === selectedTeamId), [data.matches, selectedTeamId]);
  const matchCategories = useMemo(() => (data.matchCategories || []).filter((category) => category.team_id === selectedTeamId), [data.matchCategories, selectedTeamId]);
  const navigation = useTrendsNavigation(selectedTeamId);
  const { category: selectedCategoryId, setCategory: setSelectedCategoryId, period: trendPeriod, setPeriod: setTrendPeriod, panel: trendPanel, setPanel: setTrendPanel, detail: draftDetail } = navigation;
  const detailSection = DRAFT_DETAIL_SECTIONS.find((section) => section.id === draftDetail);
  const previousDetail = useRef(draftDetail);
  const detailHeading = useRef(null);
  const [trendSourceModal, setTrendSourceModal] = useState(null);

  const focusObjectives = useRef(false);
  const [profileContractsOpen, setProfileContractsOpen] = useState(false);
  const [exportState, setExportState] = useState("");
  const categoryMatches = useMemo(() => sortTrendMatches(selectedCategoryId ? baseMatches.filter((match) => matchHasCategory(match, selectedCategoryId)) : baseMatches), [baseMatches, selectedCategoryId]);
  const matches = useMemo(() => trendPeriod === "all" ? categoryMatches : categoryMatches.slice(0, Number(trendPeriod)), [categoryMatches, trendPeriod]);
  useEffect(() => {
    setTrendSourceModal(null);
    setProfileContractsOpen(false);
  }, [selectedTeamId]);
  useEffect(() => { setTrendSourceModal(null); setProfileContractsOpen(false); setExportState(""); }, [matches, draftDetail]);
  useEffect(() => {
    const returningFrom = previousDetail.current;
    previousDetail.current = draftDetail;
    if (draftDetail === returningFrom) return;
    const target = draftDetail ? detailHeading.current : returningFrom ? document.getElementById(`draft-detail-${returningFrom}`) : null;
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: draftDetail ? "start" : "center", behavior: "instant" });
  }, [draftDetail]);
  useEffect(() => {
    if (trendPanel === "ai-objectives" && focusObjectives.current) {
      document.getElementById("trend-panel-ai-objectives")?.focus();
      focusObjectives.current = false;
    }
  }, [trendPanel]);
  const activeTrendCategory = matchCategories.find((category) => String(category.id || "") === String(selectedCategoryId || ""));
  const rows = useMemo(() => matches.flatMap((match) => (match.participants || []).map((row) => ({ ...row, match }))), [matches]);
  const ally = useMemo(() => rows.filter((row) => row.team_key === "ALLY"), [rows]);
  const enemy = useMemo(() => rows.filter((row) => row.team_key === "ENEMY"), [rows]);
  const wins = matches.filter((match) => match.result === "Victoire").length;
  const losses = matches.length - wins;
  const winrate = Math.round((wins / Math.max(1, matches.length)) * 100);
  const roleFromRow = (row) => normalizeProfileRole(row?.role || row?.raw?.teamPosition || row?.raw?.individualPosition || row?.raw?.lane);
  const minuteFromTimestamp = (timestamp) => {
    const value = Number(timestamp || 0);
    return value > 0 ? value / 60000 : null;
  };
  const formatMinute = (value) => Number.isFinite(value) ? formatCountdown(Math.round(value * 60)) : "—";
  const averageValues = (values) => {
    const valid = values.filter((value) => Number.isFinite(value));
    return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
  };
  const matchInsights = useMemo(() => matches.map((match) => {
    const allyRows = teamRows(match, "ALLY");
    const enemyRows = teamRows(match, "ENEMY");
    const totalGold = Math.max(1, sumRows(allyRows, "gold"));
    const totalDamage = Math.max(1, sumRows(allyRows, "damage"));
    const roleStats = ROSTER_ROLE_ORDER.map((role) => {
      const row = allyRows.find((item) => roleFromRow(item) === role);
      const enemyRow = enemyRows.find((item) => roleFromRow(item) === role);
      const gold = statValue(row, "gold");
      const damage = statValue(row, "damage");
      const goldShare = (gold / totalGold) * 100;
      const damageShare = (damage / totalDamage) * 100;
      const kp = parsePercent(row?.kill_participation || row?.kp || 0);
      const cs10 = row ? csAtMinute({ ...row, match }, 10) : null;
      const cs20 = row ? csAtMinute({ ...row, match }, 20) : null;
      const enemyCs10 = enemyRow ? csAtMinute({ ...enemyRow, match }, 10) : null;
      const enemyCs20 = enemyRow ? csAtMinute({ ...enemyRow, match }, 20) : null;
      return {
        role,
        row,
        champion: row?.champion || "",
        tags: championStyleTags(row?.champion),
        goldShare,
        damageShare,
        kp,
        score: goldShare + damageShare * 1.1 + kp * 0.16,
        cs10Diff: Number.isFinite(cs10) && Number.isFinite(enemyCs10) ? cs10 - enemyCs10 : null,
        cs20Diff: Number.isFinite(cs20) && Number.isFinite(enemyCs20) ? cs20 - enemyCs20 : null,
      };
    }).filter((stat) => stat.row);
    const sortedRoles = roleStats.slice().sort((a, b) => b.score - a.score);
    const events = objectiveEvents(match);
    const allyEvents = events.filter((event) => event.teamKey === "ALLY");
    const firstByType = (type) => minuteFromTimestamp(allyEvents.find((event) => objectiveEventType(event) === type)?.timestamp);
    return {
      match,
      win: match.result === "Victoire",
      roleStats,
      sortedRoles,
      topRoles: sortedRoles.slice(0, 2).map((stat) => stat.role),
      firstObjectiveMinute: minuteFromTimestamp(allyEvents[0]?.timestamp),
      firstDragonMinute: firstByType("dragon"),
      firstGrubMinute: firstByType("grub"),
      firstHeraldMinute: firstByType("herald"),
      firstBaronMinute: firstByType("baron"),
      allyObjectiveCount: allyEvents.length,
    };
  }), [matches]);
  const detailHeader = detailSection && <>
    <nav aria-label="Retour aux tendances" className="trends-detail-breadcrumb"><a className="trends-text-action" href={navigation.detailHref("")} onClick={(event) => navigation.onNavigate(event)}><ArrowLeft aria-hidden="true" /> Retour à Draft</a></nav>
    <div ref={detailHeading} tabIndex={-1} className="trends-detail-heading" role="group" aria-label={detailSection.title}><PageHeader eyebrow="Tendances · Draft" title={detailSection.title} subtitle={detailSection.description} /></div>
  </>;

  if (!matches.length) return <div className="nxt5-data-dense nxt5-trends-page">
    {detailHeader || <PageHeader eyebrow="Comprendre l’équipe" title="Tendances d’équipe" subtitle="Lis le bilan, repère les évolutions et prépare le prochain bloc." />}
    {baseMatches.length > 0 && <div className="trends-filters"><div className="trends-filter-controls"><SelectInput label="Catégorie" value={selectedCategoryId} onChange={setSelectedCategoryId}><option value="">Toutes les games</option>{matchCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</SelectInput><TrendPeriodFilter value={trendPeriod} onChange={setTrendPeriod} /></div></div>}
    <Surface><EmptyState icon={Activity} title={baseMatches.length ? "Aucune game dans cette sélection" : "Vos tendances commencent ici"} text={baseMatches.length ? "Choisis un autre contexte pour retrouver les analyses de l’équipe." : "Importe tes premières games pour suivre les résultats et faire émerger les répétitions."} /><div className="mt-4 flex justify-center"><Button type="button" icon={baseMatches.length ? RefreshCw : Upload} onClick={() => { if (baseMatches.length) { navigation.resetFilters(); } else openAppPath("/games?import=1"); }}>{baseMatches.length ? "Voir toutes les games" : "Importer des games"}</Button></div></Surface>
  </div>;

  const avg = (value) => value / Math.max(1, matches.length);
  const avgInt = (value) => Math.round(avg(value));
  const signedAvg = (value) => `${value >= 0 ? "+" : ""}${formatPoints(avgInt(value))}`;
  const goldDiff = sumRows(ally, "gold") - sumRows(enemy, "gold");
  const damageDiff = sumRows(ally, "damage") - sumRows(enemy, "damage");
  const visionDiff = sumRows(ally, "vision") - sumRows(enemy, "vision");
  const deathsDiff = sumRows(ally, "deaths") - sumRows(enemy, "deaths");
  const identity = compositionIdentity(ally);
  const objectiveTotals = matches.reduce((total, match) => {
    const summary = objectiveTeamSummary(match, "ALLY");
    total.dragons += summary.dragonCount || 0;
    total.grubs += summary.grubs || 0;
    total.heralds += summary.heralds || 0;
    total.barons += summary.barons || 0;
    total.towers += summary.towers || 0;
    return total;
  }, { dragons: 0, grubs: 0, heralds: 0, barons: 0, towers: 0 });
  const championCounts = Array.from(ally.reduce((map, row) => {
    const key = championAssetId(row.champion);
    const current = map.get(key) || { champion: row.champion, games: 0, wins: 0, tags: championStyleTags(row.champion) };
    current.games += 1;
    current.wins += row.match?.result === "Victoire" ? 1 : 0;
    map.set(key, current);
    return map;
  }, new Map()).values()).sort((a, b) => b.games - a.games || b.wins - a.wins).slice(0, 8);
  const roleFocus = ROSTER_ROLE_ORDER.map((role) => {
    const roleRows = ally.filter((row) => normalizeProfileRole(row.role) === role);
    const games = roleRows.length;
    return { role, games, gold: sumRows(roleRows, "gold"), damage: sumRows(roleRows, "damage"), kills: sumRows(roleRows, "kills"), deaths: sumRows(roleRows, "deaths") };
  }).filter((stat) => stat.games).sort((a, b) => (b.gold + b.damage / 3) - (a.gold + a.damage / 3));
  const focusRole = roleFocus[0];
  const commonTags = (sourceRows) => Array.from(sourceRows.reduce((map, row) => {
    championStyleTags(row.champion).forEach((tag) => map.set(tag, (map.get(tag) || 0) + 1));
    return map;
  }, new Map()).entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const winRows = ally.filter((row) => row.match?.result === "Victoire");
  const lossRows = ally.filter((row) => row.match?.result === "Défaite");
  const winTags = commonTags(winRows);
  const lossTags = commonTags(lossRows);
  const objectiveRatio = (value, gamesCount) => {
    const ratio = Number(value || 0) / Math.max(1, gamesCount);
    return Number.isInteger(ratio) ? String(ratio) : ratio.toFixed(1);
  };
  const allySideForMatch = (match) => {
    const explicitSide = String(match?.side || "").toLowerCase();
    if (explicitSide.includes("blue")) return "Blue";
    if (explicitSide.includes("red")) return "Red";
    const allyTeamId = objectiveTeamId(match, "ALLY");
    if (allyTeamId === 100) return "Blue";
    if (allyTeamId === 200) return "Red";
    return "";
  };
  const sideStats = ["Blue", "Red"].map((side) => {
    const sideMatches = matches.filter((match) => allySideForMatch(match) === side);
    const sideWins = sideMatches.filter((match) => match.result === "Victoire").length;
    const objectives = sideMatches.reduce((total, match) => {
      const summary = objectiveTeamSummary(match, "ALLY");
      total.dragons += summary.dragonCount || 0;
      total.grubs += summary.grubs || 0;
      total.heralds += summary.heralds || 0;
      total.barons += summary.barons || 0;
      total.towers += summary.towers || 0;
      return total;
    }, { dragons: 0, grubs: 0, heralds: 0, barons: 0, towers: 0 });
    return { side, games: sideMatches.length, wins: sideWins, wr: Math.round((sideWins / Math.max(1, sideMatches.length)) * 100), objectives };
  });
  const matchKey = (match) => String(match?.id || match?.game_id || match?.match_id || matchDisplayName(match, "Game"));
  const sourceGameFromInsight = (entry) => {
    const match = entry.match;
    const allyRows = teamRows(match, "ALLY");
    const enemyRows = teamRows(match, "ENEMY");
    const topRole = entry.sortedRoles?.[0];
    const matchId = match.id || match.game_id || match.match_id || "";
    return {
      id: matchId,
      match,
      title: matchDisplayName(match, "Game"),
      result: match.result || "Analyse",
      side: match.side || "Side ?",
      patch: match.patch || "Patch ?",
      duration: match.duration || "--:--",
      goldDiff: sumRows(allyRows, "gold") - sumRows(enemyRows, "gold"),
      damageDiff: sumRows(allyRows, "damage") - sumRows(enemyRows, "damage"),
      visionDiff: sumRows(allyRows, "vision") - sumRows(enemyRows, "vision"),
      deaths: sumRows(allyRows, "deaths"),
      enemyDeaths: sumRows(enemyRows, "deaths"),
      firstObjective: formatMinute(entry.firstObjectiveMinute),
      objectiveCount: entry.allyObjectiveCount || 0,
      topRoles: entry.topRoles || [],
      topRole: topRole?.role || "",
      topChampion: topRole?.champion || "",
      topRoleLabel: topRole ? `${roleLabel(topRole.role)} · ${championDisplayName(topRole.champion)}` : "Rôle non isolé",
      topRoleDetail: topRole ? `${Math.round(topRole.goldShare)}% or · ${Math.round(topRole.damageShare)}% dégâts · KP ${Math.round(topRole.kp)}%` : "Pas assez de données rôle",
    };
  };
  const sourceGames = matchInsights.map(sourceGameFromInsight);
  const sourceGamesForMatches = (sourceMatches) => {
    const keys = new Set(sourceMatches.map(matchKey));
    return sourceGames.filter((game) => keys.has(matchKey(game.match)));
  };
  const sourceGamesForInsights = (entries) => sourceGamesForMatches(entries.map((entry) => entry.match));
  const sourceGamesForRole = (role) => sourceGamesForInsights(matchInsights.filter((entry) => entry.roleStats.some((stat) => stat.role === role)));
  const summarizeMatchSet = (targetMatches) => {
    const keys = new Set(targetMatches.map(matchKey));
    const targetInsights = matchInsights.filter((entry) => keys.has(matchKey(entry.match)));
    const targetRows = targetMatches.flatMap((match) => (match.participants || []).map((row) => ({ ...row, match })));
    const targetAlly = targetRows.filter((row) => row.team_key === "ALLY");
    const targetEnemy = targetRows.filter((row) => row.team_key === "ENEMY");
    const games = targetMatches.length;
    const firstObjectives = targetInsights.map((entry) => entry.firstObjectiveMinute).filter((value) => Number.isFinite(value));
    const objectives = targetMatches.reduce((total, match) => {
      const summary = objectiveTeamSummary(match, "ALLY");
      total.dragons += summary.dragonCount || 0;
      total.grubs += summary.grubs || 0;
      total.heralds += summary.heralds || 0;
      total.barons += summary.barons || 0;
      total.towers += summary.towers || 0;
      return total;
    }, { dragons: 0, grubs: 0, heralds: 0, barons: 0, towers: 0 });
    return {
      games,
      sourceGames: sourceGamesForMatches(targetMatches),
      goldDiff: Math.round((sumRows(targetAlly, "gold") - sumRows(targetEnemy, "gold")) / Math.max(1, games)),
      damageDiff: Math.round((sumRows(targetAlly, "damage") - sumRows(targetEnemy, "damage")) / Math.max(1, games)),
      visionDiff: Math.round((sumRows(targetAlly, "vision") - sumRows(targetEnemy, "vision")) / Math.max(1, games)),
      deaths: Number((sumRows(targetAlly, "deaths") / Math.max(1, games)).toFixed(1)),
      firstObjective: averageValues(firstObjectives),
      earlyObjectiveRate: Math.round((firstObjectives.filter((value) => value <= 9.5).length / Math.max(1, firstObjectives.length)) * 100),
      objectiveRate: Number(((objectives.dragons + objectives.grubs + objectives.heralds + objectives.barons) / Math.max(1, games)).toFixed(1)),
      tags: commonTags(targetAlly),
    };
  };
  const summarizePattern = (id, label, predicate, options = {}) => {
    const patternInsights = matchInsights.filter(predicate);
    const patternMatches = patternInsights.map((entry) => entry.match);
    const patternRows = patternMatches.flatMap((match) => (match.participants || []).map((row) => ({ ...row, match })));
    const patternAlly = patternRows.filter((row) => row.team_key === "ALLY");
    const patternEnemy = patternRows.filter((row) => row.team_key === "ENEMY");
    const games = patternInsights.length;
    const patternWins = patternInsights.filter((entry) => entry.win).length;
    const wr = Math.round((patternWins / Math.max(1, games)) * 100);
    const verdict = games < 5 ? "à confirmer" : wr >= 58 ? "signal favorable" : wr >= 48 ? "rendement neutre" : "rendement défavorable";
    const verdictTone = games < 5 ? "slate" : wr >= 58 ? "green" : wr >= 48 ? "orange" : "red";
    const avgGoldDiff = Math.round((sumRows(patternAlly, "gold") - sumRows(patternEnemy, "gold")) / Math.max(1, games));
    const avgDamageDiff = Math.round((sumRows(patternAlly, "damage") - sumRows(patternEnemy, "damage")) / Math.max(1, games));
    const cs10 = averageValues(patternInsights.flatMap((entry) => entry.roleStats.map((stat) => stat.cs10Diff)));
    const cs20 = averageValues(patternInsights.flatMap((entry) => entry.roleStats.map((stat) => stat.cs20Diff)));
    const firstObjective = averageValues(patternInsights.map((entry) => entry.firstObjectiveMinute));
    const firstDragon = averageValues(patternInsights.map((entry) => entry.firstDragonMinute));
    const firstGrub = averageValues(patternInsights.map((entry) => entry.firstGrubMinute));
    const bestRole = ROSTER_ROLE_ORDER.map((role) => ({
      role,
      score: averageValues(patternInsights.map((entry) => entry.roleStats.find((stat) => stat.role === role)?.score)),
      cs10: averageValues(patternInsights.map((entry) => entry.roleStats.find((stat) => stat.role === role)?.cs10Diff)),
    })).filter((stat) => Number.isFinite(stat.score)).sort((a, b) => b.score - a.score)[0];
    return {
      id,
      label,
      tone: options.tone || verdictTone,
      games,
      wins: patternWins,
      wr,
      verdict,
      verdictTone,
      bestRole,
      avgGoldDiff,
      avgDamageDiff,
      cs10,
      cs20,
      firstObjective,
      sourceGames: patternInsights.map(sourceGameFromInsight),
      details: [
        `${games} game${games > 1 ? "s" : ""} · ${patternWins} victoires · ${games - patternWins} défaites · ${wr}% de victoires`,
        `Écart or ${formatGoldDiff(avgGoldDiff)} · dégâts ${avgDamageDiff >= 0 ? "+" : ""}${formatPoints(avgDamageDiff)}`,
        `CS10 ${Number.isFinite(cs10) ? `${cs10 >= 0 ? "+" : ""}${cs10.toFixed(1)}` : "n/a"} · CS20 ${Number.isFinite(cs20) ? `${cs20 >= 0 ? "+" : ""}${cs20.toFixed(1)}` : "n/a"}`,
        `1er obj ${formatMinute(firstObjective)}${Number.isFinite(firstDragon) ? ` · Drake ${formatMinute(firstDragon)}` : Number.isFinite(firstGrub) ? ` · Grubs ${formatMinute(firstGrub)}` : ""}`,
      ],
      read: games ? `${label} : ${verdict}. ${games} game${games > 1 ? "s" : ""}, ${patternWins} victoires · ${games - patternWins} défaites, ${wr}% de victoires, ${formatGoldDiff(avgGoldDiff)} or/game et ${Number.isFinite(firstObjective) ? `premier objectif moyen à ${formatMinute(firstObjective)}` : "timing objectif non disponible"}.` : "",
    };
  };
  const hasTags = (stat, tags) => tags.some((tag) => stat?.tags?.includes(tag));
  const autoPatterns = [
    summarizePattern("adc-centric", "ADC centrique", (entry) => {
      const adc = entry.roleStats.find((stat) => stat.role === "ADC");
      return entry.topRoles[0] === "ADC" || (adc && (adc.score >= 54 || adc.goldShare >= 23 || adc.damageShare >= 29));
    }, { tone: "cyan" }),
    summarizePattern("jgl-mid", "Axe JGL + MID", (entry) => {
      const roles = new Set(entry.topRoles);
      const jungle = entry.roleStats.find((stat) => stat.role === "JGL");
      const mid = entry.roleStats.find((stat) => stat.role === "MID");
      return (roles.has("JGL") && roles.has("MID")) || ((jungle?.score || 0) + (mid?.score || 0) >= 94);
    }, { tone: "purple" }),
    summarizePattern("top-frontline", "TOP frontline / tank", (entry) => {
      const top = entry.roleStats.find((stat) => stat.role === "TOP");
      return hasTags(top, ["frontline", "engage", "teamfight", "control", "sustain", "peel"]);
    }, { tone: "green" }),
    summarizePattern("early-objectives", "Contrôle objectifs early", (entry) => Number.isFinite(entry.firstObjectiveMinute) && entry.firstObjectiveMinute <= 9.5, { tone: "orange" }),
    summarizePattern("front-to-back", "Front-to-back / scaling", (entry) => entry.roleStats.flatMap((stat) => stat.tags).filter((tag) => ["front-to-back", "scaling", "peel", "control"].includes(tag)).length >= 3, { tone: "blue" }),
  ].filter((pattern) => pattern.games).sort((a, b) => b.games - a.games || b.wr - a.wr).slice(0, 5);
  const laneTimings = ROSTER_ROLE_ORDER.map((role) => {
    const values10 = matchInsights.map((entry) => entry.roleStats.find((stat) => stat.role === role)?.cs10Diff).filter((value) => Number.isFinite(value));
    const values20 = matchInsights.map((entry) => entry.roleStats.find((stat) => stat.role === role)?.cs20Diff).filter((value) => Number.isFinite(value));
    return {
      role,
      cs10: averageValues(values10),
      cs20: averageValues(values20),
      samples: Math.max(values10.length, values20.length),
    };
  }).filter((stat) => stat.samples).sort((a, b) => Math.abs(b.cs10 || 0) - Math.abs(a.cs10 || 0));
  const strongestPattern = autoPatterns[0] || null;
  const fragilePattern = autoPatterns.slice().filter((pattern) => pattern.games >= 3 && pattern.wr < 50).sort((a, b) => a.wr - b.wr || b.games - a.games)[0] || null;
  const bestLaneTiming = laneTimings.filter((stat) => Number.isFinite(stat.cs10)).sort((a, b) => b.cs10 - a.cs10)[0] || null;
  const worstLaneTiming = laneTimings.filter((stat) => Number.isFinite(stat.cs10)).sort((a, b) => a.cs10 - b.cs10)[0] || null;
  const objectiveTimingValues = matchInsights.map((entry) => entry.firstObjectiveMinute).filter((value) => Number.isFinite(value));
  const averageFirstObjective = averageValues(objectiveTimingValues);
  const earlyObjectiveRate = objectiveTimingValues.length ? Math.round((objectiveTimingValues.filter((value) => value <= 9.5).length / objectiveTimingValues.length) * 100) : null;
  const earlyObjectiveLabel = earlyObjectiveRate === null ? "Non mesuré" : `${earlyObjectiveRate}%`;
  const bestSide = sideStats.filter((stat) => stat.games).sort((a, b) => b.wr - a.wr || b.games - a.games)[0] || null;
  const teamKpAverage = Math.round(ally.reduce((total, row) => total + parsePercent(row.kill_participation || row.kp || 0), 0) / Math.max(1, ally.length));
  const teamCsAverage = (ally.reduce((total, row) => total + Number(row.cs_per_min || 0), 0) / Math.max(1, ally.length)).toFixed(1);
  const deathsPerGame = Number(objectiveRatio(sumRows(ally, "deaths"), matches.length));
  const lossModel = summarizeMatchSet(matches.filter((match) => match.result === "Défaite"));
  const roleSystemRows = ROSTER_ROLE_ORDER.map((role) => {
    const roleInsights = matchInsights.filter((entry) => entry.roleStats.some((stat) => stat.role === role));
    const samples = roleInsights.map((entry) => entry.roleStats.find((stat) => stat.role === role)).filter(Boolean);
    const championText = Array.from(samples.reduce((map, stat) => {
      if (stat.champion) map.set(stat.champion, (map.get(stat.champion) || 0) + 1);
      return map;
    }, new Map()).entries()).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([champion, count]) => `${championDisplayName(champion)} x${count}`).join(" · ");
    const winsForRole = roleInsights.filter((entry) => entry.win).length;
    const goldShare = averageValues(samples.map((stat) => stat.goldShare));
    const damageShare = averageValues(samples.map((stat) => stat.damageShare));
    const kp = averageValues(samples.map((stat) => stat.kp));
    const cs10 = averageValues(samples.map((stat) => stat.cs10Diff));
    const cs20 = averageValues(samples.map((stat) => stat.cs20Diff));
    const score = averageValues(samples.map((stat) => stat.score));
    const functionLabel = damageShare >= 28 ? "Carry dégâts" : goldShare >= 23 ? "Ressources fortes" : kp >= 65 ? "Connecteur fights" : (cs10 || 0) >= 4 ? "Priorité lane" : (cs10 || 0) <= -4 ? "Lane sous pression" : "Rôle stable";
    return {
      role,
      games: samples.length,
      wins: winsForRole,
      wr: Math.round((winsForRole / Math.max(1, samples.length)) * 100),
      goldShare,
      damageShare,
      kp,
      cs10,
      cs20,
      score,
      championText,
      functionLabel,
      sourceGames: sourceGamesForRole(role),
      toneName: (cs10 || 0) < -5 ? "red" : damageShare >= 28 || goldShare >= 23 || kp >= 65 ? "green" : "cyan",
    };
  }).filter((row) => row.games).sort((a, b) => (b.score || 0) - (a.score || 0));
  const focusRoleModel = roleSystemRows.find((row) => row.role === focusRole?.role) || roleSystemRows[0];
  const objectiveSourceGames = matchInsights.filter((entry) => Number.isFinite(entry.firstObjectiveMinute)).map(sourceGameFromInsight);
  const teamModelCards = [
    {
      id: "win-condition",
      toneName: strongestPattern?.verdictTone || championStyleTone(identity.primary),
      label: "Condition de victoire",
      title: strongestPattern ? strongestPattern.label : tagLabel(identity.primary),
      value: strongestPattern ? `${strongestPattern.wr}% de victoires` : `${winrate}% de victoires`,
      text: strongestPattern ? `Le plan qui revient le plus : ${strongestPattern.games} games, ${strongestPattern.wins} victoires · ${strongestPattern.games - strongestPattern.wins} défaites. C'est la meilleure hypothèse actuelle pour comprendre comment l'équipe veut gagner.` : `Aucun pattern dominant assez net : l'identité la plus visible reste ${tagLabel(identity.primary)}.`,
      details: strongestPattern?.details || [
        identity.tags[0] && `${tagLabel(identity.tags[0][0])}: ${identity.tags[0][1]} pick(s).`,
        identity.tags[1] && `${tagLabel(identity.tags[1][0])}: ${identity.tags[1][1]} pick(s).`,
        identity.tags[2] && `${tagLabel(identity.tags[2][0])}: ${identity.tags[2][1]} pick(s).`,
      ].filter(Boolean),
      sourceGames: strongestPattern?.sourceGames || sourceGames,
    },
    {
      id: "resource-map",
      toneName: focusRoleModel?.toneName || "cyan",
      label: "Répartition des rôles",
      title: focusRoleModel ? `${roleLabel(focusRoleModel.role)} structure le jeu` : "Ressources non isolées",
      value: focusRoleModel ? `${Math.round(focusRoleModel.goldShare || 0)}% or` : "—",
      text: focusRoleModel ? `${roleLabel(focusRoleModel.role)} capte ${Math.round(focusRoleModel.goldShare || 0)}% de l'or, ${Math.round(focusRoleModel.damageShare || 0)}% des dégâts et ${Math.round(focusRoleModel.kp || 0)}% KP. À lire comme le rôle autour duquel l'équipe s'organise le plus souvent.` : "Le volume ne permet pas encore de lire une répartition fiable.",
      details: roleSystemRows.slice(0, 3).map((row) => `${roleLabel(row.role)} : ${row.functionLabel}, ${Math.round(row.goldShare || 0)}% or, ${Math.round(row.damageShare || 0)}% dégâts, ${row.wr}% de victoires`),
      sourceGames: focusRoleModel?.sourceGames || sourceGames,
    },
    {
      id: "tempo-map",
      toneName: averageFirstObjective && averageFirstObjective <= 9.5 ? "green" : averageFirstObjective && averageFirstObjective <= 12 ? "orange" : "red",
      label: "Tempo carte",
      title: `Premier objectif ${formatMinute(averageFirstObjective)}`,
      value: earlyObjectiveRate === null ? "Timing indisponible" : `${earlyObjectiveLabel} early`,
      text: `${earlyObjectiveRate === null ? "Aucun timing de premier objectif allié disponible." : `${earlyObjectiveLabel} avant 9:30 parmi les ${objectiveTimingValues.length} games avec un timing connu.`} Moyenne : ${formatMinute(averageFirstObjective)}, avec ${objectiveRatio(objectiveTotals.dragons, matches.length)} drakes/game et ${objectiveRatio(objectiveTotals.grubs, matches.length)} grubs/game.`,
      details: [`Timings exploitables : ${objectiveTimingValues.length}/${matches.length}`, `Objectifs neutres/game : ${objectiveRatio(objectiveTotals.dragons + objectiveTotals.grubs + objectiveTotals.heralds + objectiveTotals.barons, matches.length)}`, bestSide && `Side le plus rentable : ${bestSide.side} (${bestSide.wr}% de victoires sur ${bestSide.games}G)`].filter(Boolean),
      sourceGames: objectiveSourceGames,
    },
    {
      id: "fail-state",
      toneName: deathsPerGame >= 20 || fragilePattern?.wr < 45 ? "red" : "orange",
      label: "Fail state",
      title: fragilePattern ? `Risque : ${fragilePattern.label}` : "Risque principal",
      value: `${deathsPerGame.toFixed(Number.isInteger(deathsPerGame) ? 0 : 1)} morts/G`,
      text: fragilePattern ? `${fragilePattern.label} tombe à ${fragilePattern.wr}% de victoires. Quand ce pattern sort mal, la review doit vérifier les morts avant objectif, la vision du side faible et la surcharge d'une seule win condition.` : `Le signal le plus instable vient de l'exposition collective : ${deathsPerGame} morts/game, ${formatGoldDiff(lossModel.goldDiff)} or/game en défaite et ${lossModel.visionDiff >= 0 ? "+" : ""}${lossModel.visionDiff} vision en défaite.`,
      details: [`Morts équipe : ${deathsPerGame} / game`, `Défaites : ${lossModel.games} games, ${formatGoldDiff(lossModel.goldDiff)} or/game`, `Vision en défaite : ${lossModel.visionDiff >= 0 ? "+" : ""}${lossModel.visionDiff}`].filter(Boolean),
      sourceGames: fragilePattern?.sourceGames?.length ? fragilePattern.sourceGames : lossModel.sourceGames.length ? lossModel.sourceGames : sourceGames,
    },
  ];
  const primaryTeamModelCard = teamModelCards[0];

  const coachBriefs = [
    {
      toneName: winrate >= 55 ? "green" : winrate >= 45 ? "orange" : "red",
      label: "Bilan",
      title: `${winrate >= 55 ? "Bloc favorable" : winrate >= 45 ? "Bloc compétitif mais instable" : "Bloc défavorable"}`,
      text: `${matches.length} games, ${wins} victoires · ${losses} défaites. Écarts moyens : ${formatGoldDiff(avgInt(goldDiff))} or, ${signedAvg(damageDiff)} dégâts, ${signedAvg(visionDiff)} vision.${matches.length < 5 ? " L’échantillon reste limité." : ""}`,
      evidence: [`WR ${winrate}%`, `morts ${objectiveRatio(sumRows(ally, "deaths"), matches.length)}/game`, `KP équipe ${teamKpAverage}%`],
      sourceGames,
    },
    strongestPattern && {
      toneName: strongestPattern.verdictTone,
      label: "Plan de jeu",
      title: `${strongestPattern.label} · ${strongestPattern.verdict}`,
      text: `${strongestPattern.games} occurrence${strongestPattern.games > 1 ? "s" : ""}, ${strongestPattern.wins} victoires · ${strongestPattern.games - strongestPattern.wins} défaites, ${strongestPattern.wr}% de victoires. ${strongestPattern.bestRole ? `${roleLabel(strongestPattern.bestRole.role)} est le rôle le plus porteur dans ce pattern` : "Rôle porteur non isolé"}, avec ${formatGoldDiff(strongestPattern.avgGoldDiff)} or/game et ${strongestPattern.avgDamageDiff >= 0 ? "+" : ""}${formatPoints(strongestPattern.avgDamageDiff)} dégâts/game.`,
      evidence: [`Pattern ${strongestPattern.games} games`, `CS10 ${Number.isFinite(strongestPattern.cs10) ? `${strongestPattern.cs10 >= 0 ? "+" : ""}${strongestPattern.cs10.toFixed(1)}` : "n/a"}`, `1er obj ${formatMinute(strongestPattern.firstObjective)}`],
      sourceGames: strongestPattern.sourceGames,
    },
    {
      toneName: averageFirstObjective && averageFirstObjective <= 9.5 ? "green" : averageFirstObjective && averageFirstObjective <= 12 ? "orange" : "red",
      label: "Objectifs",
      title: Number.isFinite(averageFirstObjective) ? `Tempo objectifs : ${formatMinute(averageFirstObjective)}` : "Timing indisponible",
      text: `${objectiveRatio(objectiveTotals.dragons, matches.length)} drakes/game, ${objectiveRatio(objectiveTotals.grubs, matches.length)} grubs/game, ${objectiveRatio(objectiveTotals.towers, matches.length)} tours/game. ${earlyObjectiveRate === null ? "Timing du premier objectif indisponible" : `${earlyObjectiveLabel} avant 9:30 parmi les ${objectiveTimingValues.length} games avec timing connu`}${bestSide ? ` ; meilleur side actuel : ${bestSide.side} (${bestSide.wr}% de victoires sur ${bestSide.games}G)` : ""}.`,
      evidence: [`Nashor ${objectiveRatio(objectiveTotals.barons, matches.length)}/game`, `Herald ${objectiveRatio(objectiveTotals.heralds, matches.length)}/game`, `${objectiveTimingValues.length}/${matches.length} timings`],
      sourceGames: objectiveSourceGames,
    },
    {
      toneName: worstLaneTiming && worstLaneTiming.cs10 < -5 ? "red" : bestLaneTiming && bestLaneTiming.cs10 > 5 ? "green" : "orange",
      label: "Laning",
      title: worstLaneTiming && worstLaneTiming.cs10 < -5 ? `${roleLabel(worstLaneTiming.role)} sous pression` : bestLaneTiming ? `${roleLabel(bestLaneTiming.role)} crée la priorité` : "Peu de données de lane",
      text: `${bestLaneTiming ? `${roleLabel(bestLaneTiming.role)} meilleur CS10 (${bestLaneTiming.cs10 >= 0 ? "+" : ""}${bestLaneTiming.cs10.toFixed(1)})` : "Pas de CS10 fiable"}.${worstLaneTiming ? ` Point de contrôle : ${roleLabel(worstLaneTiming.role)} au CS10 (${worstLaneTiming.cs10 >= 0 ? "+" : ""}${worstLaneTiming.cs10.toFixed(1)}), CS20 ${Number.isFinite(worstLaneTiming.cs20) ? `${worstLaneTiming.cs20 >= 0 ? "+" : ""}${worstLaneTiming.cs20.toFixed(1)}` : "n/a"}.` : ""} À revoir : wave 1-3, premier reset et move river associé.`,
      evidence: [bestLaneTiming && `${roleLabel(bestLaneTiming.role)} ${bestLaneTiming.samples} sample(s)`, worstLaneTiming && `${roleLabel(worstLaneTiming.role)} ${worstLaneTiming.samples} sample(s)`, `CS/min ${teamCsAverage}`].filter(Boolean),
      sourceGames: sourceGamesForInsights(matchInsights.filter((entry) => entry.roleStats.some((stat) => [bestLaneTiming?.role, worstLaneTiming?.role].filter(Boolean).includes(stat.role)))),
    },
    {
      toneName: deathsPerGame >= 20 || fragilePattern?.wr < 45 ? "red" : "purple",
      label: "Priorité review",
      title: fragilePattern ? `Stabiliser ${fragilePattern.label}` : "Conserver les forces identifiées",
      text: fragilePattern ? `${fragilePattern.label} descend à ${fragilePattern.wr}% de victoires sur ${fragilePattern.games} games. Croiser cette séquence avec les morts avant objectif, la vision du side faible et le plan de draft associé.` : `Le bloc reste à stabiliser collectivement : ${teamKpAverage}% KP équipe, ${objectiveRatio(sumRows(ally, "deaths"), matches.length)} morts/game et ${signedAvg(visionDiff)} vision moyenne. Objectif : conserver le plan fort sans surcharger une seule condition de victoire.`,
      evidence: [`KP équipe ${teamKpAverage}%`, `Morts équipe ${objectiveRatio(sumRows(ally, "deaths"), matches.length)}/G`, `Vision ${signedAvg(visionDiff)}`].filter(Boolean),
      sourceGames: fragilePattern?.sourceGames || sourceGames,
    },
  ].filter(Boolean).slice(0, 5);

  const autoReads = coachBriefs.map((brief) => `${brief.label} — ${brief.title}. ${brief.text}`);
  const forceItems = [
    `${wins} victoires · ${losses} défaites sur ${matches.length} game${matches.length > 1 ? "s" : ""} (${winrate}% de victoires).`,
    `Écart or moyen: ${formatGoldDiff(avgInt(goldDiff))} par game.`,
    `Écart dégâts moyen: ${signedAvg(damageDiff)} par game.`,
    `Écart vision moyen: ${signedAvg(visionDiff)} par game.`,
    focusRole && `Ressources dominantes: ${roleLabel(focusRole.role)} (${formatPoints(avgInt(focusRole.gold))} or · ${formatPoints(avgInt(focusRole.damage))} dégâts).`
  ].filter(Boolean).slice(0, 5);
  const riskItems = [
    `Écart morts moyen: ${signedAvg(deathsDiff)} par game.`,
    `Morts alliées: ${objectiveRatio(sumRows(ally, "deaths"), matches.length)} par game.`,
    lossModel.games > 0 && `En défaite: ${lossModel.deaths} morts/game et ${formatGoldDiff(lossModel.goldDiff)} or/game.`,
    `Nashor: ${objectiveRatio(objectiveTotals.barons, matches.length)} par game.`,
    `Tours: ${objectiveRatio(objectiveTotals.towers, matches.length)} par game.`
  ].filter(Boolean).slice(0, 5);
  const timingItems = [
    `Drakes: ${objectiveRatio(objectiveTotals.dragons, matches.length)} par game.`,
    `Grubs: ${objectiveRatio(objectiveTotals.grubs, matches.length)} par game.`,
    `Herald: ${objectiveRatio(objectiveTotals.heralds, matches.length)} par game.`,
    `Nashor: ${objectiveRatio(objectiveTotals.barons, matches.length)} par game.`,
    `Tours: ${objectiveRatio(objectiveTotals.towers, matches.length)} par game.`
  ];
  const draftNeeds = [
    identity.tags[0] && `${tagLabel(identity.tags[0][0])}: ${identity.tags[0][1]} pick(s).`,
    identity.tags[1] && `${tagLabel(identity.tags[1][0])}: ${identity.tags[1][1]} pick(s).`,
    identity.tags[2] && `${tagLabel(identity.tags[2][0])}: ${identity.tags[2][1]} pick(s).`,
    winTags[0] && `En victoire: ${tagLabel(winTags[0][0])} x${winTags[0][1]}.`,
    lossTags[0] && `En défaite: ${tagLabel(lossTags[0][0])} x${lossTags[0][1]}.`
  ].filter(Boolean).slice(0, 5);
  const recommendations = [
    `KP moyen équipe: ${teamKpAverage}%.`,
    `CS/min moyen équipe: ${teamCsAverage}.`,
    `Rendement ressources: ${signedAvg(damageDiff)} dégâts pour ${formatGoldDiff(avgInt(goldDiff))} or par game.`,
    `Tempo objectif: ${formatMinute(averageFirstObjective)} en moyenne, ${earlyObjectiveLabel} avant 9:30 sur ${objectiveTimingValues.length} timings connus.`,
    focusRole && `Rôle moteur collectif: ${roleLabel(focusRole.role)} concentre les ressources du bloc.`
  ].filter(Boolean).slice(0, 5);

  const topMetrics = [
    { icon: Trophy, label: "Winrate", value: `${winrate}%`, hint: `${wins} victoires · ${losses} défaites`, tone: winrate >= 50 ? "green" : "red" },
    { icon: Flame, label: "Écart dégâts", value: signedAvg(damageDiff), hint: "Moyenne / game", tone: diffTone(damageDiff) },
    { icon: Eye, label: "Écart vision", value: signedAvg(visionDiff), hint: "Moyenne / game", tone: diffTone(visionDiff) },
    { icon: Shield, label: "Morts alliées", value: objectiveRatio(sumRows(ally, "deaths"), matches.length), hint: "Par game", tone: avg(sumRows(ally, "deaths")) <= 15 ? "green" : avg(sumRows(ally, "deaths")) >= 20 ? "red" : "orange" },
  ];

  const clampPercent = (value) => Math.max(0, Math.min(100, Math.round(Number(value || 0))));
  const objectiveTone = (progress) => {
    const value = clampPercent(progress);
    return value >= 78 ? "green" : value >= 52 ? "orange" : "red";
  };
  const roleAiObjectives = ROSTER_ROLE_ORDER.map((role) => {
    const row = roleSystemRows.find((item) => item.role === role);
    if (!row) return null;
    const cs10 = Number.isFinite(row.cs10) ? row.cs10 : 0;
    const kp = Number.isFinite(row.kp) ? row.kp : 0;
    const damageShare = Number.isFinite(row.damageShare) ? row.damageShare : 0;
    const goldShare = Number.isFinite(row.goldShare) ? row.goldShare : 0;
    const sourceGamesForObjective = row.sourceGames?.length ? row.sourceGames : sourceGamesForRole(role);
    let title = "Valider le rôle dans le plan";
    let target = "2 games propres sur les 3 prochaines";
    let current = `${row.wr}% de victoires`;
    let why = `${roleLabel(role)} est lu comme ${row.functionLabel.toLowerCase()} sur ce bloc.`;
    let progress = row.wr;
    if ((role === "TOP" || role === "MID") && cs10 < -3) {
      title = "Stabiliser la lane";
      target = "CS10 >= -3 pendant 3 games";
      current = `CS10 ${cs10 >= 0 ? "+" : ""}${cs10.toFixed(1)}`;
      why = "La lane perd trop tôt en ressources, donc les reviews doivent cibler waves 1-3, reset et couverture river.";
      progress = 100 - Math.min(100, Math.abs(cs10) * 12);
    } else if (role === "JGL" && earlyObjectiveRate !== null && earlyObjectiveRate < 60) {
      title = "Débloquer le premier objectif";
      target = "1er objectif avant 9:30 sur 2/3 games";
      current = `${earlyObjectiveRate}% avant 9:30`;
      why = "Le tempo jungle doit transformer la priorité lane en drake, grubs ou herald plus tôt.";
      progress = earlyObjectiveRate;
    } else if ((role === "ADC" || role === "TOP" || role === "MID") && damageShare < 24) {
      title = "Augmenter l'impact fight";
      target = "Part des dégâts ≥ 26%";
      current = `${Math.round(damageShare)}% dégâts`;
      why = "Le rôle a besoin d'un objectif mesurable en fights : positionnement, timing d'entrée et conversion DPS.";
      progress = (damageShare / 26) * 100;
    } else if (role === "SUP" && visionDiff < 0) {
      title = "Reprendre la vision objective";
      target = "Écart de vision positif 60 s avant l’objectif";
      current = signedAvg(visionDiff);
      why = "La préparation des objectifs passe par le support, même si l'exécution reste collective.";
      progress = 42;
    } else if (kp < 58) {
      title = "Reconnecter les actions";
      target = "KP >= 60% sur les 3 prochaines games";
      current = `KP ${Math.round(kp)}%`;
      why = "Le rôle apparaît trop isolé du résultat collectif ; l'objectif est de jouer plus tôt avec le noyau d'action.";
      progress = (kp / 60) * 100;
    } else if (goldShare >= 23 || damageShare >= 28 || kp >= 65) {
      title = "Assumer la condition forte";
      target = "Plan de jeu annoncé avant draft + review post-game";
      current = `${Math.round(goldShare)}% or / ${Math.round(damageShare)}% dégâts`;
      why = "Le rôle porte déjà une grosse partie de l'identité : l'objectif devient la répétition consciente du plan.";
      progress = Math.max(row.wr, 72);
    }
    return {
      role,
      title,
      target,
      current,
      why,
      progress: clampPercent(progress),
      toneName: objectiveTone(progress),
      sourceGames: sourceGamesForObjective,
    };
  }).filter(Boolean);
  const teamProfiles = sortPlayersByRole((data.players || []).filter((player) => String(player.team_id || "") === String(selectedTeamId || "") && isGameplayRole(player.role)));
  const profileAiObjectives = teamProfiles.map((player) => {
    const role = normalizeProfileRole(player.role);
    const profileRows = playerIntegratedRows(player, matches);
    const gamesCount = profileRows.length;
    const roleObjective = roleAiObjectives.find((item) => item.role === role);
    const profileWins = profileRows.filter((row) => row.match?.result === "Victoire").length;
    const avgProfile = (field) => profileRows.reduce((total, row) => total + Number(row[field] || 0), 0) / Math.max(1, gamesCount);
    const avgProfileKp = profileRows.reduce((total, row) => total + parsePercent(row.kill_participation || row.kp || 0), 0) / Math.max(1, gamesCount);
    const avgProfileDamageShare = profileRows.reduce((total, row) => total + shareOfTeam(row, teamRows(row.match, "ALLY"), "damage"), 0) / Math.max(1, gamesCount);
    const avgProfileGoldShare = profileRows.reduce((total, row) => total + shareOfTeam(row, teamRows(row.match, "ALLY"), "gold"), 0) / Math.max(1, gamesCount);
    const cs10Values = profileRows.map((row) => csAtMinute(row, 10)).filter((value) => Number.isFinite(value));
    const cs20Values = profileRows.map((row) => csAtMinute(row, 20)).filter((value) => Number.isFinite(value));
    const avgCs10 = averageValues(cs10Values);
    const avgCs20 = averageValues(cs20Values);
    const mainChampion = Array.from(profileRows.reduce((map, row) => {
      if (!row.champion) return map;
      const current = map.get(row.champion) || { champion: row.champion, games: 0, wins: 0 };
      current.games += 1;
      current.wins += row.match?.result === "Victoire" ? 1 : 0;
      map.set(row.champion, current);
      return map;
    }, new Map()).values()).sort((a, b) => b.games - a.games || b.wins - a.wins)[0];
    const worstDeathRow = profileRows.slice().sort((a, b) => Number(b.deaths || 0) - Number(a.deaths || 0))[0];
    const lowKpRow = profileRows.slice().sort((a, b) => parsePercent(a.kill_participation || a.kp || 0) - parsePercent(b.kill_participation || b.kp || 0))[0];
    const profileSourceGames = sourceGamesForMatches(Array.from(new Map(profileRows.map((row) => [matchKey(row.match), row.match])).values()));
    const rolePlaybook = {
      TOP: { habit: "annoncer wave state + TP 70s avant objectif", review: "waves 1-3, premier reset, morts side avant objectif", scrim: "1 objectif : arriver au fight sans perdre la wave side" },
      JGL: { habit: "annoncer premier path + premier objectif avant 3:15", review: "transition clear > river > objectif, pas seulement les fights", scrim: "2 objectifs early joués avec timer annoncé 45s avant" },
      MID: { habit: "transformer chaque prio en reset ou move river", review: "wave avant roam, position jungle adverse, timing de reset", scrim: "call du côté joué avant chaque objectif neutre" },
      ADC: { habit: "annoncer quand tu peux taper et quand tu dois attendre peel", review: "distance en fight, resets canon, morts avant 20", scrim: "1 fight joué sans flash défensif forcé avant l'objectif" },
      SUP: { habit: "poser la première vision objectif avant le reset adverse", review: "roams sans wave crash, facechecks, accès river", scrim: "setup vision 60s avant objectif + annonce de la zone interdite" },
    }[role] || { habit: "clarifier le rôle avant la game", review: "décisions clés du poste", scrim: "un test mesurable sur 3 games" };
    let title = roleObjective?.title || "Créer un objectif profil";
    let target = roleObjective?.target || "3 games avec une intention claire";
    let trigger = roleObjective?.why || "Le profil doit être relié au plan d'équipe.";
    let drill = rolePlaybook.scrim;
    let review = rolePlaybook.review;
    let validation = "Validé si la cible est tenue sur 2 des 3 prochaines games.";
    let danger = "Pas assez de volume, ne pas surinterpréter.";
    let progress = gamesCount ? profileWins / Math.max(1, gamesCount) * 100 : 18;
    if (!gamesCount) {
      title = "Brancher le profil aux données";
      target = "Importer 3 games où ce Riot ID est présent";
      trigger = "Aucune game importée ne permet encore de lire ce joueur individuellement.";
      drill = "Après chaque import : vérifier que le profil NXT5 est bien lié au compte Riot.";
      review = "Pas de review individuelle tant que le profil n'a pas au moins 3 games.";
      validation = "Validé à 3 games exploitables.";
      danger = "Sans linkage, NXT5 ne peut proposer que l'objectif du rôle.";
    } else if ((role === "TOP" || role === "MID" || role === "ADC") && Number.isFinite(avgCs10) && avgCs10 < 68) {
      title = "Réparer le plan de lane";
      target = `${role === "ADC" ? "CS10 >= 72" : "CS10 >= 70"} sur 2/3 games`;
      trigger = `CS10 moyen ${Math.round(avgCs10)}${Number.isFinite(avgCs20) ? `, CS20 ${Math.round(avgCs20)}` : ""}.`;
      drill = rolePlaybook.habit;
      validation = "Validé si le CS10 remonte sans augmenter les morts avant objectif.";
      danger = "Si le CS10 monte mais les deaths montent aussi, le problème est le trade pattern.";
      progress = (avgCs10 / (role === "ADC" ? 72 : 70)) * 100;
    } else if (avgProfile("deaths") >= 4.2) {
      title = "Baisser l'exposition";
      target = "<= 3.5 morts/game sur le prochain bloc";
      trigger = `${avgProfile("deaths").toFixed(1)} morts/game, pic à ${Number(worstDeathRow?.deaths || 0)} morts.`;
      drill = "Avant chaque objectif : annoncer reset / catch / fight, puis respecter l'appel.";
      validation = "Validé si aucune mort n'arrive dans les 60s avant deux objectifs clés.";
      danger = worstDeathRow ? `Review prioritaire : ${matchDisplayName(worstDeathRow.match, "game")} sur ${championDisplayName(worstDeathRow.champion)}.` : "Attention aux morts qui cassent les setups.";
      progress = 100 - Math.min(100, (avgProfile("deaths") - 2.6) * 18);
    } else if (avgProfileKp < 56) {
      title = "Reconnecter le joueur au plan";
      target = "KP >= 60% sur 2/3 games";
      trigger = `KP moyen ${Math.round(avgProfileKp)}%, trop bas pour un rôle qui doit peser dans les actions collectives.`;
      drill = rolePlaybook.habit;
      validation = "Validé si le joueur est présent sur les deux premiers fights utiles.";
      danger = lowKpRow ? `Game à ouvrir : ${matchDisplayName(lowKpRow.match, "game")} (${Math.round(parsePercent(lowKpRow.kill_participation || lowKpRow.kp || 0))}% KP).` : "Le risque est d'avoir une bonne lane sans conversion collective.";
      progress = (avgProfileKp / 60) * 100;
    } else if ((role === "ADC" || role === "MID" || role === "TOP") && avgProfileDamageShare < avgProfileGoldShare - 2) {
      title = "Convertir les ressources";
      target = "Damage share >= gold share - 1";
      trigger = `${avgProfileGoldShare.toFixed(1)}% or pour ${avgProfileDamageShare.toFixed(1)}% dégâts.`;
      drill = "Review des fights gagnables : position d'entrée, cible tapée, spell défensif utilisé.";
      validation = "Validé si l'écart ressources/dégâts repasse sous 1 point.";
      danger = "Si les ressources ne deviennent pas des dégâts, il faut ajuster draft ou setup fight.";
      progress = 100 - Math.min(100, Math.max(0, avgProfileGoldShare - avgProfileDamageShare) * 12);
    }
    return {
      player,
      role,
      games: gamesCount,
      title,
      target,
      trigger,
      drill,
      review,
      validation,
      danger,
      progress: clampPercent(progress),
      toneName: objectiveTone(progress),
      sourceGames: profileSourceGames.length ? profileSourceGames : roleObjective?.sourceGames || sourceGames,
      mainChampion,
      stats: gamesCount ? [`${profileWins} victoires · ${gamesCount - profileWins} défaites`, `KP ${Math.round(avgProfileKp)}%`, `${avgProfile("deaths").toFixed(1)} morts/G`, mainChampion ? championDisplayName(mainChampion.champion) : "Pool à lire"] : ["0 game", player.riot_id || "Riot ID manquant", roleLabel(role), "À lier"],
    };
  });
  const teamAiObjective = (() => {
    if (earlyObjectiveRate !== null && earlyObjectiveRate < 55) {
      return {
        title: "Accélérer le premier objectif",
        target: "2 games sur 3 avec un objectif avant 9:30",
        current: `${earlyObjectiveRate}% actuellement`,
        why: `Le premier objectif moyen arrive à ${formatMinute(averageFirstObjective)}. C'est le meilleur levier collectif du bloc.`,
        progress: clampPercent(earlyObjectiveRate),
        toneName: objectiveTone(earlyObjectiveRate),
        sourceGames: objectiveSourceGames,
      };
    }
    if (deathsPerGame >= 18) {
      const progress = 100 - Math.min(100, (deathsPerGame - 12) * 8);
      return {
        title: "Réduire les morts gratuites",
        target: "<= 16 morts équipe par game",
        current: `${deathsPerGame.toFixed(Number.isInteger(deathsPerGame) ? 0 : 1)} morts/G`,
        why: "Les deaths montent trop haut pour transformer les bons plans en games contrôlées.",
        progress: clampPercent(progress),
        toneName: objectiveTone(progress),
        sourceGames: lossModel.sourceGames.length ? lossModel.sourceGames : sourceGames,
      };
    }
    if (visionDiff < 0) {
      const progress = clampPercent(50 + avgInt(visionDiff) * 2);
      return {
        title: "Reprendre l'information carte",
        target: "Vision diff positive sur le prochain bloc",
        current: signedAvg(visionDiff),
        why: "L'équipe joue avec moins d'information que l'adversaire, ce qui fragilise setups et entrées rivière.",
        progress,
        toneName: objectiveTone(progress),
        sourceGames,
      };
    }
    if (fragilePattern) {
      const progress = clampPercent(fragilePattern.wr);
      return {
        title: `Stabiliser ${fragilePattern.label}`,
        target: "1 review ciblée + 2 drafts test",
        current: `${fragilePattern.wr}% de victoires`,
        why: "Le pattern existe mais son rendement chute : il faut séparer problème de draft, exécution et timing.",
        progress,
        toneName: objectiveTone(progress),
        sourceGames: fragilePattern.sourceGames,
      };
    }
    return {
      title: "Conserver le plan fort",
      target: "Reproduire le plan sur 3 games consécutives",
      current: `${winrate}% de victoires`,
      why: "Le bloc est plutôt sain : l'objectif sert à garder une direction claire, pas à tout changer.",
      progress: clampPercent(winrate),
      toneName: objectiveTone(winrate),
      sourceGames,
    };
  })();
  const aiObjectiveItems = [
    `Équipe: ${teamAiObjective.title} — ${teamAiObjective.target}.`,
    ...profileAiObjectives.map((item) => `${item.player.name}: ${item.title} — ${item.target}.`),
    ...roleAiObjectives.map((item) => `${roleLabel(item.role)}: ${item.title} — ${item.target}.`)
  ].slice(0, 10);
  const exportTrendSections = [
    { title: "Objectifs", items: aiObjectiveItems, tone: "purple" },
    { title: "Modèle d'équipe", items: teamModelCards.map((card) => `${card.label}: ${card.title}. ${card.text}`), tone: "cyan" },
    { title: "Lecture automatique", items: autoReads, tone: "cyan" },
    { title: "Écarts moyens", items: forceItems, tone: "green" },
    { title: "Pression et exposition", items: riskItems, tone: "red" },
    { title: "Objectifs / game", items: timingItems, tone: "cyan" },
    { title: "Identité draft", items: draftNeeds, tone: "purple" },
    { title: "Lecture collective", items: recommendations, tone: "orange" },
  ];
  const exportTrends = async () => {
    setExportState("loading");
    try { await exportTrendsPng({
    title: "Tendances d’équipe",
    subtitle: `${activeTrendCategory?.name || "Toutes les games"} · ${trendPeriod === "all" ? "Historique complet" : `${trendPeriod} dernières`} · ${matches.length} game${matches.length > 1 ? "s" : ""} · ${wins} victoires · ${losses} défaites`,
    metrics: topMetrics,
    sections: exportTrendSections,
    champions: championCounts,
    filename: `nxt5-tendances-${String(activeTrendCategory?.name || "global").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`
  });
    setExportState("done");
    } catch { setExportState("error"); }
  };
  const openTrendSources = ({ title, subtitle, metrics, games }) => {
    const scopedGames = games ?? sourceGames;
    const resultGames = scopedGames.filter((game) => ["Victoire", "Défaite"].includes(game.result));
    setTrendSourceModal({
      title,
      subtitle,
      metrics: metrics || [
        { label: "Contexte", value: activeTrendCategory?.name || "Toutes" },
        { label: "Games sources", value: String(scopedGames.length) },
        { label: "Timelines", value: `${scopedGames.filter((game) => hasTrendTimeline(game.match)).length}/${scopedGames.length}` },
        { label: "WR sources", value: resultGames.length ? `${Math.round(resultGames.filter((game) => game.result === "Victoire").length / resultGames.length * 100)}%` : "—" },
      ],
      games: scopedGames,
    });
  };
  const openSourceGame = (game) => {
    const matchId = game?.id || game?.match?.id || game?.match?.game_id || "";
    openAppPath(matchId ? `/games?match=${encodeURIComponent(String(matchId))}` : "/games");
  };
  const sourceGameSignals = (game) => [
    { label: "Or", value: formatGoldDiff(game.goldDiff), toneName: game.goldDiff >= 0 ? "green" : "red" },
    { label: "Dégâts", value: `${game.damageDiff >= 0 ? "+" : ""}${formatPoints(game.damageDiff)}`, toneName: game.damageDiff >= 0 ? "green" : "red" },
    { label: "Vision", value: `${game.visionDiff >= 0 ? "+" : ""}${game.visionDiff}`, toneName: game.visionDiff >= 0 ? "cyan" : "red" },
    { label: "Morts : nous / adv.", value: `${game.deaths} / ${game.enemyDeaths}`, toneName: game.deaths <= game.enemyDeaths ? "green" : "orange" },
    { label: "Premier objectif", value: game.firstObjective || "—", toneName: game.firstObjective && game.firstObjective !== "—" ? "cyan" : "slate" },
  ];
  const sourceGameRead = (game) => {
    if (game.result === "Victoire" && game.goldDiff >= 0) return "Victoire avec un avantage d’or en fin de game.";
    if (game.result === "Victoire" && game.goldDiff < 0) return "Victoire malgré un retard d’or en fin de game : revoir les fights décisifs.";
    if (game.result === "Défaite" && game.deaths > game.enemyDeaths) return "Plus de morts en défaite : vérifier leur contexte avant de conclure.";
    if (game.visionDiff < 0) return "Information défavorable : setup objectif ou facecheck à revoir.";
    return "Game utile pour comparer exécution, tempo objectif et rôle moteur.";
  };
  const draftTrendModel = buildDraftTrendModel(matches);
  const staffAlerts = buildStaffAlerts(matches, (data.players || []).filter((player) => player.team_id === selectedTeamId));
  const trendPanelOptions = [
    ["coach", "Synthèse", Gauge, "Préparer la review"],
    ["evolution", "Évolution", Activity, "Suivre game après game"],
    ["comparison", "Comparer", RefreshCw, "Confronter deux sélections"],
    ["draft", "Draft", Crown, "Champions et compositions"],
    ["ai-objectives", "Objectifs", Target, "Cibles équipe et joueurs"],
  ];
  const showObjectives = () => {
    focusObjectives.current = true;
    setTrendPanel("ai-objectives");
  };

  return <div className="nxt5-data-dense nxt5-trends-page">
    {detailHeader || <PageHeader eyebrow="Comprendre l’équipe" title="Tendances d’équipe" subtitle="Lis le bilan, repère les évolutions et prépare le prochain bloc.">
      <Button type="button" variant="ghost" icon={ImageIcon} disabled={exportState === "loading"} onClick={exportTrends}>{exportState === "loading" ? "Export en cours…" : "Exporter la synthèse"}</Button>
    </PageHeader>}
    {exportState === "error" && <p role="alert" className="trends-export-status">L’export n’a pas abouti. Réessaie avec le bouton « Exporter la synthèse ».</p>}
    {exportState === "done" && <p role="status" className="trends-export-status">La synthèse PNG a été téléchargée.</p>}
    <div className="trends-filters">
      <div className="trends-filter-controls">
        <SelectInput label="Catégorie" value={selectedCategoryId} onChange={setSelectedCategoryId}><option value="">Toutes les games</option>{matchCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</SelectInput>
        <TrendPeriodFilter value={trendPeriod} onChange={setTrendPeriod} />
      </div>
      <div className="trends-scope"><p aria-live="polite"><strong>{matches.length} game{matches.length > 1 ? "s" : ""} analysée{matches.length > 1 ? "s" : ""}</strong> sur {categoryMatches.length} · {activeTrendCategory?.name || "Tous les contextes"}</p>{(selectedCategoryId || trendPeriod !== "all") && <button type="button" className="trends-text-action" onClick={() => { navigation.resetFilters(); }}><RefreshCw aria-hidden="true" /> Réinitialiser les filtres</button>}</div>
    </div>
    {matches.length < 5 && <p className="trends-sample-note"><AlertTriangle aria-hidden="true" /><span>Petit échantillon : les patterns restent à confirmer. Ces observations portent sur {matches.length} game{matches.length > 1 ? "s" : ""}.</span></p>}
    {detailSection ? <DraftTrendDetails key={draftDetail} sectionId={draftDetail} model={draftTrendModel} onOpenSources={openTrendSources} sourceGamesForMatches={sourceGamesForMatches} /> : <>
    <TrendNavigation items={trendPanelOptions} activeId={trendPanel} onChange={setTrendPanel} />
    {trendPanelOptions.map(([id, label]) => <div key={id} id={`trend-panel-${id}`} role="tabpanel" aria-label={label} tabIndex={0} hidden={trendPanel !== id} className="trends-tab-content">
      {trendPanel === id && <>
        {id === "coach" && <TrendsOverview objective={teamAiObjective} plan={primaryTeamModelCard} roles={roleSystemRows} briefs={coachBriefs} alerts={staffAlerts} onOpenSources={openTrendSources} onObjectives={showObjectives} />}
        {id === "evolution" && <TrendEvolution matches={matches} onOpenMatch={openSourceGame} />}
        {id === "comparison" && <Suspense fallback={<Surface><p className="mb-3 text-sm font-semibold text-slate-300" role="status">Chargement de la comparaison…</p><SkeletonRows /></Surface>}><BlockComparisonPanel matches={matches} categories={matchCategories} /></Suspense>}
        {id === "draft" && <DraftTrendsModule model={draftTrendModel} onOpenSources={openTrendSources} sourceGamesForMatches={sourceGamesForMatches} detailHref={navigation.detailHref} onNavigateDetail={navigation.onNavigate} />}
        {id === "ai-objectives" && <Surface><ProgressionObjectives teamObjective={teamAiObjective} roleObjectives={roleAiObjectives} gamesCount={matches.length} onOpenSources={openTrendSources} onOpenContracts={() => setProfileContractsOpen(true)} /></Surface>}
      </>}
    </div>)}
    </>}
    <details className="trends-reading-help"><summary>Comment lire ces informations ?</summary><div><p>Les filtres s’appliquent à toutes les rubriques. Les écarts d’or, de dégâts et de vision comparent notre équipe aux adversaires à la fin des games : une valeur par game dans Évolution, des moyennes par bloc dans Comparer. Une valeur positive indique un avantage sur cette mesure.</p><p>KP : participation aux éliminations de l’équipe. CS10 / CS20 : nombre de sbires et monstres tués à 10 / 20 minutes ; dans une comparaison, l’écart est calculé face au rôle adverse. WR : taux de victoire. « — » indique une donnée indisponible.</p><p>Les plans de jeu et objectifs sont des pistes à vérifier dans les games sources. Une répétition ou une évolution ne suffit pas à prouver sa cause.</p></div></details>
    {profileContractsOpen && <TrendContractsDialog objectives={profileAiObjectives} onClose={() => setProfileContractsOpen(false)} onOpenSources={openTrendSources} />}
    {trendSourceModal && <TrendSourcesDialog source={trendSourceModal} onClose={() => setTrendSourceModal(null)} onOpenGame={openSourceGame} signals={sourceGameSignals} read={sourceGameRead} />}
  </div>;
}

export { TrendsPage, BlockComparisonPanel };
export { buildDraftTrendModel, draftRows, draftIdentityForRows, draftTagScores, DRAFT_SCORE_TAGS, DraftTrendsModule, DraftMiniChampion, DraftScoreBoard, draftScoreTone, DraftTrendTable } from "../../components/trends/DraftTrends.jsx";
