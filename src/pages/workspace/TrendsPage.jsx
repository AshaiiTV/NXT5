import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Activity, ArrowRight, AlertTriangle, Crown, Eye, FileText, Flame, Gauge, Image as ImageIcon, RefreshCw, Shield, Sparkles, Target, Trophy, Upload, Users, X } from "lucide-react";
import { openAppPath } from "../../app/routing.js";
import { RoleIcon } from "../../components/brand/BrandAssets.jsx";
import { Badge, Button, EmptyState, PageHeader, SkeletonRows, Surface, TabNav } from "../../components/ui/Core.jsx";
import { cx, tone } from "../../app/helpers.js";
import { matchDisplayName, matchHasCategory } from "../../utils/matches.js";
import { csAtMinute } from "../../utils/match-timeline.js";
import { championAssetId, championPortraitSources, championDisplayName, compositionIdentity, championStyleTags, championStyleTone, tagLabel, sortPlayersByRole, ROSTER_ROLE_ORDER, isGameplayRole, formatPoints, formatGoldDiff, buildStaffAlerts, formatCountdown, normalizeProfileRole, playerIntegratedRows, matchCategoryTone, CategoryFilter, parsePercent, statValue, teamRows, sumRows, shareOfTeam, objectiveEventType, objectiveEvents, objectiveTeamId, objectiveTeamSummary, diffTone, lazyNamed, loadNextPhase, ChampionBackdrop, ChampionPortrait } from "./workspace-shared.jsx";
import { roleLabel } from "./shell-shared.jsx";
import { hasTrendTimeline, sortTrendMatches } from "../../utils/trends.js";
import { TrendEvolution, TrendPeriodFilter } from "../../components/trends/TrendEvolution.jsx";
import { ProgressionObjectives } from "../../components/trends/ProgressionObjectives.jsx";
import { PNG_THEME, pngAccent, pngFitText, pngWrapText, pngPanel, pngBackground, pngHeader, pngMetricStrip, pngFooter, pngLoadImage, pngImageCover, pngDownload } from "../../utils/png-report.js";

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
    fit(`${stat.games}G · ${Math.round((stat.wins / Math.max(1, stat.games)) * 100)}% WR`, x + 60, championsY + 110, championWidth - 76, { font: "500 15px Inter, Arial, sans-serif", color: PNG_THEME.muted, min: 12 });
  });
  if (!champions.length) fit("Aucun champion dans cette sélection.", margin + 28, championsY + 92, contentWidth - 56, { font: bodyFont, color: PNG_THEME.muted });
  pngFooter(ctx, { width: W, height: H, label: "Tendances · Synthèse stratégique" });
  await pngDownload(canvas, filename || "nxt5-tendances.png");
}

function TrendsPage({ data, selectedTeamId }) {
  const baseMatches = useMemo(() => (data.matches || []).filter((match) => match.team_id === selectedTeamId), [data.matches, selectedTeamId]);
  const matchCategories = useMemo(() => (data.matchCategories || []).filter((category) => category.team_id === selectedTeamId), [data.matchCategories, selectedTeamId]);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [trendSourceModal, setTrendSourceModal] = useState(null);
  const [expandedTrendPatternId, setExpandedTrendPatternId] = useState("");
  const [expandedTeamModelId, setExpandedTeamModelId] = useState("win-condition");
  const [trendPanel, setTrendPanel] = useState("coach");
  const [profileContractsOpen, setProfileContractsOpen] = useState(false);
  const [trendPeriod, setTrendPeriod] = useState("all");
  const sourceDialogRef = useRef(null);
  const categoryMatches = useMemo(() => sortTrendMatches(selectedCategoryId ? baseMatches.filter((match) => matchHasCategory(match, selectedCategoryId)) : baseMatches), [baseMatches, selectedCategoryId]);
  const matches = useMemo(() => trendPeriod === "all" ? categoryMatches : categoryMatches.slice(0, Number(trendPeriod)), [categoryMatches, trendPeriod]);
  useEffect(() => {
    setSelectedCategoryId("");
    setTrendPeriod("all");
    setTrendSourceModal(null);
  }, [selectedTeamId]);
  useEffect(() => { setTrendSourceModal(null); }, [matches]);
  useEffect(() => {
    if (!trendSourceModal) return undefined;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const dialog = sourceDialogRef.current;
    dialog?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setTrendSourceModal(null); }
      if (event.key !== "Tab") return;
      const controls = Array.from(dialog?.querySelectorAll('button, a[href], input, select, textarea, [tabindex="0"]') || []).filter((node) => !node.disabled);
      const first = controls[0];
      const last = controls.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog)) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", onKeyDown, true); if (previousFocus?.isConnected) previousFocus.focus(); };
  }, [trendSourceModal]);
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
  const formatMinute = (value) => Number.isFinite(value) ? formatCountdown(Math.round(value * 60)) : "--";
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
  if (!matches.length) return <div className="nxt5-data-dense min-w-0 overflow-hidden">
    <div className="mb-5 border-b border-cyan-100/10 pb-5">
      <PageHeader eyebrow="Tendances" title="Tendances d’équipe" subtitle="Les évolutions, les répétitions et le prochain axe de travail.">
        <span className="text-sm font-semibold text-slate-300">{baseMatches.length} game{baseMatches.length > 1 ? "s" : ""} importée{baseMatches.length > 1 ? "s" : ""}</span>
      </PageHeader>
      <div className="mt-5 border-t border-white/8 pt-3">
        <CategoryFilter categories={matchCategories} selectedCategoryId={selectedCategoryId} onSelect={setSelectedCategoryId} label="Type de games" />
      </div>
    </div>
    <Surface glow><EmptyState icon={Activity} title={baseMatches.length ? "Aucune game dans cette sélection" : "Vos tendances commencent ici"} text={baseMatches.length ? "Choisis un autre contexte pour retrouver les analyses de l’équipe." : "Importe tes premières games pour suivre les résultats et faire émerger les répétitions."} /><div className="mt-4 flex justify-center"><Button icon={baseMatches.length ? RefreshCw : Upload} onClick={() => baseMatches.length ? setSelectedCategoryId("") : openAppPath("/games?import=1")}>{baseMatches.length ? "Voir toutes les games" : "Importer des games"}</Button></div></Surface>
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
  const timelineGamesCount = matches.filter(hasTrendTimeline).length;
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
        `${games} game${games > 1 ? "s" : ""} · ${patternWins}W-${games - patternWins}L · ${wr}% WR`,
        `Écart or ${formatGoldDiff(avgGoldDiff)} · dégâts ${avgDamageDiff >= 0 ? "+" : ""}${formatPoints(avgDamageDiff)}`,
        `CS10 ${Number.isFinite(cs10) ? `${cs10 >= 0 ? "+" : ""}${cs10.toFixed(1)}` : "n/a"} · CS20 ${Number.isFinite(cs20) ? `${cs20 >= 0 ? "+" : ""}${cs20.toFixed(1)}` : "n/a"}`,
        `1er obj ${formatMinute(firstObjective)}${Number.isFinite(firstDragon) ? ` · Drake ${formatMinute(firstDragon)}` : Number.isFinite(firstGrub) ? ` · Grubs ${formatMinute(firstGrub)}` : ""}`,
      ],
      read: games ? `${label} : ${verdict}. ${games} game${games > 1 ? "s" : ""}, ${patternWins}W-${games - patternWins}L, ${wr}% WR, ${formatGoldDiff(avgGoldDiff)} or/game et ${Number.isFinite(firstObjective) ? `premier objectif moyen à ${formatMinute(firstObjective)}` : "timing objectif non disponible"}.` : "",
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
  const winModel = summarizeMatchSet(matches.filter((match) => match.result === "Victoire"));
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
      value: strongestPattern ? `${strongestPattern.wr}% WR` : `${winrate}% WR`,
      text: strongestPattern ? `Le plan qui revient le plus : ${strongestPattern.games} games, ${strongestPattern.wins}W-${strongestPattern.games - strongestPattern.wins}L. C'est la meilleure hypothèse actuelle pour comprendre comment l'équipe veut gagner.` : `Aucun pattern dominant assez net : l'identité la plus visible reste ${tagLabel(identity.primary)}.`,
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
      value: focusRoleModel ? `${Math.round(focusRoleModel.goldShare || 0)}% or` : "--",
      text: focusRoleModel ? `${roleLabel(focusRoleModel.role)} capte ${Math.round(focusRoleModel.goldShare || 0)}% de l'or, ${Math.round(focusRoleModel.damageShare || 0)}% des dégâts et ${Math.round(focusRoleModel.kp || 0)}% KP. À lire comme le rôle autour duquel l'équipe s'organise le plus souvent.` : "Le volume ne permet pas encore de lire une répartition fiable.",
      details: roleSystemRows.slice(0, 3).map((row) => `${roleLabel(row.role)} : ${row.functionLabel}, ${Math.round(row.goldShare || 0)}% or, ${Math.round(row.damageShare || 0)}% dégâts, ${row.wr}% WR`),
      sourceGames: focusRoleModel?.sourceGames || sourceGames,
    },
    {
      id: "tempo-map",
      toneName: averageFirstObjective && averageFirstObjective <= 9.5 ? "green" : averageFirstObjective && averageFirstObjective <= 12 ? "orange" : "red",
      label: "Tempo carte",
      title: `Premier objectif ${formatMinute(averageFirstObjective)}`,
      value: earlyObjectiveRate === null ? "Timing indisponible" : `${earlyObjectiveLabel} early`,
      text: `${earlyObjectiveRate === null ? "Aucun timing de premier objectif allié disponible." : `${earlyObjectiveLabel} avant 9:30 parmi les ${objectiveTimingValues.length} games avec un timing connu.`} Moyenne : ${formatMinute(averageFirstObjective)}, avec ${objectiveRatio(objectiveTotals.dragons, matches.length)} drakes/game et ${objectiveRatio(objectiveTotals.grubs, matches.length)} grubs/game.`,
      details: [`Timings exploitables : ${objectiveTimingValues.length}/${matches.length}`, `Objectifs neutres/game : ${objectiveRatio(objectiveTotals.dragons + objectiveTotals.grubs + objectiveTotals.heralds + objectiveTotals.barons, matches.length)}`, bestSide && `Side le plus rentable : ${bestSide.side} (${bestSide.wr}% WR sur ${bestSide.games}G)`].filter(Boolean),
      sourceGames: objectiveSourceGames,
    },
    {
      id: "fail-state",
      toneName: deathsPerGame >= 20 || fragilePattern?.wr < 45 ? "red" : "orange",
      label: "Fail state",
      title: fragilePattern ? `Risque : ${fragilePattern.label}` : "Risque principal",
      value: `${deathsPerGame.toFixed(Number.isInteger(deathsPerGame) ? 0 : 1)} morts/G`,
      text: fragilePattern ? `${fragilePattern.label} tombe à ${fragilePattern.wr}% WR. Quand ce pattern sort mal, la review doit vérifier les morts avant objectif, la vision du side faible et la surcharge d'une seule win condition.` : `Le signal le plus instable vient de l'exposition collective : ${deathsPerGame} morts/game, ${formatGoldDiff(lossModel.goldDiff)} or/game en défaite et ${lossModel.visionDiff >= 0 ? "+" : ""}${lossModel.visionDiff} vision en défaite.`,
      details: [`Morts équipe : ${deathsPerGame} / game`, `Défaites : ${lossModel.games} games, ${formatGoldDiff(lossModel.goldDiff)} or/game`, `Vision en défaite : ${lossModel.visionDiff >= 0 ? "+" : ""}${lossModel.visionDiff}`].filter(Boolean),
      sourceGames: fragilePattern?.sourceGames?.length ? fragilePattern.sourceGames : lossModel.sourceGames.length ? lossModel.sourceGames : sourceGames,
    },
  ];
  const primaryTeamModelCard = teamModelCards[0];
  const secondaryTeamModelCards = teamModelCards.slice(1);
  const teamModelIcon = (id) => id === "win-condition" ? Target : id === "resource-map" ? Users : id === "tempo-map" ? Gauge : AlertTriangle;
  const teamModelActionLabel = (id) => id === "win-condition" ? "Plan à assumer" : id === "resource-map" ? "Rôles à cadrer" : id === "tempo-map" ? "Timing à viser" : "Risque à review";
  const swingRows = [
    {
      id: "gold",
      label: "Or",
      win: formatGoldDiff(winModel.goldDiff),
      loss: formatGoldDiff(lossModel.goldDiff),
      read: `En victoire l'équipe tourne à ${formatGoldDiff(winModel.goldDiff)} or/game ; en défaite à ${formatGoldDiff(lossModel.goldDiff)}.`,
      toneName: winModel.goldDiff >= lossModel.goldDiff ? "green" : "red",
    },
    {
      id: "deaths",
      label: "Morts",
      win: `${winModel.deaths}/G`,
      loss: `${lossModel.deaths}/G`,
      read: `La discipline change fortement si les défaites montent au-dessus des victoires : ${lossModel.deaths}/G contre ${winModel.deaths}/G.`,
      toneName: lossModel.deaths > winModel.deaths ? "red" : "green",
    },
    {
      id: "tempo",
      label: "1er objectif",
      win: formatMinute(winModel.firstObjective),
      loss: formatMinute(lossModel.firstObjective),
      read: `Tempo moyen en victoire : ${formatMinute(winModel.firstObjective)}. Tempo moyen en défaite : ${formatMinute(lossModel.firstObjective)}.`,
      toneName: Number.isFinite(winModel.firstObjective) && Number.isFinite(lossModel.firstObjective) && winModel.firstObjective <= lossModel.firstObjective ? "green" : "orange",
    },
    {
      id: "identity",
      label: "Draft gagnante",
      win: winModel.tags[0] ? tagLabel(winModel.tags[0][0]) : "--",
      loss: lossModel.tags[0] ? tagLabel(lossModel.tags[0][0]) : "--",
      read: `Tag le plus présent en win : ${winModel.tags[0] ? tagLabel(winModel.tags[0][0]) : "n/a"}. Tag le plus présent en loss : ${lossModel.tags[0] ? tagLabel(lossModel.tags[0][0]) : "n/a"}.`,
      toneName: "purple",
    },
  ];
  const coachKpis = [
    { label: "Échantillon", value: `${matches.length}G`, detail: `${wins}W-${losses}L · ${winrate}% WR`, toneName: matches.length >= 5 ? "green" : "orange" },
    { label: "Diff. or", value: formatGoldDiff(avgInt(goldDiff)), detail: "moyenne/game", toneName: diffTone(goldDiff) },
    { label: "1er objectif", value: formatMinute(averageFirstObjective), detail: earlyObjectiveRate === null ? "Timing indisponible" : `${earlyObjectiveLabel} ≤ 9:30 · ${objectiveTimingValues.length} timings`, toneName: earlyObjectiveRate === null ? "slate" : earlyObjectiveRate >= 60 ? "green" : earlyObjectiveRate >= 35 ? "orange" : "red" },
    { label: "Morts", value: deathsPerGame.toFixed(Number.isInteger(deathsPerGame) ? 0 : 1), detail: "alliées/game", toneName: deathsPerGame <= 15 ? "green" : deathsPerGame >= 20 ? "red" : "orange" },
  ];
  const coachBriefs = [
    {
      toneName: winrate >= 55 ? "green" : winrate >= 45 ? "orange" : "red",
      label: "Bilan",
      title: `${winrate >= 55 ? "Bloc favorable" : winrate >= 45 ? "Bloc compétitif mais instable" : "Bloc défavorable"}`,
      text: `${matches.length} games, ${wins}W-${losses}L. Écarts moyens : ${formatGoldDiff(avgInt(goldDiff))} or, ${signedAvg(damageDiff)} dégâts, ${signedAvg(visionDiff)} vision.${matches.length < 5 ? " L’échantillon reste limité." : ""}`,
      evidence: [`WR ${winrate}%`, `morts ${objectiveRatio(sumRows(ally, "deaths"), matches.length)}/game`, `KP équipe ${teamKpAverage}%`],
      sourceGames,
    },
    strongestPattern && {
      toneName: strongestPattern.verdictTone,
      label: "Plan de jeu",
      title: `${strongestPattern.label} · ${strongestPattern.verdict}`,
      text: `${strongestPattern.games} occurrence${strongestPattern.games > 1 ? "s" : ""}, ${strongestPattern.wins}W-${strongestPattern.games - strongestPattern.wins}L, ${strongestPattern.wr}% WR. ${strongestPattern.bestRole ? `${roleLabel(strongestPattern.bestRole.role)} est le rôle le plus porteur dans ce pattern` : "Rôle porteur non isolé"}, avec ${formatGoldDiff(strongestPattern.avgGoldDiff)} or/game et ${strongestPattern.avgDamageDiff >= 0 ? "+" : ""}${formatPoints(strongestPattern.avgDamageDiff)} dégâts/game.`,
      evidence: [`Pattern ${strongestPattern.games} games`, `CS10 ${Number.isFinite(strongestPattern.cs10) ? `${strongestPattern.cs10 >= 0 ? "+" : ""}${strongestPattern.cs10.toFixed(1)}` : "n/a"}`, `1er obj ${formatMinute(strongestPattern.firstObjective)}`],
      sourceGames: strongestPattern.sourceGames,
    },
    {
      toneName: averageFirstObjective && averageFirstObjective <= 9.5 ? "green" : averageFirstObjective && averageFirstObjective <= 12 ? "orange" : "red",
      label: "Objectifs",
      title: `Tempo objectifs : ${formatMinute(averageFirstObjective)}`,
      text: `${objectiveRatio(objectiveTotals.dragons, matches.length)} drakes/game, ${objectiveRatio(objectiveTotals.grubs, matches.length)} grubs/game, ${objectiveRatio(objectiveTotals.towers, matches.length)} tours/game. ${earlyObjectiveRate === null ? "Timing du premier objectif indisponible" : `${earlyObjectiveLabel} avant 9:30 parmi les ${objectiveTimingValues.length} games avec timing connu`}${bestSide ? ` ; meilleur side actuel : ${bestSide.side} (${bestSide.wr}% WR sur ${bestSide.games}G)` : ""}.`,
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
      text: fragilePattern ? `${fragilePattern.label} descend à ${fragilePattern.wr}% WR sur ${fragilePattern.games} games. Croiser cette séquence avec les morts avant objectif, la vision du side faible et le plan de draft associé.` : `Le bloc reste à stabiliser collectivement : ${teamKpAverage}% KP équipe, ${objectiveRatio(sumRows(ally, "deaths"), matches.length)} morts/game et ${signedAvg(visionDiff)} vision moyenne. Objectif : conserver le plan fort sans surcharger une seule condition de victoire.`,
      evidence: [`KP équipe ${teamKpAverage}%`, `Morts équipe ${objectiveRatio(sumRows(ally, "deaths"), matches.length)}/G`, `Vision ${signedAvg(visionDiff)}`].filter(Boolean),
      sourceGames: fragilePattern?.sourceGames || sourceGames,
    },
  ].filter(Boolean).slice(0, 5);
  const coachPriorityCards = [
    {
      label: "Priorité 1",
      title: coachBriefs.at(-1)?.title || coachBriefs[0]?.title || "Priorité à définir",
      value: coachBriefs.at(-1)?.label || "Review",
      text: coachBriefs.at(-1)?.evidence?.slice(0, 2).join(" · ") || coachBriefs.at(-1)?.text || "Choisir un axe unique pour le prochain bloc.",
      toneName: coachBriefs.at(-1)?.toneName || "cyan",
      sourceGames: coachBriefs.at(-1)?.sourceGames || sourceGames,
    },
    coachBriefs.find((brief) => brief.label === "Laning") && {
      label: "Point review",
      title: coachBriefs.find((brief) => brief.label === "Laning").title,
      value: "Lane",
      text: coachBriefs.find((brief) => brief.label === "Laning").evidence?.slice(0, 2).join(" · ") || coachBriefs.find((brief) => brief.label === "Laning").text,
      toneName: coachBriefs.find((brief) => brief.label === "Laning").toneName,
      sourceGames: coachBriefs.find((brief) => brief.label === "Laning").sourceGames,
    },
    focusRoleModel && {
      label: "Rôle moteur",
      title: `${roleLabel(focusRoleModel.role)} structure le jeu`,
      value: `${Math.round(focusRoleModel.goldShare || 0)}% or`,
      text: `${Math.round(focusRoleModel.damageShare || 0)}% dégâts · KP ${Math.round(focusRoleModel.kp || 0)}%`,
      toneName: focusRoleModel.toneName || "cyan",
      sourceGames: focusRoleModel.sourceGames,
    },
  ].filter(Boolean);
  const coachDataPillars = [
    { label: "Plan", value: primaryTeamModelCard?.title || "À définir", hint: primaryTeamModelCard?.value || `${winrate}% WR`, toneName: primaryTeamModelCard?.toneName || "cyan", sourceGames: primaryTeamModelCard?.sourceGames || sourceGames },
    { label: "Tempo", value: formatMinute(averageFirstObjective), hint: earlyObjectiveRate === null ? "Timing indisponible" : `${earlyObjectiveLabel} avant 9:30 · ${objectiveTimingValues.length} timings`, toneName: earlyObjectiveRate === null ? "slate" : earlyObjectiveRate >= 60 ? "green" : earlyObjectiveRate >= 35 ? "orange" : "red", sourceGames: objectiveSourceGames },
    { label: "Risque", value: `${deathsPerGame.toFixed(Number.isInteger(deathsPerGame) ? 0 : 1)} morts/G`, hint: fragilePattern?.label || signedAvg(visionDiff), toneName: deathsPerGame >= 20 ? "red" : "orange", sourceGames: fragilePattern?.sourceGames || lossModel.sourceGames },
    { label: "Volume", value: `${matches.length} games`, hint: activeTrendCategory?.name || "Toutes les games", toneName: matches.length >= 12 ? "green" : matches.length >= 5 ? "orange" : "slate", sourceGames },
  ];
  const autoReads = coachBriefs.map((brief) => `${brief.label} — ${brief.title}. ${brief.text}`);
  const forceItems = [
    `${wins}W - ${losses}L sur ${matches.length} game${matches.length > 1 ? "s" : ""} (${winrate}% WR).`,
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
  const trendToneClass = {
    cyan: "from-cyan-400/14 via-white/[0.035] to-transparent text-cyan-100",
    green: "from-emerald-400/14 via-white/[0.035] to-transparent text-emerald-100",
    red: "from-rose-400/14 via-white/[0.035] to-transparent text-rose-100",
    purple: "from-fuchsia-400/14 via-white/[0.035] to-transparent text-fuchsia-100",
    orange: "from-amber-400/14 via-white/[0.035] to-transparent text-amber-100",
  };
  const TrendPanel = ({ title, icon: Icon, items, tone = "cyan" }) => <section className="nxt5-flat-block flex h-full min-h-[9.5rem] flex-col rounded-xl border p-3"><div className="flex items-center gap-2.5"><span className={cx("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-gradient-to-br", trendToneClass[tone] || trendToneClass.cyan)}><Icon className="h-4 w-4" /></span><h3 className="min-w-0 truncate text-sm font-black text-white">{title}</h3></div><div className="mt-2.5 flex-1 divide-y divide-white/8">{items.length ? items.slice(0, 3).map((item, index) => <div key={item} className="flex gap-2.5 py-2 first:pt-0 last:pb-0"><span className={cx("mt-2 h-1.5 w-1.5 shrink-0 rounded-full shadow-[0_0_10px_currentColor]", tone === "red" ? "bg-rose-300 text-rose-300" : tone === "green" ? "bg-emerald-300 text-emerald-300" : tone === "purple" ? "bg-fuchsia-300 text-fuchsia-300" : tone === "orange" ? "bg-amber-300 text-amber-300" : "bg-cyan-300 text-cyan-300")} /><p className="min-w-0 text-xs font-semibold leading-5 text-slate-200">{index === 0 ? <span className="font-black text-white">{item}</span> : item}</p></div>) : <p className="py-2 text-xs font-semibold text-slate-300">Pas assez de volume.</p>}</div></section>;
  const topMetrics = [
    { icon: Trophy, label: "Winrate", value: `${winrate}%`, hint: `${wins}W - ${losses}L`, tone: winrate >= 50 ? "green" : "red" },
    { icon: Flame, label: "Écart dégâts", value: signedAvg(damageDiff), hint: "Moyenne / game", tone: diffTone(damageDiff) },
    { icon: Eye, label: "Écart vision", value: signedAvg(visionDiff), hint: "Moyenne / game", tone: diffTone(visionDiff) },
    { icon: Shield, label: "Morts alliées", value: objectiveRatio(sumRows(ally, "deaths"), matches.length), hint: "Par game", tone: avg(sumRows(ally, "deaths")) <= 15 ? "green" : avg(sumRows(ally, "deaths")) >= 20 ? "red" : "orange" },
  ];
  const diffChartItems = [
    { label: "Or", value: avgInt(goldDiff), display: formatGoldDiff(avgInt(goldDiff)), tone: diffTone(goldDiff) },
    { label: "Dégâts", value: avgInt(damageDiff), display: signedAvg(damageDiff), tone: diffTone(damageDiff) },
    { label: "Vision", value: avgInt(visionDiff), display: signedAvg(visionDiff), tone: diffTone(visionDiff) },
    { label: "Morts", value: avgInt(deathsDiff), display: signedAvg(deathsDiff), tone: deathsDiff <= 0 ? "green" : "red" },
  ];
  const objectiveChartItems = [
    ["Drakes", objectiveTotals.dragons, "cyan"],
    ["Grubs", objectiveTotals.grubs, "purple"],
    ["Herald", objectiveTotals.heralds, "blue"],
    ["Nashor", objectiveTotals.barons, "orange"],
    ["Tours", objectiveTotals.towers, "green"],
  ].map(([label, value, toneName]) => ({ label, value: Number(value || 0) / Math.max(1, matches.length), display: objectiveRatio(value, matches.length), tone: toneName }));
  const roleResourceChartItems = roleFocus.slice(0, 5).map((stat) => ({
    label: roleLabel(stat.role),
    value: Math.round((stat.gold + stat.damage / 3) / Math.max(1, stat.games)),
    detail: `${formatPoints(Math.round(stat.gold / Math.max(1, stat.games)))} or · ${formatPoints(Math.round(stat.damage / Math.max(1, stat.games)))} dégâts`,
    role: stat.role,
  }));
  const maxDiffChart = Math.max(1, ...diffChartItems.map((item) => Math.abs(item.value)));
  const maxObjectiveChart = Math.max(1, ...objectiveChartItems.map((item) => item.value));
  const maxRoleResourceChart = Math.max(1, ...roleResourceChartItems.map((item) => item.value));
  const barToneClass = {
    cyan: "from-cyan-300 to-cyan-500",
    blue: "from-sky-300 to-blue-500",
    green: "from-emerald-300 to-emerald-500",
    red: "from-rose-300 to-rose-500",
    purple: "from-fuchsia-300 to-violet-500",
    orange: "from-amber-300 to-orange-500",
    slate: "from-slate-300 to-slate-500",
  };
  const SignedBar = ({ item }) => {
    const positive = item.value >= 0;
    const width = Math.max(6, Math.min(50, (Math.abs(item.value) / maxDiffChart) * 50));
  return <div className="rounded-xl border border-white/10 bg-black/20 p-2.5"><div className="flex items-center justify-between gap-3"><span className="text-[0.62rem] font-black uppercase tracking-[0.14em] text-slate-300">{item.label}</span><span className={cx("text-sm font-black", item.tone === "red" ? "text-rose-100" : item.tone === "green" ? "text-emerald-100" : "text-cyan-100")}>{item.display}</span></div><div className="relative mt-2.5 h-2.5 overflow-hidden rounded-full bg-white/[0.055]"><span className="absolute left-1/2 top-0 h-full w-px bg-white/24" /><span className={cx("absolute top-0 h-full rounded-full bg-gradient-to-r", barToneClass[item.tone] || barToneClass.cyan)} style={positive ? { left: "50%", width: `${width}%` } : { right: "50%", width: `${width}%` }} /></div></div>;
  };
  const VerticalBar = ({ item, max }) => {
    const height = Math.max(10, Math.min(100, (Number(item.value || 0) / max) * 100));
    return <div className="flex min-w-0 flex-col justify-end rounded-xl border border-white/10 bg-black/18 p-2 text-center"><div className="flex h-20 items-end justify-center"><span className={cx("w-full max-w-[2rem] rounded-t-xl bg-gradient-to-t shadow-[0_0_18px_rgba(34,211,238,.12)]", barToneClass[item.tone] || barToneClass.cyan)} style={{ height: `${height}%` }} /></div><p className="mt-2 text-base font-black text-white">{item.display}</p><p className="truncate text-[0.56rem] font-black uppercase tracking-[0.12em] text-slate-300">{item.label}</p></div>;
  };
  const RoleResourceBar = ({ item }) => {
    const width = Math.max(8, Math.min(100, (item.value / maxRoleResourceChart) * 100));
    return <div className="rounded-xl border border-white/10 bg-black/18 p-2.5"><div className="flex items-center justify-between gap-3"><span className="flex min-w-0 items-center gap-2"><RoleIcon role={item.role} className="h-4 w-4 shrink-0" /><span className="truncate text-sm font-black text-white">{item.label}</span></span><span className="shrink-0 text-xs font-semibold text-slate-300">{item.detail}</span></div><div className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-white/[0.055]"><span className="block h-full rounded-full bg-gradient-to-r from-cyan-300 via-blue-400 to-fuchsia-400" style={{ width: `${width}%` }} /></div></div>;
  };
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
    let current = `${row.wr}% WR`;
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
      current = `${earlyObjectiveRate}% early`;
      why = "Le tempo jungle doit transformer la priorité lane en drake, grubs ou herald plus tôt.";
      progress = earlyObjectiveRate;
    } else if ((role === "ADC" || role === "TOP" || role === "MID") && damageShare < 24) {
      title = "Augmenter l'impact fight";
      target = "Damage share >= 26%";
      current = `${Math.round(damageShare)}% dégâts`;
      why = "Le rôle a besoin d'un objectif mesurable en fights : positionnement, timing d'entrée et conversion DPS.";
      progress = (damageShare / 26) * 100;
    } else if (role === "SUP" && visionDiff < 0) {
      title = "Reprendre la vision objective";
      target = "Vision diff positive 60s avant objectif";
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
      stats: gamesCount ? [`${profileWins}W-${gamesCount - profileWins}L`, `KP ${Math.round(avgProfileKp)}%`, `${avgProfile("deaths").toFixed(1)} morts/G`, mainChampion ? championDisplayName(mainChampion.champion) : "Pool à lire"] : ["0 game", player.riot_id || "Riot ID manquant", roleLabel(role), "À lier"],
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
        current: `${fragilePattern.wr}% WR`,
        why: "Le pattern existe mais son rendement chute : il faut séparer problème de draft, exécution et timing.",
        progress,
        toneName: objectiveTone(progress),
        sourceGames: fragilePattern.sourceGames,
      };
    }
    return {
      title: "Conserver le plan fort",
      target: "Reproduire le plan sur 3 games consécutives",
      current: `${winrate}% WR`,
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
  const exportTrends = () => exportTrendsPng({
    title: "Cockpit stratégique",
    subtitle: `${activeTrendCategory?.name || "Toutes les games"} · ${trendPeriod === "all" ? "Historique complet" : `${trendPeriod} dernières`} · ${matches.length} game${matches.length > 1 ? "s" : ""} · ${wins}W - ${losses}L`,
    metrics: topMetrics,
    sections: exportTrendSections,
    champions: championCounts,
    filename: `nxt5-tendances-${String(activeTrendCategory?.name || "global").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`
  });
  const sourceScopeMetrics = [
    { label: "Contexte", value: activeTrendCategory?.name || "Toutes" },
    { label: "Games", value: String(matches.length) },
    { label: "Timelines", value: `${timelineGamesCount}/${matches.length}` },
    { label: "WR", value: `${winrate}%` },
  ];
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
  const sourceModalSummary = (games = []) => {
    const count = games.length;
    const winsCount = games.filter((game) => game.result === "Victoire").length;
    const avgSource = (field) => Math.round(games.reduce((sum, game) => sum + Number(game[field] || 0), 0) / Math.max(1, count));
    const roleCounts = games.reduce((map, game) => {
      if (game.topRole) map.set(game.topRole, (map.get(game.topRole) || 0) + 1);
      return map;
    }, new Map());
    const topRoleEntry = Array.from(roleCounts.entries()).sort((a, b) => b[1] - a[1])[0];
    return {
      count,
      wins: winsCount,
      winrate: Math.round((winsCount / Math.max(1, count)) * 100),
      gold: avgSource("goldDiff"),
      damage: avgSource("damageDiff"),
      vision: avgSource("visionDiff"),
      deaths: avgSource("deaths"),
      role: topRoleEntry ? `${roleLabel(topRoleEntry[0])} x${topRoleEntry[1]}` : "Non isolé",
    };
  };
  const sourceGameSignals = (game) => [
    { label: "Or", value: formatGoldDiff(game.goldDiff), toneName: game.goldDiff >= 0 ? "green" : "red" },
    { label: "Dégâts", value: `${game.damageDiff >= 0 ? "+" : ""}${formatPoints(game.damageDiff)}`, toneName: game.damageDiff >= 0 ? "green" : "red" },
    { label: "Vision", value: `${game.visionDiff >= 0 ? "+" : ""}${game.visionDiff}`, toneName: game.visionDiff >= 0 ? "cyan" : "red" },
    { label: "Morts", value: `${game.deaths}/${game.enemyDeaths}`, toneName: game.deaths <= game.enemyDeaths ? "green" : "orange" },
    { label: "1er obj", value: game.firstObjective || "--", toneName: game.firstObjective && game.firstObjective !== "--" ? "cyan" : "slate" },
  ];
  const sourceGameRead = (game) => {
    if (game.result === "Victoire" && game.goldDiff >= 0) return "Victoire avec ressources : plan de jeu bien converti.";
    if (game.result === "Victoire" && game.goldDiff < 0) return "Win malgré retard économique : à relire pour les fights ou le scaling.";
    if (game.result === "Défaite" && game.deaths > game.enemyDeaths) return "Plus de morts en défaite : vérifier leur contexte avant de conclure.";
    if (game.visionDiff < 0) return "Information défavorable : setup objectif ou facecheck à revoir.";
    return "Game utile pour comparer exécution, tempo objectif et rôle moteur.";
  };
  const draftTrendModel = buildDraftTrendModel(matches);
  const staffAlerts = buildStaffAlerts(matches, (data.players || []).filter((player) => player.team_id === selectedTeamId));
  const trendPanelOptions = [
    ["coach", "Vue coach", Gauge, "Synthèse, patterns et actions."],
    ["ai-objectives", "Objectifs", Sparkles, "Cibles mesurables et preuves."],
    ["comparison", "Comparer", Activity, "Avant, après et écarts par rôle."],
    ["draft", "Draft", Crown, "Picks, archétypes et plans."],
  ];
  const trendHero = coachPriorityCards[0] || {
    label: "Lecture",
    title: teamAiObjective.title,
    value: `${winrate}% WR`,
    text: teamAiObjective.why,
    toneName: teamAiObjective.toneName,
    sourceGames: teamAiObjective.sourceGames,
  };
  const heroToneText = trendHero.toneName === "red" ? "text-rose-100" : trendHero.toneName === "orange" ? "text-amber-100" : trendHero.toneName === "green" ? "text-emerald-100" : trendHero.toneName === "purple" ? "text-fuchsia-100" : "text-cyan-100";

  return <div className="nxt5-data-dense min-w-0 overflow-hidden">
    <div className="mb-4 flex flex-col gap-4">
      <PageHeader eyebrow="Comprendre l’équipe" title="Tendances d’équipe" subtitle="Les évolutions, les répétitions et le prochain axe de travail.">
        <TrendPeriodFilter value={trendPeriod} onChange={setTrendPeriod} />
      </PageHeader>
      <div className="flex flex-wrap items-center justify-between gap-3 border-y border-white/10 py-3">
        <CategoryFilter categories={matchCategories} selectedCategoryId={selectedCategoryId} onSelect={setSelectedCategoryId} label="Contexte" />
        <p className="text-xs font-semibold text-slate-400" aria-live="polite">{matches.length} sur {categoryMatches.length} games · {timelineGamesCount}/{matches.length} timelines</p>
      </div>
      {matches.length < 5 && <p className="flex items-start gap-2 text-xs leading-5 text-amber-100/80"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>Petit échantillon : les patterns restent à confirmer.</span></p>}
    </div>
    <Surface className="mb-4 overflow-hidden p-0">
      <div className="nxt5-keep-grid relative z-10 grid gap-0 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,.85fr)]">
        <div className="min-w-0 p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold text-cyan-100">{activeTrendCategory?.name || "Toutes les games"} · {matches.length} games</p>
          </div>
          <p className="mt-5 text-[0.68rem] font-black uppercase tracking-[0.28em] text-cyan-100/75">Bilan du bloc</p>
          <h3 className="mt-2 max-w-5xl break-words text-2xl font-black leading-tight tracking-tight text-white sm:text-3xl">{trendHero.title}</h3>
          <p className="mt-4 max-w-4xl text-base font-semibold leading-7 text-slate-200">{trendHero.text}</p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button type="button" icon={FileText} onClick={() => openTrendSources({ title: trendHero.label, subtitle: trendHero.title, games: trendHero.sourceGames })}>Voir les games sources</Button>
            <Button type="button" variant="ghost" icon={ImageIcon} onClick={exportTrends}>Exporter PNG</Button>
          </div>
        </div>
        <aside className="relative min-w-0 border-t border-white/10 bg-black/24 p-5 sm:p-6 lg:border-l lg:border-t-0">
          <div className="nxt5-keep-grid grid grid-cols-[auto_minmax(0,1fr)] gap-3 sm:gap-5">
            <div>
              <p className={cx("text-6xl font-black leading-none", heroToneText)}>{winrate}%</p>
              <p className="mt-2 text-sm font-black text-white">{wins}W - {losses}L</p>
              <p className="mt-1 text-xs font-semibold text-slate-400">{tagLabel(identity.primary)}</p>
            </div>
            <div className="grid min-w-0 gap-2">
              {topMetrics.slice(1).map(({ icon: Icon, label, value, hint, tone: metricTone }) => <div key={label} className="nxt5-keep-grid grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-white/10 py-2 last:border-b-0 sm:grid-cols-[2rem_minmax(0,1fr)_auto]">
                <span className={cx("hidden h-8 w-8 place-items-center rounded-lg sm:grid", tone(metricTone))}><Icon className="h-4 w-4" /></span>
                <span className="min-w-0"><span className="block truncate text-[0.58rem] font-black uppercase tracking-[0.12em] text-slate-400">{label}</span><span className="block truncate text-[0.65rem] font-semibold text-slate-300">{hint}</span></span>
                <span className="text-sm font-black text-white">{value}</span>
              </div>)}
            </div>
          </div>
          <div className="nxt5-keep-grid mt-5 grid grid-cols-2 gap-2">
            {sideStats.map((stat) => {
              const color = stat.side === "Blue" ? "bg-cyan-300" : "bg-rose-300";
              return <div key={stat.side} className="min-w-0 border-t border-white/10 pt-3">
                <div className="flex items-center justify-between gap-3"><span className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-white"><span className={cx("h-2.5 w-2.5 rounded-full", color)} />{stat.side} side</span><span className="text-lg font-black text-white">{stat.games ? `${stat.wr}%` : "-"}</span></div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.07]"><span className={cx("block h-full rounded-full", color)} style={{ width: `${stat.games ? stat.wr : 0}%` }} /></div>
                <p className="mt-1 text-xs font-semibold text-slate-400">{stat.games ? `${stat.wins}W - ${stat.games - stat.wins}L · ${stat.games} games` : "Aucune game"}</p>
              </div>;
            })}
          </div>
        </aside>
      </div>
    </Surface>
    <TabNav className="sticky top-[5.25rem] z-10 mb-4" label="Sections Tendances" items={trendPanelOptions.map(([id, label, icon, description]) => ({ id, label, icon, description }))} activeId={trendPanel} onChange={setTrendPanel} columns="md:grid-cols-4" />
    {trendPanel === "coach" && <TrendEvolution matches={matches} onOpenMatch={openSourceGame} onOpenSources={(games) => openTrendSources({ title: "Dynamique récente", subtitle: "Deux blocs consécutifs de même taille, dans la sélection active.", games: sourceGamesForMatches(games) })} />}
    {trendPanel === "coach" && staffAlerts.length > 0 && <div className="mb-4 grid gap-2 lg:grid-cols-3">
      {staffAlerts.slice(0, 3).map((alert) => {
        const Icon = alert.icon;
        return <button key={alert.title} type="button" onClick={() => openTrendSources({ title: alert.title, subtitle: alert.action, games: sourceGames })} className="group min-w-0 rounded-2xl border border-amber-200/16 bg-[linear-gradient(135deg,rgba(245,158,11,.10),rgba(255,255,255,.025))] p-4 text-left transition hover:border-amber-200/34 hover:bg-amber-300/[0.08]">
          <div className="flex items-start gap-3"><span className={cx("grid h-10 w-10 shrink-0 place-items-center rounded-xl", tone(alert.toneName))}><Icon className="h-4 w-4" /></span><span className="min-w-0"><span className="block text-sm font-black text-white">{alert.title}</span><span className="mt-1 block text-xs font-semibold leading-5 text-slate-300">{alert.text}</span><span className="mt-2 block text-xs font-black leading-5 text-cyan-100">{alert.action}</span></span></div>
        </button>;
      })}
    </div>}
    {trendPanel === "comparison" && <Suspense fallback={<Surface><p className="mb-3 text-sm font-semibold text-slate-300" role="status">Chargement de la comparaison…</p><SkeletonRows /></Surface>}><BlockComparisonPanel matches={matches} categories={matchCategories} /></Suspense>}
    {trendPanel === "draft" && <DraftTrendsModule model={draftTrendModel} onOpenSources={openTrendSources} sourceGamesForMatches={sourceGamesForMatches} />}
    {trendPanel === "ai-objectives" && <Surface className="p-3">
      <ProgressionObjectives
        teamObjective={teamAiObjective}
        roleObjectives={roleAiObjectives}
        gamesCount={matches.length}
        onOpenSources={openTrendSources}
        onOpenContracts={() => setProfileContractsOpen(true)}
      />
      {profileContractsOpen && <div className="nxt5-fade-in nxt5-sidebar-aware-overlay fixed inset-0 z-[220] flex items-end justify-center bg-[#020612]/95 p-3 backdrop-blur-xl sm:items-center">
        <button type="button" aria-label="Fermer les contrats" onClick={() => setProfileContractsOpen(false)} className="absolute inset-0 cursor-default" />
        <section className="nxt5-enter-fast relative z-10 flex max-h-[88vh] w-full max-w-6xl min-w-0 flex-col overflow-hidden rounded-[1.5rem] border border-cyan-200/22 bg-[#050814] shadow-[0_30px_120px_rgba(0,0,0,.78),0_0_48px_rgba(34,211,238,.14)]">
          <div className="border-b border-white/10 p-4 sm:p-5">
            <div className="flex min-w-0 items-start justify-between gap-4">
              <div className="min-w-0">
                <Badge tone="cyan">Contrats joueurs</Badge>
                <h4 className="mt-2 break-words text-2xl font-black leading-tight text-white">Objectifs du prochain bloc</h4>
                <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-slate-300">Une cible courte par profil. Le détail et les preuves restent accessibles via les sources.</p>
              </div>
              <button type="button" onClick={() => setProfileContractsOpen(false)} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.045] text-slate-200 transition hover:bg-white/[0.08]" title="Fermer"><X className="h-4 w-4" /></button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
            <div className="grid gap-3">
              {profileAiObjectives.map((item) => <article key={item.player.id} className={cx("grid min-w-0 gap-3 rounded-2xl border p-4 lg:grid-cols-[minmax(13rem,.7fr)_minmax(0,1.15fr)_minmax(14rem,.75fr)_auto] lg:items-center", item.toneName === "green" ? "border-emerald-200/16 bg-emerald-400/[0.035]" : item.toneName === "orange" ? "border-amber-200/16 bg-amber-400/[0.04]" : "border-rose-200/16 bg-rose-400/[0.035]")}>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={item.toneName}>{roleLabel(item.role)}</Badge>
                    <Badge tone={item.games ? "green" : "slate"}>{item.games} game{item.games > 1 ? "s" : ""}</Badge>
                  </div>
                  <h5 className="mt-2 truncate text-xl font-black text-white">{item.player.name}</h5>
                  <p className="mt-1 truncate text-xs font-semibold text-slate-400">{item.player.riot_id || "Riot ID non lié"}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-[0.6rem] font-black uppercase tracking-[0.16em] text-cyan-100">Objectif</p>
                  <p className="mt-1 break-words text-lg font-black leading-6 text-white">{item.title}</p>
                  <p className="mt-1 line-clamp-2 text-sm font-semibold leading-6 text-slate-300">{item.trigger}</p>
                </div>
                <div className="min-w-0 rounded-2xl bg-black/24 p-3">
                  <p className="text-[0.6rem] font-black uppercase tracking-[0.16em] text-fuchsia-100">Cible</p>
                  <p className="mt-1 break-words text-sm font-black leading-5 text-white">{item.target}</p>
                  <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-slate-400">{item.drill}</p>
                </div>
                <button type="button" onClick={() => openTrendSources({ title: `Sources ${item.player.name}`, subtitle: item.title, games: item.sourceGames })} className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-cyan-200/18 bg-cyan-300/[0.07] px-4 text-xs font-black uppercase tracking-[0.12em] text-cyan-50 transition hover:bg-cyan-300/14"><FileText className="h-4 w-4" /> Sources</button>
              </article>)}
            </div>
          </div>
        </section>
      </div>}
    </Surface>}
    {trendPanel === "coach" && <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(22rem,.85fr)]">
      <Surface glow className="relative min-w-0 overflow-hidden p-0">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(34,211,238,.16),transparent_34%),linear-gradient(145deg,rgba(8,17,34,.92),rgba(5,8,18,.94))]" />
        <div className="relative z-10 p-5">
          <div className="flex flex-wrap items-center gap-2"><Badge tone="cyan">Plan de jeu</Badge><Badge tone="slate">{matches.length} games analysées</Badge></div>
          <h3 className="mt-4 break-words text-3xl font-black leading-tight text-white xl:text-4xl">{primaryTeamModelCard?.title || trendHero.title}</h3>
          <p className="mt-3 max-w-4xl text-sm font-semibold leading-7 text-slate-200">{primaryTeamModelCard?.text || trendHero.text}</p>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {coachDataPillars.map((item) => <button key={item.label} type="button" onClick={() => openTrendSources({ title: item.label, subtitle: item.value, games: item.sourceGames })} className="group min-w-0 rounded-2xl bg-white/[0.04] p-3 text-left transition hover:bg-white/[0.07]">
              <p className="text-[0.6rem] font-black uppercase tracking-[0.16em] text-slate-400">{item.label}</p>
              <p className="mt-2 truncate text-base font-black text-white">{item.value}</p>
              <p className={cx("mt-1 truncate text-xs font-semibold", item.toneName === "red" ? "text-rose-100" : item.toneName === "orange" ? "text-amber-100" : item.toneName === "green" ? "text-emerald-100" : "text-cyan-100")}>{item.hint}</p>
            </button>)}
          </div>
          <div className="mt-5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-100">Rôles dans le système</p>
            <div className="mt-3 grid gap-2 lg:grid-cols-5">
              {roleSystemRows.map((row) => <button key={row.role} type="button" onClick={() => openTrendSources({ title: roleLabel(row.role), subtitle: row.functionLabel, games: row.sourceGames })} className={cx("min-w-0 rounded-2xl p-3 text-left transition hover:bg-white/[0.06]", row.toneName === "red" ? "bg-rose-400/[0.055]" : row.toneName === "green" ? "bg-emerald-400/[0.055]" : "bg-white/[0.035]")}>
                <div className="flex items-center justify-between gap-2"><span className="flex min-w-0 items-center gap-2"><RoleIcon role={row.role} className="h-4 w-4 shrink-0 text-cyan-100" /><span className="truncate text-xs font-black uppercase tracking-[0.12em] text-white">{roleLabel(row.role)}</span></span><span className="text-xs font-black text-cyan-100">{row.wr}%</span></div>
                <p className="mt-2 truncate text-sm font-black text-white">{row.functionLabel}</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-slate-300">{Math.round(row.goldShare || 0)}% or · {Math.round(row.damageShare || 0)}% dégâts</p>
                <p className="mt-1 truncate text-[0.62rem] font-semibold text-slate-400">{row.championText || "Pool non isolé"}</p>
              </button>)}
            </div>
          </div>
        </div>
      </Surface>
      <div className="grid min-w-0 content-start gap-4">
        <Surface className="p-4">
          <div className="flex items-center justify-between gap-3"><div><Badge tone="purple">Décisions</Badge><h3 className="mt-2 text-xl font-black text-white">À faire maintenant</h3></div><Button type="button" variant="ghost" icon={FileText} onClick={() => openTrendSources({ title: trendHero.label, subtitle: trendHero.title, games: trendHero.sourceGames })}>Sources</Button></div>
          <div className="mt-4 grid gap-3">
            {coachPriorityCards.map((card, index) => <button key={`${card.label}-${card.title}`} type="button" onClick={() => openTrendSources({ title: card.label, subtitle: card.title, games: card.sourceGames })} className={cx("min-w-0 rounded-2xl p-4 text-left transition hover:bg-white/[0.065]", index === 0 ? "bg-cyan-300/[0.09] ring-1 ring-cyan-200/20" : "bg-white/[0.035]")}>
              <div className="flex items-start justify-between gap-3"><Badge tone={card.toneName}>{card.label}</Badge><span className="text-sm font-black text-white">{card.value}</span></div>
              <p className="mt-3 break-words text-lg font-black leading-6 text-white">{card.title}</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-300">{card.text}</p>
            </button>)}
          </div>
        </Surface>
        <Surface className="p-4">
          <div className="flex items-center justify-between gap-3"><div><Badge tone="cyan">Notes du coach</Badge><h3 className="mt-2 text-xl font-black text-white">À revoir</h3></div><Badge tone={winrate >= 50 ? "green" : "red"}>{coachBriefs.length} axes</Badge></div>
          <div className="mt-4 grid gap-2">
            {coachBriefs.slice(0, 4).map((brief) => <button type="button" onClick={() => openTrendSources({ title: brief.label, subtitle: brief.title, games: brief.sourceGames })} key={brief.label} className="min-w-0 border-t border-white/10 pt-3 text-left transition hover:bg-white/[0.06]">
              <div className="flex flex-wrap items-center justify-between gap-2"><Badge tone={brief.toneName}>{brief.label}</Badge><span className="text-[0.62rem] font-black uppercase tracking-[0.12em] text-slate-400">{brief.sourceGames?.length || matches.length} games</span></div>
              <p className="mt-2 text-sm font-black leading-5 text-white">{brief.title}</p>
              <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-slate-300">{brief.text}</p>
            </button>)}
          </div>
        </Surface>
      </div>
    </div>}
    <React.Fragment>
      {trendSourceModal && <div className="nxt5-fade-in nxt5-sidebar-aware-overlay fixed inset-0 z-[140] flex items-end justify-center bg-slate-950/90 p-3 backdrop-blur-xl sm:items-center">
        <button type="button" aria-label="Fermer les sources" onClick={() => setTrendSourceModal(null)} className="absolute inset-0 cursor-default" />
        <section ref={sourceDialogRef} role="dialog" aria-modal="true" aria-labelledby="trend-sources-title" tabIndex={-1} className="nxt5-enter-fast relative z-10 flex max-h-[88vh] w-full max-w-6xl min-w-0 flex-col overflow-hidden rounded-2xl border border-cyan-100/18 bg-[#050913] shadow-[0_24px_80px_rgba(0,0,0,.5)]">
          <div className="border-b border-white/10 p-4">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <Badge tone="cyan">Sources de calcul</Badge>
                <h3 id="trend-sources-title" className="mt-2 break-words text-xl font-black leading-tight text-white">{trendSourceModal.title}</h3>
                {trendSourceModal.subtitle && <p className="mt-1 max-w-3xl text-xs font-semibold leading-5 text-slate-300">{trendSourceModal.subtitle}</p>}
              </div>
              <button type="button" aria-label="Fermer les sources" onClick={() => setTrendSourceModal(null)} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-200 transition hover:border-rose-200/30 hover:bg-rose-300/10 hover:text-rose-50"><X className="h-4 w-4" /></button>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {(trendSourceModal.metrics || sourceScopeMetrics).slice(0, 4).map((metric, index) => <div key={`${metric.label}-${index}`} className="min-w-0 rounded-xl border border-white/10 bg-white/[0.035] p-2.5">
                <p className="truncate text-[0.56rem] font-black uppercase tracking-[0.14em] text-slate-400">{metric.label}</p>
                <p className="mt-1 break-words text-sm font-black leading-5 text-white">{metric.value}</p>
              </div>)}
            </div>
            {(() => {
              if (!trendSourceModal.games?.length) return null;
              const summary = sourceModalSummary(trendSourceModal.games || []);
              return <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                {[
                  ["WR sources", `${summary.winrate}%`, `${summary.wins}W-${Math.max(0, summary.count - summary.wins)}L`, summary.winrate >= 50 ? "green" : "red"],
                  ["Diff. or", formatGoldDiff(summary.gold), "moyenne/game", summary.gold >= 0 ? "green" : "red"],
                  ["Diff. dégâts", `${summary.damage >= 0 ? "+" : ""}${formatPoints(summary.damage)}`, "moyenne/game", summary.damage >= 0 ? "green" : "red"],
                  ["Vision", `${summary.vision >= 0 ? "+" : ""}${summary.vision}`, "moyenne/game", summary.vision >= 0 ? "cyan" : "red"],
                  ["Rôle répété", summary.role, `${summary.count} source${summary.count > 1 ? "s" : ""}`, "purple"],
                ].map(([label, value, hint, toneName]) => <div key={label} className={cx("min-w-0 rounded-xl border p-2.5", tone(toneName))}>
                  <p className="truncate text-[0.54rem] font-black uppercase tracking-[0.14em] opacity-75">{label}</p>
                  <p className="mt-1 truncate text-sm font-black text-white">{value}</p>
                  <p className="mt-0.5 truncate text-[0.62rem] font-semibold opacity-75">{hint}</p>
                </div>)}
              </div>;
            })()}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <div className="grid gap-3">
              {(trendSourceModal.games || []).map((game, index) => <button key={`${game.id || game.title}-${index}`} type="button" onClick={() => openSourceGame(game)} className="group min-w-0 rounded-2xl border border-white/10 bg-white/[0.028] p-3 text-left transition hover:border-cyan-200/28 hover:bg-cyan-300/[0.06]">
                <span className="grid min-w-0 gap-3 xl:grid-cols-[minmax(14rem,.9fr)_minmax(0,1.4fr)_minmax(14rem,.8fr)_auto] xl:items-center">
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <Badge tone={game.result === "Victoire" ? "green" : game.result === "Défaite" ? "red" : "slate"}>{game.result}</Badge>
                      <Badge tone={String(game.side).toLowerCase().includes("red") ? "red" : "cyan"}>{game.side}</Badge>
                      <Badge tone="slate">{game.patch}</Badge>
                    </span>
                    <span className="mt-2 block truncate text-base font-black text-white">{game.title}</span>
                    <span className="mt-0.5 block text-[0.68rem] font-semibold text-slate-400">{game.duration} · {game.objectiveCount} objectifs alliés · 1er obj {game.firstObjective}</span>
                  </span>
                  <span className="grid min-w-0 grid-cols-2 gap-1.5 md:grid-cols-5">
                    {sourceGameSignals(game).map((signal) => <span key={signal.label} className={cx("min-w-0 rounded-xl border px-2 py-1.5", tone(signal.toneName))}>
                      <span className="block truncate text-[0.52rem] font-black uppercase tracking-[0.12em] opacity-75">{signal.label}</span>
                      <span className="mt-0.5 block truncate text-xs font-black text-white">{signal.value}</span>
                    </span>)}
                  </span>
                  <span className="grid min-w-0 gap-1.5">
                    <span className="rounded-xl border border-white/10 bg-black/18 px-2.5 py-2"><span className="block text-[0.52rem] font-black uppercase tracking-[0.12em] text-slate-400">Résumé</span><span className="mt-1 block text-xs font-semibold leading-5 text-slate-200">{sourceGameRead(game)}</span></span>
                    <span className="rounded-xl border border-white/10 bg-black/18 px-2.5 py-2"><span className="block text-[0.52rem] font-black uppercase tracking-[0.12em] text-slate-400">Rôle moteur</span><span className="mt-1 block truncate text-xs font-black text-cyan-50">{game.topRoleLabel}</span><span className="mt-0.5 block truncate text-[0.58rem] font-semibold text-slate-400">{game.topRoleDetail}</span></span>
                  </span>
                  <span className="inline-flex items-center justify-end gap-2 text-[0.62rem] font-black uppercase tracking-[0.12em] text-cyan-100">Ouvrir<ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" /></span>
                </span>
              </button>)}
              {!trendSourceModal.games?.length && <p className="rounded-xl border border-dashed border-white/10 bg-black/20 p-4 text-sm font-semibold text-slate-300">Aucune game source isolée pour ce signal.</p>}
            </div>
          </div>
        </section>
      </div>}
    </React.Fragment>
  </div>;
}

const DRAFT_SCORE_TAGS = [
  ["engage", ["engage", "dive", "lockdown", "pick"]],
  ["scaling", ["scaling", "front-to-back", "farm", "dps"]],
  ["frontline", ["frontline", "bruiser", "sustain"]],
  ["controle", ["control", "waveclear", "disengage", "peel", "vision"]],
  ["pression", ["early", "lane", "tempo", "snowball", "roam"]],
  ["side", ["side", "duel", "split", "siege"]],
];

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
    const duos = Array.from(pairRows.reduce((map, row) => {
      const key = `${row.pair}|${row.champions}`;
      const current = map.get(key) || { pair: row.pair, champions: row.champions, games: 0, wins: 0, matches: [] };
      current.games += 1;
      current.wins += row.win ? 1 : 0;
      current.matches.push(row.match);
      map.set(key, current);
      return map;
    }, new Map()).values()).map((entry) => ({ ...entry, wr: Math.round((entry.wins / Math.max(1, entry.games)) * 100) })).sort((a, b) => b.games - a.games || b.wr - a.wr).slice(0, 6);
    const latestIdentity = draftIdentityForRows(rows);
    const comfort = picks.filter((pick) => pick.games >= 2 && pick.wr >= 50).slice(0, 5);
    const traps = picks.filter((pick) => pick.games >= 2 && pick.wr < 50).slice().sort((a, b) => a.wr - b.wr || b.games - a.games).slice(0, 5);
    const wins = matchDrafts.filter((entry) => entry.win).length;
    return { rows, matchDrafts, picks, rolePicks, archetypes, duos, identity: latestIdentity, comfort, traps, games: matchDrafts.length, wins, wr: Math.round((wins / Math.max(1, matchDrafts.length)) * 100) };
  };
  const ally = buildSide("ALLY");
  const warnings = [
    ally.identity.gaps[0] && `Nos drafts : ${ally.identity.gaps[0].toLowerCase()}.`,
    ally.traps[0] && `${championDisplayName(ally.traps[0].champion)} revient souvent avec ${ally.traps[0].wr}% WR.`,
  ].filter(Boolean).slice(0, 4);
  return { ally, warnings };
}

function DraftMiniChampion({ item, onSources }) {
  const toneName = item.wr >= 55 ? "green" : item.wr < 45 ? "red" : "orange";
  const className = cx("grid min-w-0 grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] p-2 text-left", onSources && "transition hover:border-cyan-200/26 hover:bg-cyan-300/[0.06]");
  const content = <>
    <span className="h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-black/35"><ChampionPortrait champion={item.champion} alt={item.champion} /></span>
    <span className="min-w-0">
      <span className="block truncate text-sm font-black text-white">{championDisplayName(item.champion)}</span>
      <span className="mt-0.5 block truncate text-[0.66rem] font-semibold text-slate-300">{roleLabel(item.role)} · {item.games}G · KDA {item.kda}</span>
    </span>
    <span className={cx("rounded-lg border px-2 py-1 text-xs font-black", tone(toneName))}>{item.wr}%</span>
  </>;
  return onSources ? <button type="button" onClick={onSources} className={className}>{content}</button> : <div className={className}>{content}</div>;
}

function draftScoreTone(scoreId) {
  if (scoreId === "engage") return "from-rose-300 via-orange-300 to-amber-400 text-rose-100 border-rose-200/20 bg-rose-400/[0.055]";
  if (scoreId === "scaling") return "from-cyan-300 via-blue-400 to-indigo-500 text-cyan-100 border-cyan-200/20 bg-cyan-400/[0.055]";
  if (scoreId === "frontline") return "from-emerald-300 via-teal-400 to-cyan-500 text-emerald-100 border-emerald-200/20 bg-emerald-400/[0.055]";
  if (scoreId === "side") return "from-yellow-300 via-amber-400 to-orange-500 text-yellow-100 border-yellow-200/20 bg-yellow-400/[0.055]";
  if (scoreId === "pression") return "from-fuchsia-300 via-sky-300 to-cyan-300 text-fuchsia-100 border-fuchsia-200/20 bg-fuchsia-400/[0.05]";
  return "from-violet-300 via-sky-300 to-cyan-300 text-violet-100 border-violet-200/20 bg-violet-400/[0.05]";
}

function DraftScoreBoard({ identity, games = 0 }) {
  const scores = [...(identity?.scores || [])].sort((a, b) => b.count - a.count);
  const maxCount = Math.max(1, ...scores.map((score) => score.count));
  const primary = scores[0] || null;
  const secondary = scores[1] || null;
  const weak = scores.filter((score) => score.count <= Math.max(1, Math.round(maxCount * 0.28))).slice(0, 2);
  const avgPerDraft = (score) => (Number(score?.count || 0) / Math.max(1, games)).toFixed(1);
  const read = primary
    ? `Notre draft penche vers ${primary.label.toLowerCase()}. Le plan doit assumer cette identité dès les deux premiers picks.`
    : "Pas assez de volume pour isoler une identité de draft.";
  const next = secondary
    ? `Second signal : ${secondary.label.toLowerCase()} (${avgPerDraft(secondary)} marqueur/draft).`
    : "Second signal encore trop faible.";
  return <div className="relative min-w-0 overflow-hidden rounded-2xl border border-cyan-200/18 bg-[linear-gradient(135deg,rgba(10,20,35,.86),rgba(4,8,18,.76)_58%,rgba(22,13,37,.72))] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,.05),0_18px_45px_rgba(0,0,0,.22)]">
    <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-cyan-100/70 to-fuchsia-100/45" />
    <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2"><Badge tone="cyan">Profil draft</Badge>{primary && <Badge tone={championStyleTone(identity.primary)}>{primary.label}</Badge>}</div>
        <h4 className="mt-2 text-lg font-black uppercase tracking-[0.12em] text-white">Score de draft</h4>
        <p className="mt-1 max-w-2xl text-sm font-semibold leading-6 text-slate-200">{identity.text}</p>
      </div>
      <div className="grid shrink-0 grid-cols-2 gap-2">
        <div className="rounded-xl border border-white/10 bg-black/24 px-3 py-2"><p className="text-[0.54rem] font-black uppercase tracking-[0.14em] text-slate-400">Signal #1</p><p className="mt-1 truncate text-sm font-black text-cyan-50">{primary?.label || "-"}</p></div>
        <div className="rounded-xl border border-white/10 bg-black/24 px-3 py-2"><p className="text-[0.54rem] font-black uppercase tracking-[0.14em] text-slate-400">Volume</p><p className="mt-1 text-sm font-black text-white">{games} drafts</p></div>
      </div>
    </div>
    <div className="mt-3 grid gap-2">
      {scores.map((score) => {
        const width = Math.max(6, Math.min(100, (score.count / maxCount) * 100));
        return <div key={score.id} className={cx("min-w-0 rounded-xl border p-2.5", draftScoreTone(score.id))}>
          <div className="flex items-center justify-between gap-3">
            <p className="truncate text-[0.66rem] font-black uppercase tracking-[0.14em] text-white">{score.label}</p>
            <p className="shrink-0 text-sm font-black text-white">{score.count}x <span className="text-[0.62rem] text-slate-300">· {avgPerDraft(score)}/draft</span></p>
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-black/25">
            <span className={cx("block h-full rounded-full bg-gradient-to-r shadow-[0_0_18px_rgba(34,211,238,.18)]", draftScoreTone(score.id).split(" ").slice(0, 3).join(" "))} style={{ width: `${width}%` }} />
          </div>
        </div>;
      })}
    </div>
    <div className="mt-3 grid gap-2 md:grid-cols-3">
      <div className="rounded-xl border border-cyan-200/14 bg-cyan-300/[0.055] p-2.5"><p className="text-[0.58rem] font-black uppercase tracking-[0.14em] text-cyan-100">Lecture</p><p className="mt-1 text-xs font-semibold leading-5 text-slate-100">{read}</p></div>
      <div className="rounded-xl border border-white/10 bg-white/[0.035] p-2.5"><p className="text-[0.58rem] font-black uppercase tracking-[0.14em] text-slate-300">Complément</p><p className="mt-1 text-xs font-semibold leading-5 text-slate-200">{next}</p></div>
      <div className="rounded-xl border border-amber-200/16 bg-amber-300/[0.055] p-2.5"><p className="text-[0.58rem] font-black uppercase tracking-[0.14em] text-amber-100">À surveiller</p><p className="mt-1 text-xs font-semibold leading-5 text-slate-200">{identity.gaps?.[0] || (weak.length ? `Faible signal ${weak.map((score) => score.label.toLowerCase()).join(" / ")}.` : "Profil plutôt équilibré sur ce bloc.")}</p></div>
    </div>
  </div>;
}

function DraftTrendTable({ title, rows, empty, onSources, variant = "archetypes" }) {
  const isDuos = variant === "duos";
  const shell = isDuos
    ? "border-fuchsia-200/16 bg-[linear-gradient(135deg,rgba(30,14,42,.42),rgba(4,8,18,.54))]"
    : "border-cyan-200/16 bg-[linear-gradient(135deg,rgba(8,32,42,.40),rgba(4,8,18,.55))]";
  const rail = isDuos ? "via-fuchsia-100/70" : "via-cyan-100/70";
  const label = isDuos ? "Combinaisons" : "Structures";
  const description = isDuos ? "Les paires qui reviennent le plus souvent dans les drafts du bloc." : "Les formes de compo qui convertissent le mieux.";
  return <section className={cx("relative min-w-0 overflow-hidden rounded-2xl border p-3 shadow-[inset_0_1px_0_rgba(255,255,255,.045)]", shell)}>
    <div className={cx("pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent to-transparent", rail)} />
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <Badge tone={isDuos ? "purple" : "cyan"}>{label}</Badge>
        <h4 className="mt-2 truncate text-sm font-black uppercase tracking-[0.14em] text-white">{title}</h4>
        <p className="mt-1 text-[0.68rem] font-semibold leading-4 text-slate-400">{description}</p>
      </div>
      <Badge tone={isDuos ? "purple" : "cyan"}>{rows.length}</Badge>
    </div>
    <div className="mt-2 grid gap-2">{rows.length ? rows.slice(0, 5).map((row, index) => {
      const className = cx("grid min-w-0 gap-2 rounded-xl border bg-black/18 p-2 text-left sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center", isDuos ? "border-fuchsia-100/12" : "border-cyan-100/12", onSources && "transition hover:border-cyan-200/24 hover:bg-cyan-300/[0.055]");
      const content = <>
        <span className="min-w-0">
          <span className="block truncate text-sm font-black text-white">{row.tag ? tagLabel(row.tag) : row.champions}</span>
          <span className="mt-0.5 block truncate text-[0.66rem] font-semibold text-slate-300">{row.pair || `${row.games} game${row.games > 1 ? "s" : ""}`} · {row.wins}W - {row.games - row.wins}L</span>
        </span>
        <span className={cx("w-fit rounded-lg border px-2 py-1 text-xs font-black sm:justify-self-end", tone(row.wr >= 55 ? "green" : row.wr < 45 ? "red" : "orange"))}>{row.wr}%</span>
      </>;
      return onSources ? <button key={`${title}-${row.tag || row.champions || row.champion}-${index}`} type="button" onClick={() => onSources(row)} className={className}>{content}</button> : <div key={`${title}-${row.tag || row.champions || row.champion}-${index}`} className={className}>{content}</div>;
    }) : <p className="rounded-xl border border-dashed border-white/10 bg-black/20 p-3 text-sm font-semibold text-slate-300">{empty}</p>}</div>
  </section>;
}

function DraftTrendsModule({ model, onOpenSources, sourceGamesForMatches }) {
  const active = model.ally;
  const sourceFor = (entry) => sourceGamesForMatches?.(entry.matches || []) || [];
  const openSources = (entry, title, subtitle) => onOpenSources?.({ title, subtitle, metrics: [{ label: "Games", value: String(entry.games || entry.matches?.length || active.games) }, { label: "WR", value: `${entry.wr ?? active.wr}%` }], games: sourceFor(entry) });
  const mainPick = active.comfort[0] || active.picks[0];
  return <Surface glow className="mt-3 overflow-hidden p-0">
    <div className="border-b border-white/10 p-3">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><Badge tone="purple">Tendances draft</Badge><Badge tone="cyan">Nos drafts</Badge><Badge tone="slate">{active.games} games</Badge></div>
          <h3 className="mt-2 break-words text-xl font-black text-white">Drafts du bloc</h3>
          <p className="mt-1 max-w-4xl text-sm font-semibold leading-6 text-slate-300">Picks joués, résultats et compositions utilisées.</p>
        </div>
      </div>
    </div>
    <div className="grid gap-3 p-3 2xl:grid-cols-[minmax(0,1.15fr)_minmax(22rem,.85fr)]">
      <div className="min-w-0">
        <div className="grid gap-3 xl:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)]">
          <div className="relative min-h-[17rem] overflow-hidden rounded-2xl border border-cyan-200/16 bg-black/24 p-4">
            <ChampionBackdrop champion={mainPick?.champion} />
            <div className="absolute inset-0 bg-gradient-to-t from-[#050711] via-[#050711]/78 to-[#050711]/22" />
            <div className="relative z-10 flex h-full min-h-[14rem] flex-col justify-between">
              <div>
                <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-cyan-100/75">Pick équipe à sécuriser</p>
                <h4 className="mt-3 break-words text-3xl font-black leading-none text-white">{mainPick ? championDisplayName(mainPick.champion) : "À confirmer"}</h4>
                <p className="mt-2 text-sm font-bold text-slate-300">{mainPick ? `${roleLabel(mainPick.role)} · ${mainPick.games} games · ${mainPick.wr}% WR` : "Importe plus de games pour stabiliser la lecture."}</p>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-white/10 bg-black/34 p-2"><p className="text-[0.56rem] font-black uppercase tracking-[0.1em] text-slate-400">WR</p><p className="mt-1 text-lg font-black text-white">{active.wr}%</p></div>
                <div className="rounded-xl border border-white/10 bg-black/34 p-2"><p className="text-[0.56rem] font-black uppercase tracking-[0.1em] text-slate-400">Identité</p><p className="mt-1 truncate text-lg font-black text-white">{tagLabel(active.identity.primary)}</p></div>
                <div className="rounded-xl border border-white/10 bg-black/34 p-2"><p className="text-[0.56rem] font-black uppercase tracking-[0.1em] text-slate-400">Pool</p><p className="mt-1 text-lg font-black text-white">{active.picks.length}</p></div>
              </div>
            </div>
          </div>
          <DraftScoreBoard identity={active.identity} games={active.games} />
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {active.comfort.slice(0, 6).map((item) => <DraftMiniChampion key={`${item.role}-${item.champion}`} item={item} onSources={() => openSources(item, `Pick NXT5 : ${championDisplayName(item.champion)}`, `${item.games} games · ${item.wr}% WR · ${roleLabel(item.role)}`)} />)}
        </div>
      </div>
      <div className="grid min-w-0 items-start gap-3">
        <DraftTrendTable title="Archétypes rentables" rows={active.archetypes} empty="Pas encore assez de drafts complètes." variant="archetypes" onSources={(row) => openSources(row, `Archétype NXT5 : ${tagLabel(row.tag)}`, `${row.games} games · ${row.wr}%`)} />
        <DraftTrendTable title="Duos NXT5 fréquents" rows={active.duos} empty="Les duos apparaîtront avec plus de games." variant="duos" onSources={(row) => openSources(row, row.champions, `${row.pair} · ${row.games} games · ${row.wr}%`)} />
      </div>
    </div>
    <div className="grid gap-3 border-t border-white/10 p-3 xl:grid-cols-2">
      <div className="min-w-0">
        <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-slate-300">Alertes draft</p>
        <div className="mt-2 grid gap-2">{model.warnings.slice(0, 4).map((item) => <p key={item} className="rounded-xl border border-white/10 bg-black/20 p-2.5 text-sm font-semibold leading-6 text-slate-200">{item}</p>)}</div>
      </div>
      <div className="min-w-0">
        <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-slate-300">Picks équipe par rôle</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {active.rolePicks.slice(0, 5).map((entry) => <div key={entry.role} className="min-w-0 rounded-xl border border-white/10 bg-white/[0.025] p-2.5">
            <div className="flex items-center gap-2"><RoleIcon role={entry.role} className="h-4 w-4 shrink-0" /><p className="text-xs font-black uppercase tracking-[0.12em] text-white">{roleLabel(entry.role)}</p></div>
            <p className="mt-1 truncate text-xs font-semibold text-slate-300">{entry.picks.map((pick) => championDisplayName(pick.champion)).join(" · ")}</p>
          </div>)}
        </div>
      </div>
    </div>
  </Surface>;
}

export { TrendsPage, BlockComparisonPanel, buildDraftTrendModel, draftRows, draftIdentityForRows, draftTagScores, DRAFT_SCORE_TAGS, DraftTrendsModule, DraftMiniChampion, DraftScoreBoard, draftScoreTone, DraftTrendTable };
