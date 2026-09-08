import { PNG_THEME, pngAccent, pngTint, pngFitText, pngLine, pngPanel, pngBackground, pngHeader, pngFooter, pngLoadImage, pngImageCover, pngMetricStrip, pngDownload } from "../../utils/png-report.js";
import React, { useEffect, useState, useDeferredValue, useMemo, useRef } from "react";
import { gameWorkspaceSectionFromPath, openAppPath } from "../../app/routing.js";
import { PageHeader, Surface, TabNav, Badge, Button, EmptyState, TextInput } from "../../components/ui/Core.jsx";
import { Check, Download, FileText, Loader2, Plus, Shield, Swords, Upload, X, ArrowRight, Pencil, Trash2, BarChart3, ChevronDown, Clipboard, RefreshCw, Search, Eye, Flame, Gauge, Target, AlertTriangle, Crown, Trophy, ChevronRight, ArrowLeft } from "lucide-react";
import { apiFetch } from "../../api/client.js";
import { ImportGameFlow, GameActions, GameCategoryManager, GameOperationDialog, matchImportTitle, matchCategoriesForMatch, CategoryMultiSelect, JsonUploadProgress, ImportRoleHeader, ImportHistoryEditor } from "./GameOperations.jsx";
import "./games-workspace.css";
import { ImportedGames } from "../../components/games/ImportedGames.jsx";

import { cx, tone } from "../../app/helpers.js";
import { matchDisplayName } from "../../utils/matches.js";
import { RoleIcon } from "../../components/brand/BrandAssets.jsx";
import { useMatchDetails } from "../../hooks/useMatchDetails.js";
import { useReviewMatchDetails } from "../../hooks/useReviewMatchDetails.js";
import { csAtMinute } from "../../utils/match-timeline.js";
import { createPortal } from "react-dom";
import { championPortraitSources, championDisplayName, ChampionPortrait, COMP_ROLES, canStaffManage, normalizeProfileRole, parsePercent, formatPoints, formatGoldDiff, teamRows, sumRows, objectiveTeamId, storedTimelineFrames, compactTimelineEvents, diffTone, formatCountdown, participantTeamMap, matchTimelineFrames, rowParticipantId, objectiveEvents, objectiveEventLabel, objectiveEventType, statValue, compositionIdentity, championStyleTone, tagLabel, objectiveTeamSummary, ChampionBackdrop, itemIconSources, summonerSpellIconSources, itemSlots, trinketItemId, summonerSpellIds, creepScore, HudIcon, shareOfTeam, lazyNamed, loadNextPhase } from "./workspace-shared.jsx";
import { roleLabel } from "./shell-shared.jsx";

const ReviewQueuePanel = lazyNamed(loadNextPhase, "ReviewQueuePanel");

async function exportStatsPng({ title, subtitle, matches, filename }) {
  const finalBuildItems = (row) => [...itemSlots(row).filter(Boolean).map((id) => ({ id })), ...(trinketItemId(row) ? [{ id: trinketItemId(row) }] : [])];
  const scoped = Array.isArray(matches) ? matches.filter(Boolean) : [];
  const rows = scoped.flatMap((match) => (match.participants || []).filter((row) => row.team_key === "ALLY").map((row) => ({ ...row, match })));
  const enemyRows = scoped.flatMap((match) => (match.participants || []).filter((row) => row.team_key === "ENEMY"));
  const sum = (items, key) => items.reduce((total, row) => total + Number(row[key] || 0), 0);
  const roleOrder = ["TOP", "JGL", "MID", "ADC", "SUP"];
  const rowName = (row) => row?.summoner_name || row?.riot_id || row?.player_name || "Inconnu";
  const kdaRatio = (row) => (Number(row?.kills || 0) + Number(row?.assists || 0)) / Math.max(1, Number(row?.deaths || 0));
  const sideName = (match, teamKey) => {
    const side = matchTeamSideKey(match, teamKey);
    return side === "blue" ? "Côté bleu" : side === "red" ? "Côté rouge" : "Côté inconnu";
  };
  const wins = scoped.filter((match) => match.result === "Victoire").length;
  const games = scoped.length;
  const kills = sum(rows, "kills");
  const deaths = sum(rows, "deaths");
  const assists = sum(rows, "assists");
  const damageDiff = sum(rows, "damage") - sum(enemyRows, "damage");
  const goldDiff = sum(rows, "gold") - sum(enemyRows, "gold");
  const visionDiff = sum(rows, "vision") - sum(enemyRows, "vision");
  const topDamage = rows.slice().sort((a, b) => Number(b.damage || 0) - Number(a.damage || 0))[0];
  const topVision = rows.slice().sort((a, b) => Number(b.vision || 0) - Number(a.vision || 0))[0];
  const topKda = rows.slice().sort((a, b) => kdaRatio(b) - kdaRatio(a))[0];
  const championCounts = (items) => Array.from(items.reduce((map, row) => {
    if (row?.champion) map.set(row.champion, (map.get(row.champion) || 0) + 1);
    return map;
  }, new Map()).entries()).sort((a, b) => b[1] - a[1] || championDisplayName(a[0]).localeCompare(championDisplayName(b[0])));
  const allyChampionCounts = championCounts(rows);
  const enemyChampionCounts = championCounts(enemyRows);
  const firstMatch = scoped[0];
  const singleGame = games === 1;
  const visibleGames = scoped.slice(0, 5);
  const championRows = Math.max(1, Math.ceil(Math.max(allyChampionCounts.length, enemyChampionCounts.length) / 3));
  const championPanelHeight = 136 + championRows * 56;
  const groupListY = 556 + championPanelHeight + 24;
  const groupListHeight = 126 + Math.max(1, visibleGames.length) * 64 + (games > visibleGames.length ? 40 : 0);
  const canvas = document.createElement("canvas");
  canvas.width = 1920;
  canvas.height = singleGame ? 1376 : Math.max(1120, groupListY + groupListHeight + 104);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Le navigateur ne peut pas créer l'export PNG.");
  const W = canvas.width;
  const H = canvas.height;
  const M = 64;
  const contentW = W - M * 2;
  const columnW = (contentW - 24) / 2;
  const font = (size, weight = 600) => `${weight} ${size}px Inter, Arial, sans-serif`;
  const text = (value, x, y, width, size = 18, color = PNG_THEME.text, weight = 600, align = "left") => pngFitText(ctx, value, x, y, width, { font: font(size, weight), color, min: Math.min(size, 16), align });
  const imageCache = new Map();
  const drawImage = (sources, x, y, w, h, radius = 8) => {
    const image = (Array.isArray(sources) ? sources : [sources]).map((url) => imageCache.get(url)).find(Boolean);
    if (image) pngImageCover(ctx, image, x, y, w, h, radius);
    else pngPanel(ctx, x, y, w, h, { fill: PNG_THEME.panelAlt, radius });
  };
  const pill = (value, x, y, accent = "cyan") => {
    ctx.font = font(16, 700);
    const width = Math.min(360, Math.max(72, ctx.measureText(String(value)).width + 24));
    pngPanel(ctx, x, y, width, 32, { fill: pngTint(accent, 0.09), stroke: pngTint(accent, 0.25), radius: 8 });
    text(value, x + 12, y + 22, width - 24, 16, pngAccent(accent), 700);
    return width;
  };
  const teamAccent = (teamKey) => {
    const side = matchTeamSideKey(firstMatch, teamKey);
    return side === "red" ? "red" : side === "blue" ? "cyan" : teamKey === "ALLY" ? "cyan" : "red";
  };
  const drawObjectiveIcon = (type, x, y, size = 34) => {
    if (type !== "herald") {
      drawImage(OBJECTIVE_ICON_SOURCES[type] || OBJECTIVE_ICON_SOURCES.dragon, x, y, size, size, 8);
      return;
    }
    pngPanel(ctx, x, y, size, size, { fill: pngTint("purple", 0.10), stroke: pngTint("purple", 0.3), radius: 8 });
    ctx.save();
    ctx.fillStyle = PNG_THEME.purple;
    ctx.beginPath();
    ctx.moveTo(x + size / 2, y + 6);
    ctx.lineTo(x + size - 9, y + size / 2);
    ctx.lineTo(x + size / 2, y + size - 6);
    ctx.lineTo(x + 9, y + size / 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };
  const drawObjectives = (teamKey, x, y, w) => {
    const data = objectiveTeamSummary(firstMatch, teamKey);
    const accent = teamAccent(teamKey);
    text(`${sideName(firstMatch, teamKey)} · ${teamKey === "ALLY" ? "Alliés" : "Adversaires"}`, x, y + 26, w, 22, pngAccent(accent), 700);
    const cells = [["Drakes", data?.dragonCount || 0, "dragon"], ["Grubs", data?.grubs || 0, "grub"], ["Herald", data?.heralds || 0, "herald"], ["Nashor", data?.barons || 0, "baron"], ["Tours", data?.towers || 0, "tower"]];
    cells.forEach(([label, value, type], index) => {
      const cellX = x + index * (w / cells.length);
      drawObjectiveIcon(type, cellX, y + 48);
      text(String(value), cellX + 44, y + 75, w / cells.length - 52, 28, PNG_THEME.text, 700);
      text(label, cellX, y + 106, w / cells.length - 12, 16, PNG_THEME.muted);
    });
    const dragons = (data?.dragons || []).map(objectiveDragonElement).filter(Boolean);
    if (dragons.length) text(dragons.join(" · "), x, y + 136, w, 16, PNG_THEME.muted);
  };
  const drawPlayerRow = (row, x, y, w, accent, index) => {
    if (index % 2 === 0) {
      ctx.fillStyle = PNG_THEME.panelAlt;
      ctx.fillRect(x, y, w, 104);
    }
    if (index) pngLine(ctx, x, y, x + w, y, PNG_THEME.border);
    drawImage(championPortraitSources(row, row?.champion), x + 14, y + 20, 64, 64, 10);
    text(rowName(row), x + 94, y + 31, 202, 19, PNG_THEME.text, 700);
    text(`${row?.role || "Rôle ?"} · ${championDisplayName(row?.champion || "Champion ?")}`, x + 94, y + 58, 202, 16, pngAccent(accent));
    text(`${row?.kills || 0}/${row?.deaths || 0}/${row?.assists || 0}`, x + 316, y + 31, 104, 21, PNG_THEME.text, 700);
    text(`${creepScore(row)} CS`, x + 316, y + 58, 104, 16, PNG_THEME.muted);
    text(`${Math.round(parsePercent(row?.kill_participation || row?.kp || 0))}% KP`, x + 432, y + 31, 110, 16, PNG_THEME.muted);
    text(`${row?.vision || 0} VS`, x + 432, y + 58, 110, 16, PNG_THEME.muted);
    text(formatPoints(row?.gold), x + 554, y + 31, 120, 19, PNG_THEME.text, 700);
    text(formatPoints(row?.damage), x + 686, y + 31, w - 700, 19, PNG_THEME.text, 700);
    const spells = summonerSpellIds(row).filter(Boolean).slice(0, 2);
    const build = finalBuildItems(row).slice(0, 6);
    spells.forEach((spell, i) => drawImage(summonerSpellIconSources(spell), x + 554 + i * 32, y + 52, 28, 28, 6));
    build.forEach((item, i) => drawImage(itemIconSources(item.id), x + 626 + i * 32, y + 52, 28, 28, 6));
  };
  const drawTeam = (teamKey, teamRows, x, y) => {
    const accent = teamAccent(teamKey);
    pngPanel(ctx, x, y, columnW, 646, { accent });
    text(`${teamKey === "ALLY" ? "Alliés" : "Adversaires"} · ${sideName(firstMatch, teamKey)}`, x + 24, y + 46, columnW - 48, 28, PNG_THEME.text, 700);
    const rowX = x + 12;
    [["JOUEUR / CHAMPION", 26, 280], ["KDA / CS", 328, 106], ["KP / VISION", 444, 110], ["OR", 566, 120], ["DÉGÂTS", 698, 132]].forEach(([label, offset, width]) => text(label, x + offset, y + 91, width, 16, PNG_THEME.muted, 600));
    pngLine(ctx, x + 24, y + 106, x + columnW - 24, y + 106, PNG_THEME.border);
    roleOrder.forEach((role, index) => {
      const row = teamRows.find((item) => String(item.role || "").toUpperCase() === role) || { role, team_key: teamKey };
      drawPlayerRow(row, rowX, y + 114 + index * 104, columnW - 24, accent, index);
    });
  };
  const drawChampions = (label, counts, x, y, w, accent) => {
    text(label, x, y + 28, w - 220, 24, PNG_THEME.text, 700);
    text(`${counts.length} champions · ${counts.reduce((total, [, count]) => total + count, 0)} picks`, x + w, y + 27, 216, 16, PNG_THEME.muted, 600, "right");
    if (!counts.length) {
      text("Aucun champion détecté.", x, y + 90, w, 18, PNG_THEME.muted);
      return;
    }
    const gap = 12;
    const cellW = (w - gap * 2) / 3;
    counts.forEach(([champion, count], index) => {
      const cellX = x + (index % 3) * (cellW + gap);
      const cellY = y + 52 + Math.floor(index / 3) * 56;
      pngPanel(ctx, cellX, cellY, cellW, 48, { fill: PNG_THEME.panelAlt, radius: 8 });
      drawImage(championPortraitSources(champion, champion), cellX + 6, cellY + 6, 36, 36, 6);
      text(championDisplayName(champion), cellX + 52, cellY + 30, cellW - 98, 16, PNG_THEME.text);
      text(`×${count}`, cellX + cellW - 10, cellY + 30, 42, 16, pngAccent(accent), 700, "right");
    });
  };
  const imageGroups = new Map();
  const addImageGroup = (sources) => {
    const urls = [...new Set((Array.isArray(sources) ? sources : [sources]).filter(Boolean))].slice(0, 2);
    if (urls.length) imageGroups.set(JSON.stringify(urls), urls);
  };
  addImageGroup("/assets/nxt5-wordmark.png");
  if (singleGame) {
    ["dragon", "grub", "baron", "tower"].forEach((type) => addImageGroup(OBJECTIVE_ICON_SOURCES[type]));
    [...rows, ...enemyRows].forEach((row) => {
      addImageGroup(championPortraitSources(row, row?.champion));
      summonerSpellIds(row).filter(Boolean).slice(0, 2).forEach((spell) => addImageGroup(summonerSpellIconSources(spell)));
      finalBuildItems(row).slice(0, 6).forEach((item) => addImageGroup(itemIconSources(item.id)));
    });
  } else {
    [...allyChampionCounts, ...enemyChampionCounts].forEach(([champion]) => addImageGroup(championPortraitSources(champion, champion)));
  }
  await Promise.all([...imageGroups.values()].map(async (urls) => {
    for (const url of urls) {
      const image = imageCache.has(url) ? imageCache.get(url) : await pngLoadImage(url);
      imageCache.set(url, image);
      if (image) break;
    }
  }));
  pngBackground(ctx, W, H);
  pngHeader(ctx, { width: W, title: title || "Statistiques", subtitle: subtitle || `${games} game${games > 1 ? "s" : ""} exportée${games > 1 ? "s" : ""}`, eyebrow: singleGame ? "FICHE GAME" : "GROUPE DE GAMES", logo: imageCache.get("/assets/nxt5-wordmark.png"), meta: singleGame ? "ANALYSE DE MATCH" : "STATISTIQUES DU GROUPE" });
  const metricMarker = (value) => singleGame && firstMatch ? winningSideForDiff(firstMatch, value) : winningTeamForDiff(value);
  const metrics = [
    ["Games", String(games), `${wins}W - ${games - wins}L`, "cyan", ""],
    ["Winrate", `${Math.round((wins / Math.max(1, games)) * 100)}%`, "Sélection", wins >= games - wins ? "green" : "red", ""],
    ["KDA équipe", `${kills}/${deaths}/${assists}`, "Alliés", "cyan", ""],
    ["Écart or", formatGoldDiff(goldDiff), "Économie", goldDiff >= 0 ? "green" : "red", metricMarker(goldDiff)],
    ["Écart dégâts", `${damageDiff >= 0 ? "+" : ""}${formatPoints(damageDiff)}`, "Dégâts", damageDiff >= 0 ? "green" : "red", metricMarker(damageDiff)],
    ["Écart vision", `${visionDiff >= 0 ? "+" : ""}${formatPoints(visionDiff)}`, "Vision", visionDiff >= 0 ? "green" : "red", metricMarker(visionDiff)],
  ];
  pngMetricStrip(ctx, { x: M, width: contentW, items: metrics.map(([label, value, detail, accent, marker], index) => {
    const markerMeta = metricSideMarkerMeta(marker);
    return { label, value, detail, accent: index === 0 || index === 2 ? undefined : accent, marker: markerMeta?.text, markerAccent: markerMeta?.canvasAccent };
  }) });
  if (singleGame && firstMatch) {
    pngPanel(ctx, M, 348, contentW, 184);
    drawObjectives(objectiveTeamKeyForSide(firstMatch, "BLUE"), M + 28, 362, columnW - 56);
    pngLine(ctx, W / 2, 376, W / 2, 504, PNG_THEME.border);
    drawObjectives(objectiveTeamKeyForSide(firstMatch, "RED"), W / 2 + 40, 362, columnW - 56);
    let pillX = M;
    [[firstMatch.result || "Analyse", firstMatch.result === "Victoire" ? "green" : firstMatch.result === "Défaite" ? "red" : "cyan"], [firstMatch.duration || "--:--", "cyan"], [firstMatch.patch || "Patch ?", "cyan"]].forEach(([label, accent]) => { pillX += pill(label, pillX, 556, accent) + 12; });
    text("Sorts d’invocateur · Build final", W - M, 578, 500, 16, PNG_THEME.muted, 600, "right");
    drawTeam("ALLY", rows, M, 612);
    drawTeam("ENEMY", enemyRows, M + columnW + 24, 612);
  } else {
    pngPanel(ctx, M, 348, contentW, 184);
    text("Signaux du bloc", M + 28, 394, contentW - 56, 28, PNG_THEME.text, 700);
    const leaders = [
      ["Meilleur KDA", topKda ? `${rowName(topKda)} · ${championDisplayName(topKda.champion)}` : "N/A", topKda ? `${topKda.kills || 0}/${topKda.deaths || 0}/${topKda.assists || 0}` : "—", "cyan"],
      ["Plus de dégâts", topDamage ? `${rowName(topDamage)} · ${championDisplayName(topDamage.champion)}` : "N/A", topDamage ? formatPoints(topDamage.damage) : "—", "yellow"],
      ["Plus de vision", topVision ? `${rowName(topVision)} · ${championDisplayName(topVision.champion)}` : "N/A", topVision ? `${topVision.vision || 0} VS` : "—", "purple"],
    ];
    leaders.forEach(([label, name, value, accent], index) => {
      const colW = (contentW - 56) / 3;
      const x = M + 28 + index * colW;
      if (index) pngLine(ctx, x - 16, 418, x - 16, 508, PNG_THEME.border);
      text(label.toUpperCase(), x, 438, colW - 36, 16, PNG_THEME.muted);
      text(name, x, 468, colW - 40, 20, PNG_THEME.text, 700);
      text(value, x, 503, colW - 40, 24, pngAccent(accent), 700);
    });
    pngPanel(ctx, M, 556, contentW, championPanelHeight);
    text("Champions joués", M + 28, 602, contentW - 56, 28, PNG_THEME.text, 700);
    text(`${rows.length} picks NXT5 · ${enemyRows.length} picks adverses`, W - M - 28, 600, 670, 16, PNG_THEME.muted, 600, "right");
    drawChampions("Alliés", allyChampionCounts, M + 28, 620, columnW - 56, "cyan");
    drawChampions("Adversaires", enemyChampionCounts, M + columnW + 52, 620, columnW - 56, "red");
    pngPanel(ctx, M, groupListY, contentW, groupListHeight);
    text("Games du groupe", M + 28, groupListY + 46, 700, 28, PNG_THEME.text, 700);
    text(`${games} games · ${wins}W - ${games - wins}L`, W - M - 28, groupListY + 44, 500, 18, PNG_THEME.muted, 600, "right");
    const listX = M + 28;
    const listW = contentW - 56;
    const resultX = listX + listW - 600;
    const durationX = listX + listW - 400;
    const sideX = listX + listW - 250;
    [["GAME", listX, 850], ["RÉSULTAT", resultX, 180], ["DURÉE", durationX, 130], ["CÔTÉ", sideX, 130]].forEach(([label, x, width]) => text(label, x, groupListY + 88, width, 16, PNG_THEME.muted));
    text("PATCH", listX + listW, groupListY + 88, 120, 16, PNG_THEME.muted, 600, "right");
    pngLine(ctx, listX, groupListY + 104, listX + listW, groupListY + 104, PNG_THEME.border);
    if (!visibleGames.length) text("Aucune game dans cette sélection.", listX, groupListY + 146, listW, 18, PNG_THEME.muted);
    visibleGames.forEach((match, index) => {
      const y = groupListY + 114 + index * 64;
      if (index % 2 === 0) {
        ctx.fillStyle = PNG_THEME.panelAlt;
        ctx.fillRect(listX - 10, y, listW + 20, 64);
      }
      const accent = match.result === "Victoire" ? "green" : match.result === "Défaite" ? "red" : "cyan";
      text(matchDisplayName(match, "Game"), listX, y + 26, listW - 636, 20, PNG_THEME.text, 700);
      text(match.game_id || "Game ID", listX, y + 51, listW - 636, 16, PNG_THEME.muted);
      text(match.result || "Analyse", resultX, y + 39, 180, 18, pngAccent(accent), 700);
      text(match.duration || "--:--", durationX, y + 39, 130, 18, PNG_THEME.text);
      const rawSide = String(match.side || "").toUpperCase();
      const blue = rawSide.includes("BLUE") || rawSide.includes("BLEU");
      const red = rawSide.includes("RED") || rawSide.includes("ROUGE");
      text(blue ? "BLUE" : red ? "RED" : match.side || "—", sideX, y + 39, 130, 16, blue ? PNG_THEME.cyan : red ? PNG_THEME.red : PNG_THEME.muted, 700);
      text(match.patch || "Patch ?", listX + listW, y + 39, 120, 18, PNG_THEME.muted, 600, "right");
    });
    if (games > visibleGames.length) text(`+ ${games - visibleGames.length} games dans le groupe · incluses dans les statistiques`, listX, groupListY + groupListHeight - 20, listW, 16, PNG_THEME.muted);
  }
  pngFooter(ctx, { width: W, height: H, label: singleGame ? "Statistiques de game" : "Statistiques du groupe" });
  await pngDownload(canvas, filename || "nxt5-stats-export.png");
}

function metricSideMarkerMeta(marker) {
  const key = String(marker || "").toLowerCase();
  return {
    blue: { label: "Bleu", text: "< Bleu", tone: "cyan", canvasAccent: "cyan" },
    red: { label: "Rouge", text: "Rouge >", tone: "red", canvasAccent: "pink" },
    ally: { label: "NXT5", text: "NXT5 >", tone: "cyan", canvasAccent: "cyan" },
    enemy: { label: "ADV", text: "< ADV", tone: "red", canvasAccent: "pink" },
    tie: { label: "Égal", text: "Égal", tone: "slate", canvasAccent: "yellow" },
  }[key] || null;
}

function MetricSideMarker({ marker }) {
  const meta = metricSideMarkerMeta(marker);
  if (!meta) return null;
  return <span className={cx("inline-flex shrink-0 items-center rounded-lg border px-1.5 py-0.5 text-[0.56rem] font-black uppercase leading-none tracking-[0.08em]", tone(meta.tone))}>{meta.text}</span>;
}

function MetricCard({ icon: Icon, label, value, hint, tone: t = "purple", delay = 0, compact = false, sideMarker = "" }) {
  return (
    <Surface delay={delay} className={cx("overflow-hidden", compact ? "min-h-0 p-3" : "min-h-[104px] p-3 sm:p-4")}>
      <div className={cx("flex items-start justify-between", compact ? "gap-3" : "gap-4")}>
        <div className="min-w-0 flex-1"><div className="flex min-w-0 items-start justify-between gap-2"><p className={cx("min-w-0 font-black uppercase tracking-[0.12em] text-slate-300", compact ? "text-[0.62rem]" : "text-[0.68rem]")}>{label}</p><MetricSideMarker marker={sideMarker} /></div><p className={cx("break-words font-black text-white", compact ? "mt-1 text-xl sm:text-2xl" : "mt-1 text-2xl sm:text-3xl")}>{value ?? "-"}</p><p className={cx("line-clamp-2 font-semibold text-slate-300", compact ? "mt-1 text-[0.7rem] leading-4" : "mt-1 text-xs leading-5")}>{hint ?? "En attente de données"}</p></div>
        <div className={cx("shrink-0 rounded-xl border", compact ? "p-2" : "p-2.5", tone(t))}><Icon className={cx(compact ? "h-4 w-4" : "h-5 w-5")} /></div>
      </div>
    </Surface>
  );
}

function formatCompactGoldDiff(value) {
  const number = Math.round(Number(value || 0));
  const sign = number >= 0 ? "+" : "-";
  const abs = Math.abs(number);
  if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(1)}k`;
  return `${sign}${abs}`;
}

function oppositeSideKey(side) {
  return side === "blue" ? "red" : side === "red" ? "blue" : "";
}

function matchTeamSideKey(match, teamKey) {
  const teamId = objectiveTeamId(match, teamKey);
  if (teamId === 100) return "blue";
  if (teamId === 200) return "red";
  const allySide = String(match?.side || "").toLowerCase();
  const side = allySide.includes("blue") ? "blue" : allySide.includes("red") ? "red" : "";
  if (!side) return "";
  return teamKey === "ALLY" ? side : oppositeSideKey(side);
}

function winningSideForDiff(match, value) {
  const diff = Number(value || 0);
  if (!diff) return "tie";
  const allySide = matchTeamSideKey(match, "ALLY");
  if (!allySide) return diff > 0 ? "ally" : "enemy";
  return diff > 0 ? allySide : oppositeSideKey(allySide);
}

function winningTeamForDiff(value) {
  const diff = Number(value || 0);
  if (!diff) return "tie";
  return diff > 0 ? "ally" : "enemy";
}

// Compatibility export: both former pages now share the Games workspace.
function Matches(props) { return <Statistics {...props} />; }

function objectiveEventTone(event) {
  const label = objectiveEventLabel(event).toLowerCase();
  if (label.includes("nashor")) return "purple";
  if (label.includes("herald") || label.includes("grub")) return "pink";
  if (label.includes("infernal")) return "red";
  if (label.includes("ocean")) return "cyan";
  if (label.includes("mountain")) return "slate";
  if (label.includes("cloud")) return "blue";
  if (label.includes("chemtech")) return "green";
  if (label.includes("hextech")) return "purple";
  return "cyan";
}

function objectiveEventIcon(event) {
  const label = objectiveEventLabel(event).toLowerCase();
  if (label.includes("nashor")) return "N";
  if (label.includes("herald")) return "H";
  if (label.includes("grub")) return "G";
  if (label.includes("infernal")) return "F";
  if (label.includes("ocean")) return "O";
  if (label.includes("mountain")) return "M";
  if (label.includes("cloud")) return "C";
  if (label.includes("chemtech")) return "CH";
  if (label.includes("hextech")) return "HX";
  return "D";
}

function objectiveDragonElementKey(event) {
  const subtype = String(event?.monsterSubType || event?.dragonType || event?.element || "").toUpperCase();
  const label = objectiveEventLabel(event).toLowerCase();
  const source = `${subtype} ${label}`;
  if (source.includes("ELDER")) return "elder";
  if (source.includes("FIRE") || source.includes("INFERNAL")) return "fire";
  if (source.includes("WATER") || source.includes("OCEAN")) return "water";
  if (source.includes("EARTH") || source.includes("MOUNTAIN")) return "earth";
  if (source.includes("AIR") || source.includes("CLOUD")) return "air";
  if (source.includes("CHEMTECH")) return "chemtech";
  if (source.includes("HEXTECH")) return "hextech";
  return "";
}

function objectiveDragonIconType(event) {
  const key = objectiveDragonElementKey(event);
  return key ? `dragon-${key}` : "dragon";
}

function objectivePictogramType(event) {
  const type = objectiveEventType(event);
  return type === "dragon" ? objectiveDragonIconType(event) : type;
}

function objectiveTeamKeyForSide(match, side) {
  const targetTeamId = side === "BLUE" ? 100 : 200;
  const exact = ["ALLY", "ENEMY"].find((teamKey) => objectiveTeamId(match, teamKey) === targetTeamId);
  if (exact) return exact;
  const allySide = String(match?.side || "").toUpperCase().startsWith("BLUE") ? "BLUE" : String(match?.side || "").toUpperCase().startsWith("RED") ? "RED" : "";
  if (allySide) return side === allySide ? "ALLY" : "ENEMY";
  return side === "BLUE" ? "ALLY" : "ENEMY";
}

function objectiveDragonElement(event) {
  const labels = {
    fire: "Infernal",
    water: "Océan",
    earth: "Montagne",
    air: "Nuage",
    chemtech: "Chemtech",
    hextech: "Hextech",
    elder: "Ancestral",
  };
  const key = objectiveDragonElementKey(event);
  if (labels[key]) return labels[key];
  const label = objectiveEventLabel(event).replace(/\s*Dragon$/i, "").trim();
  return label && label.toLowerCase() !== "dragon" ? label : "Dragon";
}

const OBJECTIVE_ICON_SOURCES = {
  dragon: [
    "https://raw.communitydragon.org/latest/game/assets/ux/announcements/dragon_circle.png",
    "/assets/objectives/dragon.png",
    "https://raw.communitydragon.org/latest/game/assets/characters/sru_dragon/hud/dragon_circle.png",
    "https://raw.communitydragon.org/latest/game/assets/ux/minimap/icons/dragon.png",
  ],
  "dragon-fire": [
    "https://raw.communitydragon.org/latest/game/assets/ux/announcements/dragon_circle_fire.png",
    "https://raw.communitydragon.org/latest/game/assets/characters/sru_dragon_fire/hud/dragon_circle_fire.png",
    "https://raw.communitydragon.org/pbe/game/assets/characters/sru_dragon_fire/hud/dragon_circle_fire.png",
  ],
  "dragon-water": [
    "https://raw.communitydragon.org/latest/game/assets/ux/announcements/dragon_circle_water.png",
    "https://raw.communitydragon.org/latest/game/assets/characters/sru_dragon_water/hud/dragon_circle_water.png",
    "https://raw.communitydragon.org/pbe/game/assets/characters/sru_dragon_water/hud/dragon_circle_water.png",
  ],
  "dragon-earth": [
    "https://raw.communitydragon.org/latest/game/assets/ux/announcements/dragon_circle_earth.png",
    "https://raw.communitydragon.org/latest/game/assets/characters/sru_dragon_earth/hud/dragon_circle_earth.png",
    "https://raw.communitydragon.org/pbe/game/assets/characters/sru_dragon_earth/hud/dragon_circle_earth.png",
  ],
  "dragon-air": [
    "https://raw.communitydragon.org/latest/game/assets/ux/announcements/dragon_circle_air.png",
    "https://raw.communitydragon.org/latest/game/assets/characters/sru_dragon_air/hud/dragon_air_circle.png",
    "https://raw.communitydragon.org/pbe/game/assets/characters/sru_dragon_air/hud/dragon_air_circle.png",
  ],
  "dragon-chemtech": [
    "https://raw.communitydragon.org/latest/game/assets/ux/announcements/dragon_circle_chemtech.png",
    "https://raw.communitydragon.org/latest/game/assets/characters/sru_dragon_chemtech/hud/icons2d/dragon_circle_chemtech.png",
    "https://raw.communitydragon.org/pbe/game/assets/characters/sru_dragon_chemtech/hud/icons2d/dragon_circle_chemtech.png",
  ],
  "dragon-hextech": [
    "https://raw.communitydragon.org/latest/game/assets/ux/announcements/dragon_circle_hextech.png",
    "https://raw.communitydragon.org/latest/game/assets/characters/sru_dragon_hextech/hud/icons2d/dragon_circle_hextech.png",
    "https://raw.communitydragon.org/pbe/game/assets/characters/sru_dragon_hextech/hud/icons2d/dragon_circle_hextech.png",
  ],
  "dragon-elder": [
    "https://raw.communitydragon.org/latest/game/assets/ux/announcements/dragon_circle_elder.png",
    "https://raw.communitydragon.org/latest/game/assets/characters/sru_dragon_elder/hud/dragon_circle_elder.png",
  ],
  baron: [
    "https://raw.communitydragon.org/latest/game/assets/ux/announcements/baron_circle.png",
    "/assets/objectives/baron.png",
    "https://raw.communitydragon.org/latest/game/assets/characters/sru_baron/hud/baron_circle.png",
    "https://raw.communitydragon.org/latest/game/assets/ux/minimap/icons/baron.png",
  ],
  grub: [
    "https://raw.communitydragon.org/latest/game/assets/ux/announcements/sru_voidgrub_circle.png",
    "/assets/objectives/grub.png",
    "https://raw.communitydragon.org/latest/game/assets/characters/sru_horde/hud/sru_voidgrub_circle.png",
    "https://raw.communitydragon.org/latest/game/assets/characters/sru_voidgrub/hud/sru_voidgrub_circle.png",
    "https://raw.communitydragon.org/latest/game/assets/ux/minimap/icons/voidgrub.png",
  ],
  herald: [
    "https://raw.communitydragon.org/latest/game/assets/characters/sru_riftherald/hud/sruriftherald_circle.srt_2024_strategy_differentiation_preseason.png",
    "https://raw.communitydragon.org/pbe/game/assets/characters/sru_riftherald/hud/sruriftherald_circle.srt_2024_strategy_differentiation_preseason.png",
    "https://raw.communitydragon.org/latest/game/assets/characters/sru_riftherald/hud/sruriftherald_circle.png",
  ],
  tower: [
    "/assets/objectives/tower.png",
    "https://raw.communitydragon.org/latest/game/assets/characters/turret/hud/turret_blue_circle.png",
    "https://raw.communitydragon.org/latest/game/assets/ux/minimap/icons/turret.png",
  ],
};

function ObjectivePictogram({ type, className = "", fallback = "O" }) {
  const sources = OBJECTIVE_ICON_SOURCES[type] || OBJECTIVE_ICON_SOURCES.dragon;
  const [sourceIndex, setSourceIndex] = useState(0);
  useEffect(() => setSourceIndex(0), [type]);
  const source = sources[sourceIndex];
  if (!source) return <ObjectiveFallbackIcon type={type} fallback={fallback} className={className} />;
  return <img src={source} alt="" className={cx("object-contain drop-shadow-[0_0_10px_rgba(255,255,255,.2)]", className)} loading="lazy" decoding="async" onError={() => setSourceIndex((index) => index + 1)} />;
}

function ObjectiveFallbackIcon({ type, fallback = "O", className = "" }) {
  const config = {
    "dragon-fire": ["#fb923c", "#ef4444", "F"],
    "dragon-water": ["#67e8f9", "#2563eb", "O"],
    "dragon-earth": ["#d6d3d1", "#78716c", "M"],
    "dragon-air": ["#bfdbfe", "#38bdf8", "A"],
    "dragon-chemtech": ["#86efac", "#16a34a", "C"],
    "dragon-hextech": ["#c084fc", "#2563eb", "H"],
    "dragon-elder": ["#f0abfc", "#7c3aed", "E"],
  }[type] || ["#dffaff", "#0891b2", fallback];
  const [start, end, text] = config;
  return <span className={cx("inline-flex items-center justify-center rounded-full border border-white/20 text-[0.58rem] font-black text-white shadow-[0_0_16px_rgba(255,255,255,.16)]", className)} style={{ background: `radial-gradient(circle at 35% 25%, ${start}, ${end} 70%)` }}>{text}</span>;
}

function objectiveSummaryHasData(data) {
  return Boolean(data && (data.dragonCount || data.grubs || data.heralds || data.barons || data.towers || data.dragons?.length));
}

function ObjectiveTeamCard({ match, teamKey, side, title, data: providedData }) {
  const data = providedData || objectiveTeamSummary(match, teamKey);
  const isRed = side === "RED";
  const stats = [
    ["Dragons", data.dragonCount, "dragon", "cyan"],
    ["Grubs", data.grubs, "grub", "green"],
    ["Herald", data.heralds, "herald", "pink"],
    ["Nashor", data.barons, "baron", "purple"],
    ["Tours", data.towers, "tower", "blue"],
  ];
  return <section className={cx("min-w-0 px-3 py-3 sm:px-4", isRed ? "bg-rose-500/[0.035]" : "border-b border-white/[0.08] bg-cyan-400/[0.035] xl:border-b-0 xl:border-r")}>
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className={cx("h-2 w-2 shrink-0 rounded-full shadow-[0_0_12px_currentColor]", isRed ? "bg-rose-300 text-rose-300" : "bg-cyan-200 text-cyan-200")} />
        <h4 className="truncate text-[0.68rem] font-black uppercase tracking-[0.12em] text-white">{title}</h4>
      </div>
      <p className="shrink-0 text-[0.6rem] font-black uppercase tracking-[0.12em] text-slate-400"><span className="text-white">{data.dragonCount}</span> drake{data.dragonCount > 1 ? "s" : ""}</p>
    </div>
    <dl className="mt-3 grid grid-cols-5 border-y border-white/[0.07] py-3">
      {stats.map(([label, value, icon, t], index) => <div key={label} className={cx("min-w-0 px-1 text-center sm:px-2", index > 0 && "border-l border-white/[0.07]")}>
        <dt className="flex min-w-0 flex-col items-center justify-center gap-1.5">
          <span className={cx("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", tone(t))}><ObjectivePictogram type={icon} fallback={String(label).charAt(0)} className="h-9 w-9" /></span>
          <span className="hidden max-w-full truncate text-[0.52rem] font-black uppercase tracking-[0.08em] text-slate-400 sm:block">{label}</span>
        </dt>
        <dd className="mt-1 text-lg font-black tabular-nums text-white">{value}</dd>
      </div>)}
    </dl>
    {data.dragons.length > 0 && <div className="mt-2.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
      <p className="shrink-0 text-[0.54rem] font-black uppercase tracking-[0.14em] text-slate-400">Dragons</p>
      <div className="flex min-w-0 flex-wrap gap-1.5">
        {data.dragons.map((event, index) => <span key={`${teamKey}-dragon-${event.timestamp}-${index}`} className={cx("inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[0.62rem] font-black text-white", tone(objectiveEventTone(event)))}>
          <ObjectivePictogram type={objectiveDragonIconType(event)} fallback={objectiveEventIcon(event)} className="h-6 w-6" />
          {objectiveDragonElement(event)}
          <span className="text-white/65">{event.time}</span>
        </span>)}
      </div>
    </div>}
  </section>;
}

function ObjectiveHud({ match, compact = false }) {
  const events = objectiveEvents(match);
  const blueTeamKey = objectiveTeamKeyForSide(match, "BLUE");
  const redTeamKey = objectiveTeamKeyForSide(match, "RED");
  const blueData = objectiveTeamSummary(match, blueTeamKey);
  const redData = objectiveTeamSummary(match, redTeamKey);
  if (!events.length && !objectiveSummaryHasData(blueData) && !objectiveSummaryHasData(redData)) return null;
  return <div className={cx("rounded-[1.25rem] bg-gradient-to-br from-cyan-400/[0.035] via-black/12 to-fuchsia-400/[0.03] p-3 ring-1 ring-cyan-200/[0.06]", compact ? "mb-3" : "mt-4")}>
    <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 px-1">
      <div className="flex min-w-0 items-center gap-2">
        <Trophy className="h-4 w-4 shrink-0 text-cyan-200" />
        <h3 className="text-xs font-black uppercase tracking-[0.14em] text-white">Objectifs</h3>
      </div>
      {events.length > 0 && <p className="text-[0.6rem] font-black uppercase tracking-[0.12em] text-slate-400"><span className="text-white">{events.length}</span> prises enregistrées</p>}
    </div>
    <div className="grid overflow-hidden rounded-2xl border border-white/[0.08] bg-black/10 xl:grid-cols-2">
      <ObjectiveTeamCard match={match} teamKey={blueTeamKey} side="BLUE" title="Côté bleu" data={blueData} />
      <ObjectiveTeamCard match={match} teamKey={redTeamKey} side="RED" title="Côté rouge" data={redData} />
    </div>
    {events.length ? <>
      <div className="nxt5-objective-timeline mt-2 overflow-x-auto overflow-y-hidden border-t border-white/[0.07] pt-2 pb-1">
        <ol className="flex w-max min-w-full items-stretch px-2 py-1">
          {events.map((event, index) => {
            const isRed = event.side === "RED";
            return <li key={`${event.timestamp}-${index}`} className="flex shrink-0 items-center">
              <div className={cx("relative flex min-h-[4rem] w-[8rem] items-center gap-2 overflow-hidden rounded-xl border px-2.5 py-2 sm:w-[8.5rem]", isRed ? "border-rose-200/12 bg-rose-500/[0.045]" : "border-cyan-200/12 bg-cyan-400/[0.045]")}>
                <span className={cx("absolute inset-y-2 left-0 w-0.5 rounded-r-full", isRed ? "bg-rose-300/70" : "bg-cyan-200/70")} />
                <span className={cx("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border", tone(objectiveEventTone(event)))}>
                  <ObjectivePictogram type={objectivePictogramType(event)} fallback={objectiveEventIcon(event)} className="h-6 w-6" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-center gap-1">
                    <time className="shrink-0 text-[0.58rem] font-black tabular-nums text-white">{event.time}</time>
                    <span className={cx("h-1 w-1 shrink-0 rounded-full", isRed ? "bg-rose-300" : "bg-cyan-200")} />
                    <span className={cx("whitespace-nowrap text-[0.48rem] font-black uppercase", isRed ? "text-rose-100/75" : "text-cyan-100/75")}>{isRed ? "Rouge" : "Bleu"}</span>
                  </span>
                  <span className="mt-0.5 line-clamp-2 block text-[0.68rem] font-black leading-4 text-white">{event.label}</span>
                </span>
              </div>
              {index < events.length - 1 && <span className="flex w-3 shrink-0 items-center" aria-hidden="true"><span className="h-px flex-1 bg-white/12" /><span className="h-1 w-1 rounded-full bg-white/25" /></span>}
            </li>;
          })}
        </ol>
      </div>
    </> : null}
  </div>;
}

function roleScore(row) {
  const kda = (statValue(row, "kills") + statValue(row, "assists")) / Math.max(1, statValue(row, "deaths"));
  const kp = parsePercent(row.kill_participation || row.kp);
  return statValue(row, "damage") / 1000 + statValue(row, "gold") / 1000 + statValue(row, "vision") * 0.4 + kda * 6 + kp * 0.2;
}

function timelineFrames(match) {
  return matchTimelineFrames(match);
}

function teamKeyFromTeamId(match, teamId) {
  const allyTeamId = objectiveTeamId(match, "ALLY");
  const enemyTeamId = objectiveTeamId(match, "ENEMY");
  if (Number(teamId || 0) === allyTeamId) return "ALLY";
  if (Number(teamId || 0) === enemyTeamId) return "ENEMY";
  return "";
}

function rowByParticipantId(match, participantId) {
  const id = Number(participantId || 0);
  return (match?.participants || []).find((row) => rowParticipantId(row) === id) || null;
}

function championKillEvents(match) {
  const teams = participantTeamMap(match);
  return timelineFrames(match).flatMap((frame) => (frame.events || []).filter((event) => event.type === "CHAMPION_KILL").map((event) => {
    const killerId = Number(event.killerId || 0);
    const victimId = Number(event.victimId || 0);
    const killerTeam = teamKeyFromTeamId(match, teams.get(killerId));
    const victimTeam = teamKeyFromTeamId(match, teams.get(victimId));
    const victim = rowByParticipantId(match, victimId);
    const killer = rowByParticipantId(match, killerId);
    return { ...event, killerId, victimId, killerTeam, victimTeam, victim, killer, timestamp: Number(event.timestamp || frame.timestamp || 0), time: formatCountdown(Math.floor(Number(event.timestamp || frame.timestamp || 0) / 1000)), shutdown: Number(event.shutdownBounty || event.bounty || 0) };
  })).sort((a, b) => a.timestamp - b.timestamp);
}

function buildingEvents(match) {
  const teams = participantTeamMap(match);
  return timelineFrames(match).flatMap((frame) => (frame.events || []).filter((event) => event.type === "BUILDING_KILL").map((event) => {
    const killerId = Number(event.killerId || 0);
    const teamKey = teamKeyFromTeamId(match, teams.get(killerId) || event.teamId);
    return { ...event, teamKey: teamKey || (Number(event.teamId) === objectiveTeamId(match, "ALLY") ? "ENEMY" : "ALLY"), timestamp: Number(event.timestamp || frame.timestamp || 0), time: formatCountdown(Math.floor(Number(event.timestamp || frame.timestamp || 0) / 1000)), label: String(event.buildingType || "Tour").replace("TOWER_BUILDING", "Tour").replace(/_/g, " ") };
  })).sort((a, b) => a.timestamp - b.timestamp);
}

function teamGoldAtMinute(match, teamKey, minute) {
  const frame = timelineFrames(match).find((item) => Number(item.timestamp || 0) >= minute * 60 * 1000);
  const ids = new Set(teamRows(match, teamKey).map(rowParticipantId).filter(Boolean));
  if (!frame || !ids.size) return null;
  return Object.entries(frame.participantFrames || {}).reduce((total, [id, data]) => ids.has(Number(id)) ? total + Number(data.totalGold || 0) : total, 0);
}

function timelineStatus(match) {
  const frames = storedTimelineFrames(match);
  if (frames.length) return { label: "Timeline fiable", toneName: "green", detail: `${frames.length} frames Riot` };
  const events = compactTimelineEvents(match);
  const summaryAvailable = Boolean(match?.raw?.nxt5?.timelineSummary?.available);
  if (events.length || summaryAvailable) return { label: "Timeline résumée", toneName: "cyan", detail: events.length ? `${events.length} événements indexés` : "Repères CS et vision disponibles" };
  return { label: "Timeline absente", toneName: "yellow", detail: "Lecture limitée aux stats finales" };
}

function deathContext(match) {
  const kills = championKillEvents(match);
  const objectives = objectiveEvents(match);
  const allyDeaths = kills.filter((event) => event.victimTeam === "ALLY");
  const beforeObjectives = allyDeaths.filter((death) => objectives.some((objective) => objective.timestamp > death.timestamp && objective.timestamp - death.timestamp <= 90000));
  const shutdowns = allyDeaths.filter((death) => death.shutdown >= 300);
  const repeated = Array.from(allyDeaths.reduce((map, death) => {
    const key = death.victim?.summoner_name || death.victim?.riot_id || death.victim?.champion || "Joueur";
    const current = map.get(key) || { name: key, champion: death.victim?.champion, deaths: 0 };
    current.deaths += 1;
    map.set(key, current);
    return map;
  }, new Map()).values()).sort((a, b) => b.deaths - a.deaths);
  const isolated = allyDeaths.filter((death) => {
    const allyTrade = kills.some((kill) => kill.killerTeam === "ALLY" && Math.abs(kill.timestamp - death.timestamp) <= 15000);
    return !allyTrade && (death.assistingParticipantIds || []).length <= 1;
  });
  return { allyDeaths, beforeObjectives, shutdowns, repeated, isolated };
}

function objectiveContext(match) {
  const kills = championKillEvents(match);
  return objectiveEvents(match).map((objective) => {
    const previousKill = kills.slice().reverse().find((kill) => kill.timestamp < objective.timestamp && objective.timestamp - kill.timestamp <= 45000);
    const alliedDeathBefore = kills.slice().reverse().find((kill) => kill.victimTeam === "ALLY" && kill.timestamp < objective.timestamp && objective.timestamp - kill.timestamp <= 90000);
    return { ...objective, previousKill, alliedDeathBefore, context: previousKill ? `${previousKill.killerTeam === objective.teamKey ? "Après un kill" : "Après un fight adverse"} · ${previousKill.time}` : alliedDeathBefore ? `Après mort alliée · ${alliedDeathBefore.time}` : "Préparation neutre / non déduite" };
  });
}

function roleDiffRows(match) {
  const ally = teamRows(match, "ALLY");
  const enemy = teamRows(match, "ENEMY");
  return COMP_ROLES.map((role) => {
    const a = ally.find((row) => normalizeProfileRole(row.role) === role);
    const e = enemy.find((row) => normalizeProfileRole(row.role) === role);
    const cs10A = a ? csAtMinute({ ...a, match }, 10) : null;
    const cs10E = e ? csAtMinute({ ...e, match }, 10) : null;
    return { role, ally: a, enemy: e, goldDiff: statValue(a, "gold") - statValue(e, "gold"), damageDiff: statValue(a, "damage") - statValue(e, "damage"), cs10Diff: Number.isFinite(cs10A) && Number.isFinite(cs10E) ? cs10A - cs10E : null, deathsDiff: statValue(a, "deaths") - statValue(e, "deaths") };
  });
}

function timelineTeamLabel(teamKey) {
  if (teamKey === "ALLY") return "NXT5";
  if (teamKey === "ENEMY") return "Adversaire";
  return "Contesté";
}

function timelineTeamTone(teamKey) {
  if (teamKey === "ALLY") return "cyan";
  if (teamKey === "ENEMY") return "red";
  return "yellow";
}

function formatSignedShort(value) {
  const number = Number(value || 0);
  return `${number >= 0 ? "+" : ""}${formatPoints(number)}`;
}

function timelinePhaseMeta(timestamp) {
  const minute = Number(timestamp || 0) / 60000;
  if (minute < 14) return { id: "early", label: "Early", range: "0-14", toneName: "cyan" };
  if (minute < 24) return { id: "mid", label: "Mid game", range: "14-24", toneName: "purple" };
  return { id: "late", label: "Late", range: "24+", toneName: "yellow" };
}

function teamGoldAtTimestamp(match, teamKey, timestamp) {
  const frames = timelineFrames(match);
  const ids = new Set(teamRows(match, teamKey).map(rowParticipantId).filter(Boolean));
  if (!frames.length || !ids.size) return null;
  const target = Number(timestamp || 0);
  let frame = frames[0];
  for (const item of frames) {
    if (Number(item.timestamp || 0) <= target) frame = item;
    else break;
  }
  return Object.entries(frame?.participantFrames || {}).reduce((total, [id, data]) => ids.has(Number(id)) ? total + Number(data.totalGold || 0) : total, 0);
}

function timelineGoldDiff(match, timestamp) {
  const allyGold = teamGoldAtTimestamp(match, "ALLY", timestamp);
  const enemyGold = teamGoldAtTimestamp(match, "ENEMY", timestamp);
  return Number.isFinite(allyGold) && Number.isFinite(enemyGold) ? allyGold - enemyGold : null;
}

function killScoreAtTimestamp(kills, timestamp) {
  return kills.reduce((score, kill) => {
    if (Number(kill.timestamp || 0) > Number(timestamp || 0)) return score;
    if (kill.killerTeam === "ALLY") score.ally += 1;
    if (kill.killerTeam === "ENEMY") score.enemy += 1;
    return score;
  }, { ally: 0, enemy: 0 });
}

function fightWindows(match) {
  const kills = championKillEvents(match);
  const groups = [];
  let current = [];
  kills.forEach((kill) => {
    const previous = current[current.length - 1];
    if (!previous || Number(kill.timestamp || 0) - Number(previous.timestamp || 0) <= 24000) current.push(kill);
    else {
      groups.push(current);
      current = [kill];
    }
  });
  if (current.length) groups.push(current);
  return groups.filter((group) => group.length >= 2).map((group, index) => {
    const allyKills = group.filter((kill) => kill.killerTeam === "ALLY").length;
    const enemyKills = group.filter((kill) => kill.killerTeam === "ENEMY").length;
    const teamKey = allyKills === enemyKills ? "NEUTRAL" : allyKills > enemyKills ? "ALLY" : "ENEMY";
    const victims = group.map((kill) => championDisplayName(kill.victim?.champion)).filter(Boolean).slice(0, 4);
    const start = group[0];
    const end = group[group.length - 1];
    const time = start.timestamp === end.timestamp ? start.time : `${start.time}-${end.time}`;
    return {
      kind: "fight",
      timestamp: Number(start.timestamp || 0),
      time,
      teamKey,
      toneName: timelineTeamTone(teamKey),
      title: teamKey === "NEUTRAL" ? "Fight échangé" : `${timelineTeamLabel(teamKey)} gagne le fight`,
      context: `${allyKills}-${enemyKills} kills sur la fenêtre`,
      detail: victims.length ? `Morts: ${victims.join(" · ")}` : `Fight #${index + 1}`,
      allyKills,
      enemyKills,
      killCount: group.length,
    };
  });
}

function importantBuildingEvents(match) {
  const events = buildingEvents(match);
  return events.filter((event, index) => {
    const type = `${event.buildingType || ""} ${event.towerType || ""}`.toUpperCase();
    return index === 0 || index < 4 || type.includes("INHIBITOR") || type.includes("NEXUS");
  }).slice(0, 6);
}

function timelineMilestones(match) {
  const objectives = objectiveContext(match).map((event) => ({
    ...event,
    kind: "objective",
    title: event.label,
    detail: event.context,
    toneName: timelineTeamTone(event.teamKey),
  }));
  const fights = fightWindows(match).filter((event) => event.killCount >= 3 || Math.abs(event.allyKills - event.enemyKills) >= 2);
  const towers = importantBuildingEvents(match).map((event) => ({
    ...event,
    kind: "tower",
    title: event.label,
    toneName: timelineTeamTone(event.teamKey),
    context: "Pression structure",
    detail: String(event.towerType || event.laneType || "").replace(/_/g, " ") || "Tour détruite",
  }));
  return [...objectives, ...fights, ...towers].sort((a, b) => Number(a.timestamp || 0) - Number(b.timestamp || 0)).slice(0, 18);
}

function MatchTimelineReview({ match }) {
  const status = timelineStatus(match);
  const objectives = objectiveContext(match);
  const kills = championKillEvents(match);
  const fights = fightWindows(match);
  const events = timelineMilestones(match);
  const ally = teamRows(match, "ALLY");
  const enemy = teamRows(match, "ENEMY");
  const finalGoldDiff = sumRows(ally, "gold") - sumRows(enemy, "gold");
  const allyObjectives = objectives.filter((event) => event.teamKey === "ALLY").length;
  const enemyObjectives = objectives.filter((event) => event.teamKey === "ENEMY").length;
  const allyFights = fights.filter((event) => event.teamKey === "ALLY").length;
  const enemyFights = fights.filter((event) => event.teamKey === "ENEMY").length;
  const goldMarks = [10, 15, 20].map((minute) => {
    const allyGold = teamGoldAtMinute(match, "ALLY", minute);
    const enemyGold = teamGoldAtMinute(match, "ENEMY", minute);
    return { minute, diff: Number.isFinite(allyGold) && Number.isFinite(enemyGold) ? allyGold - enemyGold : null };
  });
  const phases = [
    { id: "early", label: "Early", range: "0-14", toneName: "cyan" },
    { id: "mid", label: "Mid game", range: "14-24", toneName: "purple" },
    { id: "late", label: "Late", range: "24+", toneName: "yellow" },
  ].map((phase) => ({ ...phase, events: events.filter((event) => timelinePhaseMeta(event.timestamp).id === phase.id) }));
  const highlight = events.find((event) => event.teamKey === "ENEMY" && ["objective", "fight"].includes(event.kind)) || events.find((event) => event.teamKey === "ALLY" && ["objective", "fight"].includes(event.kind)) || events[0];
  return <div className="mt-4 overflow-hidden rounded-[1.35rem] border border-cyan-300/14 bg-gradient-to-br from-cyan-400/[0.055] via-black/24 to-fuchsia-400/[0.045]">
    <div className="border-b border-white/10 bg-black/18 p-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2"><Badge tone="cyan">Déroulé coach</Badge><Badge tone={status.toneName}>{status.label}</Badge><Badge tone="purple">{kills.length} kills</Badge><Badge tone="slate">{events.length} moments</Badge></div>
          <h4 className="mt-3 text-2xl font-black text-white">Lecture chronologique</h4>
          <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-slate-300">{highlight ? `${highlight.time} · ${timelineTeamLabel(highlight.teamKey)} · ${highlight.title}` : "Aucun moment clé détecté dans la timeline importée."}</p>
        </div>
        <div className="grid w-full gap-2 sm:grid-cols-3 xl:w-[34rem]">
          {goldMarks.map((item) => <TimelineGoldCheckpoint key={item.minute} minute={item.minute} diff={item.diff} />)}
        </div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <TimelineReadoutCard icon={Gauge} label="Économie finale" value={formatSignedShort(finalGoldDiff)} detail={finalGoldDiff >= 0 ? "Avantage NXT5" : "Avantage adverse"} toneName={diffTone(finalGoldDiff)} />
        <TimelineReadoutCard icon={Target} label="Objectifs neutres" value={`${allyObjectives}-${enemyObjectives}`} detail="NXT5 - Adversaire" toneName={allyObjectives >= enemyObjectives ? "cyan" : "red"} />
        <TimelineReadoutCard icon={Swords} label="Fights détectés" value={`${allyFights}-${enemyFights}`} detail="Fenêtres multi-kills" toneName={allyFights >= enemyFights ? "green" : "red"} />
      </div>
    </div>
    {events.length ? <div className="grid gap-3 p-4 xl:grid-cols-3">
      {phases.map((phase) => <TimelinePhaseColumn key={phase.id} phase={phase} kills={kills} match={match} />)}
    </div> : <p className="m-4 rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm font-semibold text-slate-300">Aucun déroulé exploitable dans ce JSON pour les moments clés.</p>}
  </div>;
}

function TimelineGoldCheckpoint({ minute, diff }) {
  const missing = diff === null;
  return <div className={cx("rounded-2xl border px-3 py-2", missing ? tone("slate") : tone(diffTone(diff)))}>
    <p className="text-[0.58rem] font-black uppercase tracking-[0.16em] opacity-80">{minute} min</p>
    <p className="mt-1 text-lg font-black leading-none text-white">{missing ? "N/A" : formatSignedShort(diff)}</p>
    <p className="mt-1 truncate text-[0.62rem] font-semibold opacity-75">écart or</p>
  </div>;
}

function TimelineReadoutCard({ icon: Icon, label, value, detail, toneName }) {
  return <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.035] p-3">
    <div className="flex items-center justify-between gap-3">
      <p className="truncate text-[0.62rem] font-black uppercase tracking-[0.16em] text-slate-300">{label}</p>
      <div className={cx("rounded-xl border p-2", tone(toneName))}><Icon className="h-4 w-4" /></div>
    </div>
    <p className="mt-2 truncate text-2xl font-black text-white">{value}</p>
    <p className="truncate text-xs font-semibold text-slate-300">{detail}</p>
  </div>;
}

function TimelineEventGlyph({ event }) {
  if (event.kind === "objective") return <ObjectivePictogram type={objectivePictogramType(event)} fallback={objectiveEventIcon(event)} className="h-8 w-8" />;
  if (event.kind === "fight") return <Swords className="h-4 w-4" />;
  return <Shield className="h-4 w-4" />;
}

function TimelineEventCard({ event, index, kills, match }) {
  const toneName = event.toneName || timelineTeamTone(event.teamKey);
  const score = killScoreAtTimestamp(kills, event.timestamp);
  const gold = timelineGoldDiff(match, event.timestamp);
  const enemy = event.teamKey === "ENEMY";
  const neutral = event.teamKey === "NEUTRAL";
  const frame = neutral ? "border-amber-200/18 bg-amber-300/[0.055]" : enemy ? "border-rose-300/18 bg-rose-500/[0.055]" : "border-cyan-300/18 bg-cyan-400/[0.055]";
  const rail = neutral ? "bg-amber-200" : enemy ? "bg-rose-200" : "bg-cyan-200";
  const kindLabel = event.kind === "objective" ? "Objectif" : event.kind === "fight" ? "Fight" : "Structure";
  return <article className={cx("relative overflow-hidden rounded-2xl border p-3", frame)}>
    <div className={cx("absolute inset-y-3 left-0 w-1 rounded-r-full shadow-[0_0_14px_currentColor]", rail)} />
    <div className="flex items-start gap-3 pl-1">
      <div className={cx("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border", tone(toneName))}><TimelineEventGlyph event={event} /></div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={toneName}>{event.time}</Badge>
          <Badge tone="slate">#{index + 1}</Badge>
          <Badge tone={toneName}>{timelineTeamLabel(event.teamKey)}</Badge>
        </div>
        <p className="mt-2 truncate text-sm font-black text-white">{event.title}</p>
        <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-slate-300">{event.context || event.detail || kindLabel}</p>
        {event.detail && event.detail !== event.context && <p className="mt-1 line-clamp-1 text-[0.66rem] font-semibold text-slate-400">{event.detail}</p>}
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          <span className="min-w-0 rounded-lg border border-white/10 bg-black/24 px-2 py-1"><span className="block text-[0.52rem] font-black uppercase tracking-[0.1em] text-slate-400">Kills</span><span className="text-xs font-black text-white">{score.ally}-{score.enemy}</span></span>
          <span className="min-w-0 rounded-lg border border-white/10 bg-black/24 px-2 py-1"><span className="block text-[0.52rem] font-black uppercase tracking-[0.1em] text-slate-400">Gold</span><span className={cx("text-xs font-black", gold === null ? "text-slate-300" : gold >= 0 ? "text-emerald-100" : "text-rose-100")}>{gold === null ? "N/A" : formatSignedShort(gold)}</span></span>
          <span className="min-w-0 rounded-lg border border-white/10 bg-black/24 px-2 py-1"><span className="block text-[0.52rem] font-black uppercase tracking-[0.1em] text-slate-400">Type</span><span className="truncate text-xs font-black text-white">{kindLabel}</span></span>
        </div>
      </div>
    </div>
  </article>;
}

function TimelinePhaseColumn({ phase, kills, match }) {
  return <section className="min-w-0 rounded-2xl border border-white/10 bg-black/18 p-3">
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-black text-white">{phase.label}</p>
        <p className="mt-0.5 text-[0.62rem] font-black uppercase tracking-[0.16em] text-slate-400">{phase.range} min</p>
      </div>
      <Badge tone={phase.toneName}>{phase.events.length}</Badge>
    </div>
    <div className="space-y-2">
      {phase.events.length ? phase.events.map((event, index) => <TimelineEventCard key={`${phase.id}-${event.kind}-${event.timestamp}-${index}`} event={event} index={index} kills={kills} match={match} />) : <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.025] p-4 text-sm font-semibold leading-6 text-slate-400">Aucun moment majeur détecté.</div>}
    </div>
  </section>;
}

function RoleDiffPanel({ match }) {
  const rows = roleDiffRows(match);
  return <div className="mt-4 rounded-[1.25rem] bg-black/12 p-2 ring-1 ring-white/[0.045]"><div className="grid gap-1.5 lg:grid-cols-5">{rows.map((item) => <div key={item.role} className="rounded-xl bg-white/[0.03] p-3"><div className="flex items-center justify-between gap-2"><Badge tone={diffTone(item.goldDiff)}>{roleLabel(item.role)}</Badge><span className={cx("text-xs font-black", item.goldDiff >= 0 ? "text-emerald-200" : "text-rose-200")}>{formatGoldDiff(item.goldDiff)}</span></div><p className="mt-2 truncate text-xs font-semibold text-slate-300">CS10 {item.cs10Diff === null ? "N/A" : `${item.cs10Diff >= 0 ? "+" : ""}${item.cs10Diff}`} · Dégâts {(item.damageDiff >= 0 ? "+" : "") + formatPoints(item.damageDiff)}</p><p className="mt-1 truncate text-xs font-semibold text-slate-400">Écart morts {item.deathsDiff >= 0 ? "+" : ""}{item.deathsDiff}</p></div>)}</div></div>;
}

function DeathContextPanel({ match }) {
  const data = deathContext(match);
  const topRepeated = data.repeated[0];
  const cards = [
    [AlertTriangle, "Avant objectif", data.beforeObjectives.length, "Mort < 90s avant objectif", data.beforeObjectives.length ? "red" : "green"],
    [Shield, "Isolées déduites", data.isolated.length, "Sans trade proche détecté", data.isolated.length ? "yellow" : "green"],
    [Flame, "Shutdowns donnés", data.shutdowns.length, "Bounty timeline", data.shutdowns.length ? "red" : "slate"],
    [Target, "Focus deaths", topRepeated?.deaths || 0, topRepeated ? `${topRepeated.name} · ${championDisplayName(topRepeated.champion)}` : "Aucun profil exposé", topRepeated?.deaths >= 5 ? "red" : "cyan"],
  ];
  return <div className="mt-4 rounded-[1.25rem] bg-black/12 p-2 ring-1 ring-white/[0.045]"><div className="grid gap-1.5 md:grid-cols-2 xl:grid-cols-4">{cards.map(([Icon, label, value, detail, t]) => <div key={label} className="rounded-xl bg-white/[0.03] p-3"><div className="flex items-center justify-between gap-3"><p className="text-[0.6rem] font-black uppercase tracking-[0.16em] text-slate-300">{label}</p><div className={cx("rounded-xl p-2", tone(t))}><Icon className="h-4 w-4" /></div></div><p className="mt-2 text-xl font-black text-white">{value}</p><p className="truncate text-xs font-semibold text-slate-300">{detail}</p></div>)}</div>{data.beforeObjectives.length > 0 && <div className="mt-2 grid gap-1.5 xl:grid-cols-2">{data.beforeObjectives.slice(0, 4).map((death, index) => <div key={`${death.timestamp}-${index}`} className="rounded-xl border border-rose-300/12 bg-rose-500/[0.045] px-3 py-2 text-xs font-semibold text-slate-200"><span className="font-black text-white">{death.time}</span> · {death.victim?.summoner_name || death.victim?.riot_id || "Joueur"} meurt avant objectif</div>)}</div>}</div>;
}

function DraftImpactPanel({ match }) {
  const ally = teamRows(match, "ALLY");
  const identity = compositionIdentity(ally);
  const physical = ally.reduce((total, row) => total + Number(row.raw?.physicalDamageDealtToChampions || 0), 0);
  const magic = ally.reduce((total, row) => total + Number(row.raw?.magicDamageDealtToChampions || 0), 0);
  const trueDamage = ally.reduce((total, row) => total + Number(row.raw?.trueDamageDealtToChampions || 0), 0);
  const total = Math.max(1, physical + magic + trueDamage);
  const apRatio = Math.round((magic / total) * 100);
  const adRatio = Math.round((physical / total) * 100);
  const tags = identity.tags.slice(0, 4);
  const warnings = [
    Math.abs(apRatio - adRatio) >= 45 && `Dégâts ${apRatio > adRatio ? "AP" : "AD"} très dominants.`,
    !tags.some(([tag]) => ["frontline", "tank"].includes(tag)) && "Première ligne peu visible dans la draft.",
    !tags.some(([tag]) => ["engage", "pick"].includes(tag)) && "Initiation ou catch à confirmer.",
  ].filter(Boolean);
  return <div className="mt-4 rounded-[1.35rem] border border-fuchsia-300/14 bg-fuchsia-400/[0.045] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><Badge tone={championStyleTone(identity.primary)}>Lecture draft</Badge><h4 className="mt-3 text-xl font-black text-white">{tagLabel(identity.primary)}</h4><p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-slate-300">{identity.text}</p></div><div className="flex flex-wrap gap-2"><Badge tone="cyan">Magique {apRatio}%</Badge><Badge tone="yellow">Physique {adRatio}%</Badge><Badge tone="slate">Brut {Math.round((trueDamage / total) * 100)}%</Badge></div></div><div className="mt-4 flex flex-wrap gap-2">{tags.length ? tags.map(([tag, count]) => <Badge key={tag} tone={championStyleTone(tag)}>{tagLabel(tag)} x{count}</Badge>) : <Badge tone="slate">Tags insuffisants</Badge>}{warnings.map((warning) => <Badge key={warning} tone="yellow">{warning}</Badge>)}</div></div>;
}

function GameSummaryPanel({ match }) {
  const deaths = deathContext(match);
  const objectives = objectiveContext(match);
  const ally = teamRows(match, "ALLY");
  const enemy = teamRows(match, "ENEMY");
  const goldDiff = sumRows(ally, "gold") - sumRows(enemy, "gold");
  const damageLeader = ally.slice().sort((a, b) => statValue(b, "damage") - statValue(a, "damage"))[0];
  const weakRole = roleDiffRows(match).slice().sort((a, b) => a.goldDiff - b.goldDiff)[0];
  const firstObjectiveIssue = objectives.find((event) => event.teamKey === "ENEMY" && event.alliedDeathBefore);
  const lines = [
    firstObjectiveIssue ? `Moment à revoir: ${firstObjectiveIssue.time}, ${firstObjectiveIssue.label} adverse après une mort alliée.` : `Économie finale: ${formatGoldDiff(goldDiff)} or, ${goldDiff >= 0 ? "avantage exploitable" : "retard à expliquer"}.`,
    damageLeader ? `Plus gros impact dégâts sur cette game: ${damageLeader.summoner_name || damageLeader.riot_id || roleLabel(damageLeader.role)} avec ${formatPoints(damageLeader.damage)} sur ${championDisplayName(damageLeader.champion)}.` : "Impact dégâts: données joueurs insuffisantes.",
    weakRole ? `Écart de game à revoir: ${roleLabel(weakRole.role)} (${formatGoldDiff(weakRole.goldDiff)} or face au rôle adverse, ${deaths.beforeObjectives.length} mort${deaths.beforeObjectives.length > 1 ? "s" : ""} avant objectif côté équipe).` : "Écart de game: confirmer les rôles importés.",
  ];
  return <div className="mt-4 rounded-[1.35rem] border border-emerald-300/14 bg-emerald-400/[0.05] p-4"><div className="flex flex-wrap items-center gap-2"><Badge tone="green">Résumé game</Badge><Badge tone={timelineStatus(match).toneName}>{timelineStatus(match).label}</Badge></div><div className="mt-3 grid gap-2 xl:grid-cols-3">{lines.map((line, index) => <div key={line} className="rounded-2xl border border-white/10 bg-black/22 p-3"><p className="text-[0.6rem] font-black uppercase tracking-[0.16em] text-emerald-100">Point {index + 1}</p><p className="mt-2 text-sm font-semibold leading-5 text-white">{line}</p></div>)}</div></div>;
}

function GameMetricSignals({ match }) {
  const ally = teamRows(match, "ALLY");
  const enemy = teamRows(match, "ENEMY");
  const strongest = ally.slice().sort((a, b) => roleScore(b) - roleScore(a))[0];
  const exposed = ally.slice().sort((a, b) => statValue(b, "deaths") - statValue(a, "deaths"))[0];
  const damageLead = ally.slice().sort((a, b) => statValue(b, "damage") - statValue(a, "damage"))[0];
  const visionLead = ally.slice().sort((a, b) => statValue(b, "vision") - statValue(a, "vision"))[0];
  const csDiff = sumRows(ally, "cs") - sumRows(enemy, "cs");
  const deaths = sumRows(ally, "deaths");
  const enemyDeaths = sumRows(enemy, "deaths");
	  const cards = [
	    [Crown, "Meilleure game", strongest, strongest ? `${championDisplayName(strongest.champion)} · ${strongest.kda}` : "Aucune donnée", "cyan"],
	    [AlertTriangle, "Morts", exposed, exposed ? `${exposed.deaths || 0} morts · ${championDisplayName(exposed.champion)}` : "Aucune donnée", exposed?.deaths >= 6 ? "red" : "yellow"],
	    [Flame, "Dégâts", damageLead, damageLead ? formatPoints(damageLead.damage) + " dégâts" : "Aucune donnée", "purple"],
	    [Eye, "Vision", visionLead, visionLead ? `${visionLead.vision || 0} vision` : "Aucune donnée", "green"],
	  ];
	  const comparisonCards = [
	    [Gauge, "Écart CS", (csDiff >= 0 ? "+" : "") + formatPoints(csDiff), "Alliés vs adversaires", diffTone(csDiff)],
	    [Swords, "Morts équipe", `${deaths} / ${enemyDeaths}`, "Alliés vs adversaires", deaths <= enemyDeaths ? "green" : "red"],
	  ];
	  return <div className="mt-4 rounded-[1.25rem] bg-black/12 p-2 ring-1 ring-white/[0.045]">
	    <div className="grid gap-1.5 md:grid-cols-2 xl:grid-cols-4">{cards.map(([Icon, label, row, detail, t]) => <div key={label} className="min-w-0 rounded-xl bg-white/[0.03] p-3"><div className="flex min-w-0 items-center gap-3"><div className={cx("shrink-0 rounded-xl p-2", tone(t))}><Icon className="h-4 w-4" /></div><div className="min-w-0"><p className="text-[0.6rem] font-black uppercase tracking-[0.16em] text-slate-300">{label}</p><p className="mt-1 truncate text-sm font-black text-white">{row?.summoner_name || row?.riot_id || "N/A"}</p><p className="truncate text-xs font-semibold text-slate-300">{detail}</p></div></div></div>)}</div>
	    <div className="mt-1.5 grid gap-1.5 md:grid-cols-2">{comparisonCards.map(([Icon, label, value, detail, t]) => <div key={label} className="min-w-0 rounded-xl bg-white/[0.03] p-3"><div className="flex min-w-0 items-center gap-3"><div className={cx("shrink-0 rounded-xl p-2", tone(t))}><Icon className="h-4 w-4" /></div><div className="min-w-0"><p className="text-[0.6rem] font-black uppercase tracking-[0.16em] text-slate-300">{label}</p><p className="mt-1 truncate text-sm font-black text-white">{value}</p><p className="truncate text-xs font-semibold text-slate-300">{detail}</p></div></div></div>)}</div>
	  </div>;
	}

function VersusPlayerMini({ row, side, opponent, align = "left" }) {
  const ahead = row && opponent ? statValue(row, "gold") >= statValue(opponent, "gold") : false;
  const kda = row ? `${row.kills || 0}/${row.deaths || 0}/${row.assists || 0}` : "-/-/-";
  const kp = row ? Math.round(parsePercent(row.kill_participation || row.kp)) : 0;
  const spells = row ? summonerSpellIds(row) : [];
  const trinket = row ? trinketItemId(row) : 0;
  const items = row ? [
    ...itemSlots(row).filter(Boolean).map((id) => ({ id, type: "item" })),
    ...(trinket ? [{ id: trinket, type: "trinket" }] : []),
  ] : [];
  return <div className={cx("relative min-w-0 overflow-hidden rounded-2xl border p-2.5", side === "ALLY" ? "border-cyan-300/18 bg-cyan-400/[0.055]" : "border-rose-300/18 bg-rose-500/[0.055]", ahead && "shadow-[0_0_24px_rgba(34,211,238,.10)]")}>
    {row && <ChampionBackdrop champion={row.champion} focus="face" />}
    <div className="absolute inset-0 bg-gradient-to-r from-[#050711]/94 via-[#050711]/78 to-[#050711]/48" />
    <div className={cx("relative z-10 flex min-w-0 items-center gap-2.5", align === "right" && "flex-row-reverse text-right")}>
      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black/35 md:h-14 md:w-14">
        {row ? <ChampionPortrait row={row} champion={row.champion} alt={row.champion} /> : <Crown className="m-3 h-6 w-6 text-slate-300" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-black text-white">{row?.summoner_name || row?.riot_id || "Inconnu"}</p>
        <p className="truncate text-xs font-semibold text-slate-200">{row ? championDisplayName(row.champion) : "Champion ?"}</p>
        <div className={cx("mt-2 flex flex-wrap gap-1.5", align === "right" && "justify-end")}>
          <span className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-[0.62rem] font-black text-white">{kda}</span>
          <span className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-[0.62rem] font-black text-slate-200">{kp}% KP</span>
          <span className="rounded-lg border border-emerald-200/15 bg-emerald-300/10 px-2 py-1 text-[0.62rem] font-black text-emerald-50">{creepScore(row)} CS</span>
          <span className="hidden rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-[0.62rem] font-black text-slate-200 sm:inline-flex">{formatPoints(row?.damage || 0)} dégâts</span>
          <span className="hidden rounded-lg border border-yellow-200/15 bg-yellow-300/10 px-2 py-1 text-[0.62rem] font-black text-yellow-50 md:inline-flex">{formatPoints(row?.gold || 0)} or</span>
          <span className="hidden rounded-lg border border-cyan-200/15 bg-cyan-300/10 px-2 py-1 text-[0.62rem] font-black text-cyan-50 lg:inline-flex">{row?.vision || 0} VIS</span>
        </div>
        {(spells.length > 0 || items.length > 0) && <div className={cx("mt-2 flex flex-wrap gap-1", align === "right" && "justify-end")}>
          {spells.map((spell, index) => <HudIcon key={`${row.id || row.riot_id}-instant-spell-${index}-${spell}`} sources={summonerSpellIconSources(spell)} label={`Sort ${spell}`} fallback={spell} emptyText="S" className="h-6 w-6 rounded-lg" />)}
          {items.map((item, index) => <HudIcon key={`${row.id || row.riot_id}-instant-item-${index}-${item.id}`} sources={itemIconSources(item.id)} label={item.type === "trinket" ? `Ward ${item.id}` : `Objet ${item.id}`} fallback={item.id} emptyText="-" toneName={item.type === "trinket" ? "pink" : "cyan"} className="h-6 w-6 rounded-lg" />)}
        </div>}
      </div>
    </div>
  </div>;
}

function LaneComparisonPanel({ match, role, allyRow, enemyRow, teamName }) {
  const ally = teamRows(match, "ALLY");
  const enemy = teamRows(match, "ENEMY");
  const blueTeamKey = objectiveTeamKeyForSide(match, "BLUE");
  const redTeamKey = objectiveTeamKeyForSide(match, "RED");
  const blueTeam = blueTeamKey === "ALLY" ? ally : enemy;
  const redTeam = redTeamKey === "ALLY" ? ally : enemy;
  const blueRow = blueTeamKey === "ALLY" ? allyRow : enemyRow;
  const redRow = redTeamKey === "ALLY" ? allyRow : enemyRow;
  const blueCs10 = blueRow ? csAtMinute({ ...blueRow, match }, 10) : null;
  const redCs10 = redRow ? csAtMinute({ ...redRow, match }, 10) : null;
  const blueCs20 = blueRow ? csAtMinute({ ...blueRow, match }, 20) : null;
  const redCs20 = redRow ? csAtMinute({ ...redRow, match }, 20) : null;
  const metricRows = [
    ["KDA", blueRow ? `${blueRow.kills || 0}/${blueRow.deaths || 0}/${blueRow.assists || 0}` : "-", redRow ? `${redRow.kills || 0}/${redRow.deaths || 0}/${redRow.assists || 0}` : "-", null],
    ["KP", blueRow ? `${Math.round(parsePercent(blueRow.kill_participation || blueRow.kp))}%` : "-", redRow ? `${Math.round(parsePercent(redRow.kill_participation || redRow.kp))}%` : "-", parsePercent(blueRow?.kill_participation || blueRow?.kp) - parsePercent(redRow?.kill_participation || redRow?.kp)],
    ["Or", formatPoints(statValue(blueRow, "gold")), formatPoints(statValue(redRow, "gold")), statValue(blueRow, "gold") - statValue(redRow, "gold")],
    ["Dégâts", formatPoints(statValue(blueRow, "damage")), formatPoints(statValue(redRow, "damage")), statValue(blueRow, "damage") - statValue(redRow, "damage")],
    ["CS", String(creepScore(blueRow)), String(creepScore(redRow)), creepScore(blueRow) - creepScore(redRow)],
    ["CS 10", blueCs10 ?? "N/A", redCs10 ?? "N/A", Number.isFinite(blueCs10) && Number.isFinite(redCs10) ? blueCs10 - redCs10 : null],
    ["CS 20", blueCs20 ?? "N/A", redCs20 ?? "N/A", Number.isFinite(blueCs20) && Number.isFinite(redCs20) ? blueCs20 - redCs20 : null],
    ["Vision", String(statValue(blueRow, "vision")), String(statValue(redRow, "vision")), statValue(blueRow, "vision") - statValue(redRow, "vision")],
    ["Morts", String(statValue(blueRow, "deaths")), String(statValue(redRow, "deaths")), statValue(redRow, "deaths") - statValue(blueRow, "deaths")],
  ];
  const shareRows = [
    ["Part des dégâts", shareOfTeam(blueRow, blueTeam, "damage"), shareOfTeam(redRow, redTeam, "damage"), "higher"],
    ["Part de l'or", shareOfTeam(blueRow, blueTeam, "gold"), shareOfTeam(redRow, redTeam, "gold"), "higher"],
    ["Part vision", shareOfTeam(blueRow, blueTeam, "vision"), shareOfTeam(redRow, redTeam, "vision"), "higher"],
    ["Part des morts", shareOfTeam(blueRow, blueTeam, "deaths"), shareOfTeam(redRow, redTeam, "deaths"), "lower"],
  ];
  const teamBadge = (teamKey) => teamKey === "ALLY" ? String(teamName || "Notre équipe").trim() : "En face";
  const formatSideDiff = (diff) => {
    if (diff === null) return "-";
    const value = Number.isInteger(diff) ? String(diff) : diff.toFixed(1);
    if (!diff) return "· 0";
    return diff > 0 ? `< +${value}` : `${value} >`;
  };
  const renderLoadout = (row, side, teamKey, align = "left") => {
    const spells = row ? summonerSpellIds(row) : [];
    const trinket = row ? trinketItemId(row) : 0;
    const items = row ? [...itemSlots(row).filter(Boolean).map((id) => ({ id, type: "item" })), ...(trinket ? [{ id: trinket, type: "trinket" }] : [])] : [];
    const isBlue = side === "blue";
    return <div className={cx("rounded-2xl border p-3", isBlue ? "border-cyan-300/14 bg-cyan-400/[0.055]" : "border-rose-300/14 bg-rose-500/[0.055]")}>
      <div className={cx("mb-3 flex flex-wrap items-center gap-2", align === "right" && "justify-end")}><Badge tone={isBlue ? "cyan" : "red"}>{isBlue ? "Côté bleu" : "Côté rouge"}</Badge><Badge tone={teamKey === "ALLY" ? "green" : "slate"}><span className="block max-w-48 truncate" title={teamBadge(teamKey)}>{teamBadge(teamKey)}</span></Badge></div>
      <div className={cx("flex min-w-0 items-center gap-3", align === "right" && "justify-end text-right")}>
        <ChampionPortrait row={row} champion={row?.champion} alt={row?.champion || role} className="h-12 w-12 rounded-xl object-cover" />
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-white">{row?.summoner_name || row?.riot_id || "Inconnu"}</p>
          <p className="truncate text-xs font-semibold text-slate-300">{row ? championDisplayName(row.champion) : "Champion ?"}</p>
        </div>
      </div>
      <div className={cx("mt-3 flex flex-wrap gap-1.5", align === "right" && "justify-end")}>
        {spells.map((spell, index) => <HudIcon key={`${side}-${role}-spell-${index}-${spell}`} sources={summonerSpellIconSources(spell)} label={`Sort ${spell}`} fallback={spell} emptyText="S" className="h-8 w-8 rounded-lg" />)}
        {items.map((item, index) => <HudIcon key={`${side}-${role}-item-${index}-${item.id}`} sources={itemIconSources(item.id)} label={item.type === "trinket" ? `Ward ${item.id}` : `Objet ${item.id}`} fallback={item.id} emptyText="-" toneName={item.type === "trinket" ? "pink" : "cyan"} className="h-8 w-8 rounded-lg" />)}
      </div>
    </div>;
  };
  return <div className="nxt5-enter-fast rounded-[1.35rem] border border-white/10 bg-black/28 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,.06)]">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2"><Badge tone="cyan">{roleLabel(role)}</Badge><h5 className="text-base font-black text-white">Comparatif direct de la game</h5></div>
      <Badge tone="slate">Clique la ligne pour refermer</Badge>
    </div>
    <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,.58fr)_minmax(0,1fr)_minmax(0,.58fr)]">
      {renderLoadout(blueRow, "blue", blueTeamKey)}
      <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
        <div className="grid grid-cols-[minmax(86px,.7fr)_minmax(0,1fr)_minmax(72px,.55fr)_minmax(0,1fr)] gap-2 text-xs">
          <p className="font-black uppercase tracking-[0.14em] text-slate-400">Stat</p>
          <p className="font-black uppercase tracking-[0.14em] text-cyan-100">Côté bleu</p>
          <p className="text-center font-black uppercase tracking-[0.14em] text-slate-400">Écart</p>
          <p className="text-right font-black uppercase tracking-[0.14em] text-rose-100">Côté rouge</p>
          {metricRows.map(([label, left, right, diff]) => {
            const cleanDiff = Number.isFinite(Number(diff)) ? Number(diff) : null;
            return <React.Fragment key={label}>
              <p className="rounded-lg bg-black/18 px-2 py-1.5 font-black text-slate-300">{label}</p>
              <p className="truncate rounded-lg bg-cyan-400/[0.06] px-2 py-1.5 font-black text-white">{left}</p>
              <p className={cx("rounded-lg px-2 py-1.5 text-center font-black", cleanDiff === null ? "bg-black/18 text-slate-400" : cleanDiff >= 0 ? "bg-cyan-400/10 text-cyan-100" : "bg-rose-500/10 text-rose-100")}>{formatSideDiff(cleanDiff)}</p>
              <p className="truncate rounded-lg bg-rose-500/[0.06] px-2 py-1.5 text-right font-black text-white">{right}</p>
            </React.Fragment>;
          })}
        </div>
      </div>
      {renderLoadout(redRow, "red", redTeamKey, "right")}
    </div>
    <div className="mt-3 grid gap-2 md:grid-cols-4">{shareRows.map(([label, left, right, direction]) => {
      const diff = Number(left || 0) - Number(right || 0);
      const blueWins = direction === "lower" ? diff < 0 : diff > 0;
      const leader = !diff ? "Égal" : blueWins ? "Côté bleu" : "Côté rouge";
      return <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3"><p className="text-[0.6rem] font-black uppercase tracking-[0.16em] text-slate-300">{label}</p><p className="mt-2 text-sm font-black text-white">{Number(left || 0).toFixed(1)}% / {Number(right || 0).toFixed(1)}%</p><p className={cx("mt-1 text-xs font-black", !diff ? "text-slate-300" : blueWins ? "text-cyan-200" : "text-rose-200")}>{leader}</p></div>;
    })}</div>
  </div>;
}

function SideColumnHeader({ side, align = "left" }) {
  const isBlue = side === "blue";
  const Icon = isBlue ? Shield : Swords;
  return <div className={cx("flex items-center gap-2 rounded-2xl border px-3 py-2", isBlue ? "border-cyan-300/22 bg-cyan-400/[0.075] text-cyan-100" : "border-rose-300/22 bg-rose-500/[0.075] text-rose-100", align === "right" && "justify-end")}>
    <span className={cx("flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border bg-black/25", isBlue ? "border-cyan-200/30" : "border-rose-200/30")}>
      <Icon className="h-4 w-4" />
    </span>
    <span className="text-[0.66rem] font-black uppercase tracking-[0.18em] text-white">{isBlue ? "Côté bleu" : "Côté rouge"}</span>
  </div>;
}

function MatchVersusOverview({ match, teamName }) {
  const [openRole, setOpenRole] = useState("");
  const ally = teamRows(match, "ALLY");
  const enemy = teamRows(match, "ENEMY");
  const byRole = (rows, role) => rows.find((row) => String(row.role || "").toUpperCase() === role) || null;
  const allyIsBlue = String(match?.side || "").toLowerCase().includes("blue");
  const blueRows = allyIsBlue ? ally : enemy;
  const redRows = allyIsBlue ? enemy : ally;
  const blueKey = allyIsBlue ? "ALLY" : "ENEMY";
  const redKey = allyIsBlue ? "ENEMY" : "ALLY";
  return <div className="mt-5 rounded-[1.5rem] border border-cyan-300/14 bg-gradient-to-br from-cyan-400/[0.07] via-black/25 to-rose-500/[0.055] p-3 sm:p-4">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <div><Badge tone="cyan">Vue 5v5</Badge><h4 className="mt-2 text-xl font-black text-white">Résumé de la game</h4></div>
    </div>
    <ObjectiveHud match={match} compact />
    <div className="nxt5-responsive-scroll">
      <div className="nxt5-versus-scroll-frame min-w-[860px] lg:min-w-0">
        <div className="nxt5-versus-row-grid mb-2 grid min-w-0 items-center gap-2">
          <SideColumnHeader side="blue" />
          <div />
          <SideColumnHeader side="red" align="right" />
        </div>
        <div className="grid gap-2">
          {COMP_ROLES.map((role) => {
            const blueRow = byRole(blueRows, role);
            const redRow = byRole(redRows, role);
            const allyRow = byRole(ally, role);
            const enemyRow = byRole(enemy, role);
            const blueGold = blueRow ? statValue(blueRow, "gold") : 0;
            const redGold = redRow ? statValue(redRow, "gold") : 0;
            const diff = (blueKey === "ALLY" ? blueGold - redGold : redGold - blueGold);
            const winningEdge = blueGold === redGold ? "·" : blueGold > redGold ? "<" : ">";
            const open = openRole === role;
            return <div key={role} className={cx("rounded-[1.35rem] transition", open && "bg-cyan-400/[0.045] p-1 ring-1 ring-cyan-200/18")}>
              <button type="button" aria-expanded={open} onClick={() => setOpenRole(open ? "" : role)} className="nxt5-versus-row-grid grid w-full min-w-0 items-stretch gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/60">
                <VersusPlayerMini row={blueRow} side={blueKey} opponent={redRow} align="left" />
                <div className={cx("flex flex-col items-center justify-center rounded-2xl border px-1.5 py-2 text-center transition", open ? "border-cyan-200/40 bg-cyan-400/14 shadow-[0_0_22px_rgba(34,211,238,.12)]" : "border-white/10 bg-black/35")}>
                  <RoleIcon role={role} className="h-5 w-5" />
                  <span className="mt-1 text-[0.58rem] font-black uppercase tracking-[0.08em] text-white">{role}</span>
                  <span className={cx("nxt5-versus-gold-diff mt-1 rounded-lg px-2 py-1 text-[0.62rem] font-black", diff >= 0 ? "bg-emerald-400/12 text-emerald-100" : "bg-rose-500/12 text-rose-100")}>{winningEdge} {formatCompactGoldDiff(diff)}</span>
                  <ChevronDown className={cx("mt-1 h-3.5 w-3.5 text-cyan-100 transition", open && "rotate-180")} />
                </div>
                <VersusPlayerMini row={redRow} side={redKey} opponent={blueRow} align="right" />
              </button>
              <React.Fragment>{open && <div className="mt-2"><LaneComparisonPanel match={match} role={role} allyRow={allyRow} enemyRow={enemyRow} teamName={teamName} /></div>}</React.Fragment>
            </div>;
          })}
        </div>
      </div>
    </div>
  </div>;
}

function teamObjectiveScore(summary = {}) {
  return Number(summary.dragonCount || 0) + Number(summary.grubs || 0) + Number(summary.heralds || 0) + Number(summary.barons || 0) + Number(summary.towers || 0);
}

function playerReviewName(row) {
  return row?.player_name || row?.summoner_name || row?.riot_id || championDisplayName(row?.champion) || roleLabel(row?.role) || "Joueur";
}

function playerSideTimings(match, role) {
  const objectives = objectiveEvents(match);
  const firstDragon = objectives.find((event) => objectiveEventType(event) === "dragon");
  const firstTopObjective = objectives.find((event) => ["grub", "herald"].includes(objectiveEventType(event)));
  const timingWindow = (event, fallback) => event
    ? `${formatCountdown(Math.floor(Math.max(0, Number(event.timestamp || 0) - 90000) / 1000))} → ${event.time}`
    : fallback;
  const dragonWindow = timingWindow(firstDragon, "T-90 avant le prochain dragon");
  const topWindow = timingWindow(firstTopObjective, "T-90 avant les Grubs/Herald");
  const key = normalizeProfileRole(role);
  if (key === "TOP") return {
    weakside: `${dragonWindow} si le plan engage bot : sécuriser la wave, garder la sortie et ne pas contester sans couverture.`,
    strongside: `${topWindow} quand l'équipe joue top : préparer le crash, conserver les ressources et demander le move jungle/support.`,
  };
  if (key === "ADC" || key === "SUP") return {
    weakside: `${topWindow} si jungle et mid jouent le haut de carte : refuser la pression, protéger la wave et signaler le dive avant qu'il commence.`,
    strongside: `${dragonWindow} quand le dragon est la priorité : crash, reset synchronisé puis contrôle de rivière avant le contact.`,
  };
  if (key === "MID") return {
    weakside: `Pendant la fenêtre opposée au prochain objectif si la prio est perdue : absorber la wave sans forcer le move en retard.`,
    strongside: `${firstDragon ? dragonWindow : topWindow} avec prio : pousser, disparaître de la vision puis créer le surnombre sur le side choisi.`,
  };
  if (key === "JGL") return {
    weakside: `Le side opposé à l'objectif annoncé à T-90 : prévenir qu'il n'y aura pas de couverture et échanger immédiatement une ressource.`,
    strongside: `${firstDragon ? dragonWindow : topWindow} : annoncer le path, confirmer les priorités et arriver avant l'adversaire dans la zone.`,
  };
  return {
    weakside: "Quand les ressources de l'équipe sont engagées sur l'autre side : céder proprement et annoncer le risque.",
    strongside: "Quand le prochain objectif correspond à son side : créer la priorité avant le setup.",
  };
}

function matchPlayerCoachReads(match) {
  const allies = teamRows(match, "ALLY");
  const kills = championKillEvents(match);
  const objectives = objectiveEvents(match);
  const roleDiffs = roleDiffRows(match);
  return allies.map((row) => {
    const participantId = rowParticipantId(row);
    const deaths = kills.filter((event) => event.victimTeam === "ALLY" && event.victimId === participantId);
    const catches = deaths.filter((death) => {
      const traded = kills.some((event) => event.killerTeam === "ALLY" && Math.abs(event.timestamp - death.timestamp) <= 15000);
      const beforeObjective = objectives.some((event) => event.timestamp > death.timestamp && event.timestamp - death.timestamp <= 90000);
      return !traded || beforeObjective || (death.assistingParticipantIds || []).length <= 1;
    });
    const positiveEvents = kills.filter((event) => {
      if (event.killerTeam !== "ALLY") return false;
      const involved = event.killerId === participantId || (event.assistingParticipantIds || []).map(Number).includes(participantId);
      if (!involved) return false;
      const alliedDeathsNearby = kills.filter((item) => item.victimTeam === "ALLY" && Math.abs(item.timestamp - event.timestamp) <= 15000).length;
      const enemyDeathsNearby = kills.filter((item) => item.victimTeam === "ENEMY" && Math.abs(item.timestamp - event.timestamp) <= 15000).length;
      return enemyDeathsNearby > alliedDeathsNearby;
    });
    const diff = roleDiffs.find((item) => item.ally === row || normalizeProfileRole(item.role) === normalizeProfileRole(row.role));
    const side = playerSideTimings(match, row.role);
    const catchText = catches.length
      ? `${catches.length} catch${catches.length > 1 ? "s" : ""} détecté${catches.length > 1 ? "s" : ""} : ${catches.slice(0, 3).map((event) => event.time).join(" · ")}${catches.length > 3 ? "…" : ""}. Revoir information disponible, position des alliés et objectif suivant.`
      : deaths.length
        ? `Aucun catch net détecté : ${deaths.length} mort${deaths.length > 1 ? "s" : ""}, mais échangée${deaths.length > 1 ? "s" : ""} ou hors fenêtre critique.`
        : Number(row.deaths) === 0
          ? "Aucune mort : vérifier que cette discipline n'a pas sacrifié une fenêtre d'impact utile."
          : "Timings des morts indisponibles : vérifier les catches dans la VOD.";
    const goodText = positiveEvents.length
      ? `${positiveEvents.length} bonne${positiveEvents.length > 1 ? "s" : ""} fenêtre${positiveEvents.length > 1 ? "s" : ""} d'impact, dès ${positiveEvents[0].time} : participation à une séquence gagnée sans rendre autant de kills.`
      : !kills.length
        ? "Événements de combat indisponibles : vérifier les séquences positives dans la VOD."
        : "Aucune séquence positive nette détectée dans la timeline : chercher si le joueur arrive trop tard, trop tôt ou sans ressources.";
    const laneText = diff
      ? `Lane : CS10 ${Number.isFinite(diff.cs10Diff) ? `${diff.cs10Diff >= 0 ? "+" : ""}${diff.cs10Diff}` : "N/A"} · or final ${formatGoldDiff(diff.goldDiff)} · ${diff.goldDiff >= 0 ? "levier à convertir" : "coût à stabiliser"}.`
      : "Lane : données comparatives insuffisantes.";
    return { name: playerReviewName(row), role: normalizeProfileRole(row.role) || row.role || "ROLE", catchText, goodText, laneText, ...side };
  });
}

function matchCoachSnapshot(match) {
  const ally = teamRows(match, "ALLY");
  const enemy = teamRows(match, "ENEMY");
  const allyKills = sumRows(ally, "kills");
  const allyDeaths = sumRows(ally, "deaths");
  const allyAssists = sumRows(ally, "assists");
  const enemyKills = sumRows(enemy, "kills");
  const goldDiff = sumRows(ally, "gold") - sumRows(enemy, "gold");
  const damageDiff = sumRows(ally, "damage") - sumRows(enemy, "damage");
  const visionDiff = sumRows(ally, "vision") - sumRows(enemy, "vision");
  const allyObjectives = objectiveTeamSummary(match, "ALLY");
  const enemyObjectives = objectiveTeamSummary(match, "ENEMY");
  const objectiveDiff = teamObjectiveScore(allyObjectives) - teamObjectiveScore(enemyObjectives);
  const fights = fightWindows(match);
  const allyFights = fights.filter((fight) => fight.teamKey === "ALLY").length;
  const enemyFights = fights.filter((fight) => fight.teamKey === "ENEMY").length;
  const roleRows = roleDiffRows(match);
  const reviewRole = roleRows.slice().sort((a, b) => {
    const score = (row) => (Number(row.goldDiff || 0) / 450) + (Number(row.damageDiff || 0) / 1400) + (Number(row.cs10Diff || 0) * 1.4) - (Number(row.deathsDiff || 0) * 4);
    return score(a) - score(b);
  })[0];
  const carryRole = roleRows.slice().sort((a, b) => (Number(b.goldDiff || 0) + Number(b.damageDiff || 0) / 3) - (Number(a.goldDiff || 0) + Number(a.damageDiff || 0) / 3))[0];
  const isWin = match.result === "Victoire";
  const mainSignal = (() => {
    if (Math.abs(goldDiff) >= 2500) return { label: "Économie", value: formatGoldDiff(goldDiff), toneName: goldDiff >= 0 ? "green" : "red" };
    if (Math.abs(damageDiff) >= 7000) return { label: "Fights", value: `${damageDiff >= 0 ? "+" : ""}${formatPoints(damageDiff)}`, toneName: damageDiff >= 0 ? "green" : "red" };
    if (Math.abs(visionDiff) >= 18) return { label: "Vision", value: `${visionDiff >= 0 ? "+" : ""}${formatPoints(visionDiff)}`, toneName: visionDiff >= 0 ? "cyan" : "red" };
    return { label: "Objectifs", value: `${objectiveDiff >= 0 ? "+" : ""}${objectiveDiff}`, toneName: objectiveDiff >= 0 ? "cyan" : "red" };
  })();
  const title = isWin
    ? `Victoire portée par ${mainSignal.label.toLowerCase()}`
    : `${mainSignal.label} à corriger en priorité`;
  const summary = isWin
    ? `La game se gagne avec ${mainSignal.value}. Le replay doit confirmer comment cet avantage a été créé puis converti.`
    : `La game se perd avec ${mainSignal.value}. La review doit isoler le moment où le plan décroche.`;
  const roleLabelText = reviewRole ? roleLabel(reviewRole.role) : "Rôle non isolé";
  const roleText = reviewRole
    ? `${roleLabelText} vs ${championDisplayName(reviewRole.enemy?.champion)} · CS10 ${Number.isFinite(reviewRole.cs10Diff) ? (reviewRole.cs10Diff >= 0 ? "+" : "") + reviewRole.cs10Diff : "N/A"} · or ${formatGoldDiff(reviewRole.goldDiff)}`
    : "Pas assez de données par rôle.";
  const keep = isWin
    ? (carryRole ? `${roleLabel(carryRole.role)} a donné le meilleur levier de la game.` : "Le plan global a converti.")
    : (goldDiff > 0 || damageDiff > 0 ? "Il y a un avantage exploitable à conserver." : "Garder uniquement les phases propres identifiées en timeline.");
  const correct = reviewRole
    ? `${roleLabelText} est la première lane à revoir.`
    : "Revoir le premier objectif et les morts avant setup.";
  const action = isWin
    ? "Identifier le setup reproductible pour la prochaine game."
    : "Choisir un seul correctif avant le prochain bloc.";
  const roleName = reviewRole ? roleLabel(reviewRole.role) : "l'équipe";
  const isEconomyIssue = goldDiff < -2500;
  const isFightIssue = damageDiff < -7000 || enemyFights > allyFights;
  const isVisionIssue = visionDiff < -18;
  const isObjectiveIssue = objectiveDiff < 0;
  const verdict = isWin
    ? `Cette victoire compte seulement si l'équipe sait reproduire le setup qui a créé ${mainSignal.value} en ${mainSignal.label.toLowerCase()}.`
    : `${roleName} est le premier point de rupture visible, mais la review doit remonter à la décision collective qui l'a exposé.`;
  const standard = isVisionIssue
    ? "Aucun objectif joué sans zone préparée, information jungle et chemin de sortie annoncé."
    : isObjectiveIssue
      ? "Chaque objectif est appelé 60 secondes avant avec priorité de lane, reset et responsabilité de setup."
      : isEconomyIssue
        ? "Une lane sous pression ne donne pas une deuxième ressource : wave, camp ou plaque sont cédés consciemment, jamais par défaut."
        : isFightIssue
          ? "Le fight ne démarre qu'avec la cible, les cooldowns clés et la condition de sortie compris par les cinq joueurs."
          : "Le plan de jeu doit être formulé avant la draft puis confirmé par un call simple à chaque transition.";
  const vodCheckpoints = [
    `Premier moment où l'écart d'or change de sens : qui avait l'information, quel call a été fait, quelle option sûre existait ?`,
    isObjectiveIssue ? "60 secondes avant le premier objectif perdu : waves, resets, vision et position du jungler." : "Premier objectif contesté : avantage réel, ressources disponibles et condition de renoncement.",
    reviewRole ? `Première séquence où ${roleName} perd le contrôle : état de wave, couverture, communication et coût collectif.` : "Première mort évitable : information disponible, décision prise et conséquence sur la carte.",
  ];
  const executionPlan = [
    `Avant la game : annoncer la win condition et le risque numéro 1 en une phrase.`,
    isVisionIssue || isObjectiveIssue ? "En game : lancer le setup objectif à T-60, confirmer les priorités à T-40 et décider go/no-go à T-20." : "En game : verbaliser la prochaine ressource jouée avant chaque transition de map.",
    `Après la game : vérifier ce standard sur 3 séquences, sans juger uniquement le résultat final.`,
  ];
  const validation = isWin
    ? "Validé si le même setup crée un avantage exploitable sur 2 des 3 prochaines games."
    : `Validé si ${roleName} ne subit plus le même point de rupture sur 3 games consécutives et si le call collectif arrive avant l'action.`;
  const coachQuestions = [
    "Qu'est-ce que tu savais au moment de décider — pas après coup ?",
    "Quel call simple aurait permis aux cinq joueurs de prendre la même décision ?",
    "Quel comportement précis remplace l'erreur dès la prochaine game ?",
  ];
  const playerReads = matchPlayerCoachReads(match);
  return {
    title,
    summary,
    mainSignal,
    roleText,
    keep,
    correct,
    action,
    verdict,
    standard,
    vodCheckpoints,
    executionPlan,
    validation,
    coachQuestions,
    playerReads,
    metrics: [
      ["KDA", `${allyKills}/${allyDeaths}/${allyAssists}`, `${enemyKills} kills adverses`, "cyan"],
      ["Or", formatGoldDiff(goldDiff), "écart final", goldDiff >= 0 ? "green" : "red"],
      ["Dégâts", `${damageDiff >= 0 ? "+" : ""}${formatPoints(damageDiff)}`, "alliés vs adversaires", damageDiff >= 0 ? "green" : "red"],
      ["Vision", `${visionDiff >= 0 ? "+" : ""}${formatPoints(visionDiff)}`, "score vision", visionDiff >= 0 ? "cyan" : "red"],
      ["Objectifs", `${teamObjectiveScore(allyObjectives)}-${teamObjectiveScore(enemyObjectives)}`, "tous objectifs", objectiveDiff >= 0 ? "cyan" : "red"],
      ["Fights", `${allyFights}-${enemyFights}`, "fenêtres détectées", allyFights >= enemyFights ? "green" : "red"],
    ],
  };
}

function MatchCoachBrief({ match }) {
  const snapshot = matchCoachSnapshot(match);
  const matchId = match?.id || "";
  return <section className="mt-5 overflow-hidden rounded-[1.5rem] border border-cyan-200/18 bg-[linear-gradient(135deg,rgba(34,211,238,.095),rgba(5,8,20,.92)_48%,rgba(168,85,247,.09))] p-4">
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,.55fr)] xl:items-start">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2"><Badge tone={snapshot.mainSignal.toneName}>{snapshot.mainSignal.label}</Badge><Badge tone="cyan">Review prête</Badge></div>
        <h4 className="mt-3 break-words text-2xl font-black text-white">{snapshot.title}</h4>
        <p className="mt-2 max-w-4xl text-sm font-semibold leading-6 text-slate-200">{snapshot.summary}</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {[["À garder", snapshot.keep, "green"], ["À corriger", snapshot.correct, "red"], ["Prochaine action", snapshot.action, "cyan"]].map(([label, value, toneName]) => <div key={label} className="min-w-0 rounded-2xl bg-black/24 p-3">
            <p className={cx("text-[0.6rem] font-black uppercase tracking-[0.16em]", toneName === "green" ? "text-emerald-100" : toneName === "red" ? "text-rose-100" : "text-cyan-100")}>{label}</p>
            <p className="mt-1.5 text-sm font-black leading-5 text-white">{value}</p>
          </div>)}
        </div>
      </div>
      <div className="grid min-w-0 gap-2">
        <div className="rounded-2xl bg-black/24 p-3">
          <p className="text-[0.6rem] font-black uppercase tracking-[0.16em] text-slate-400">Lane à review</p>
          <p className="mt-1.5 text-sm font-black leading-5 text-white">{snapshot.roleText}</p>
        </div>
        <Button type="button" icon={Plus} onClick={() => openAppPath(`/rapports?match=${encodeURIComponent(matchId)}&compose=1`)} disabled={!matchId}>Créer la review</Button>
        <Button type="button" variant="ghost" icon={ArrowRight} onClick={() => openAppPath(`/rapports?match=${encodeURIComponent(matchId)}`)} disabled={!matchId}>Ouvrir Review</Button>
      </div>
    </div>
    <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
      {snapshot.metrics.map(([label, value, detail, toneName]) => <div key={label} className="min-w-0 rounded-xl bg-white/[0.035] p-3">
        <p className="truncate text-[0.58rem] font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
        <p className={cx("mt-1 truncate text-lg font-black", toneName === "green" ? "text-emerald-100" : toneName === "red" ? "text-rose-100" : "text-cyan-100")}>{value}</p>
        <p className="mt-0.5 truncate text-[0.62rem] font-semibold text-slate-400">{detail}</p>
      </div>)}
    </div>
  </section>;
}

function MatchDataPanel({ match, teamName, statsFirst = false }) {
  if (!match) return null;
  const ally = teamRows(match, "ALLY");
  const enemy = teamRows(match, "ENEMY");
  const allyKills = sumRows(ally, "kills");
  const allyDeaths = sumRows(ally, "deaths");
  const allyAssists = sumRows(ally, "assists");
  const enemyKills = sumRows(enemy, "kills");
  const damageDiff = sumRows(ally, "damage") - sumRows(enemy, "damage");
  const goldDiff = sumRows(ally, "gold") - sumRows(enemy, "gold");
  const visionDiff = sumRows(ally, "vision") - sumRows(enemy, "vision");
  const metrics = <div className="nxt5-kpi-grid mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4"><MetricCard compact icon={Swords} label="KDA équipe" value={`${allyKills}/${allyDeaths}/${allyAssists}`} hint={`${enemyKills} kills adverses`} tone="cyan" /><MetricCard compact icon={Flame} label="Écart dégâts" value={(damageDiff >= 0 ? "+" : "") + formatPoints(damageDiff)} hint="Alliés vs adversaires" tone={damageDiff >= 0 ? "green" : "red"} sideMarker={winningSideForDiff(match, damageDiff)} /><MetricCard compact icon={Gauge} label="Écart or" value={formatGoldDiff(goldDiff)} hint="Économie globale" tone={goldDiff >= 0 ? "green" : "red"} sideMarker={winningSideForDiff(match, goldDiff)} /><MetricCard compact icon={Eye} label="Écart vision" value={(visionDiff >= 0 ? "+" : "") + formatPoints(visionDiff)} hint="Score vision équipe" tone={visionDiff >= 0 ? "cyan" : "red"} sideMarker={winningSideForDiff(match, visionDiff)} /></div>;
  return <Surface glow className="nxt5-match-panel mt-5"><div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Badge tone={match.result === "Victoire" ? "green" : "red"}>{match.result || "Analyse"}</Badge><Badge tone="slate">{match.patch || "Patch ?"}</Badge><Badge tone="blue">{match.side || "Côté ?"}</Badge><Badge tone={timelineStatus(match).toneName}>{timelineStatus(match).label}</Badge></div><h3 tabIndex={-1} className="mt-3 break-words text-2xl font-black text-white">{matchDisplayName(match)}</h3><p className="mt-1 text-sm font-semibold text-slate-300">{match.game_id} · {match.duration || "--:--"}</p></div>{!statsFirst && <div className="flex flex-wrap gap-2"><Button type="button" icon={Plus} onClick={() => openAppPath(`/rapports?match=${encodeURIComponent(match.id || "")}&compose=1`)} disabled={!match.id}>Créer review</Button></div>}</div>{statsFirst && metrics}{!statsFirst && <MatchCoachBrief match={match} />}<MatchVersusOverview match={match} teamName={teamName} />{!statsFirst && metrics}{statsFirst && <MatchCoachBrief match={match} />}<GameSummaryPanel match={match} /><MatchTimelineReview match={match} /><GameMetricSignals match={match} /><RoleDiffPanel match={match} /><DeathContextPanel match={match} /><DraftImpactPanel match={match} /></Surface>;
}

function archiveMatchIds(archive) {
  return Array.isArray(archive?.match_ids) ? archive.match_ids : [];
}

function ScrimArchiveSummary({ matches, selectedMatchId = "", onSelectMatch, showGames = true }) {
  const rows = matches.flatMap((match) => match.participants || []);
  const ally = rows.filter((row) => row.team_key === "ALLY");
  const enemy = rows.filter((row) => row.team_key === "ENEMY");
  const wins = matches.filter((match) => match.result === "Victoire").length;
  const damageDiff = sumRows(ally, "damage") - sumRows(enemy, "damage");
  const goldDiff = sumRows(ally, "gold") - sumRows(enemy, "gold");
  const visionDiff = sumRows(ally, "vision") - sumRows(enemy, "vision");
  const deaths = sumRows(ally, "deaths");
  const enemyDeaths = sumRows(enemy, "deaths");
  const selectedMatch = matches.find((match) => String(match.id || "") === String(selectedMatchId || "")) || null;
  if (!matches.length) return null;
  return <Surface glow className="mt-5">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2"><Badge tone="purple">Analyse de groupe</Badge><Badge tone="slate">{matches.length} game{matches.length > 1 ? "s" : ""}</Badge></div>
        <h3 className="mt-3 text-2xl font-black text-white">Résultats du groupe</h3>
        <p className="mt-1 text-sm font-semibold text-slate-300">Agrégation des games sélectionnées : série, volume, écarts et signaux communs.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={wins >= matches.length / 2 ? "green" : "red"}>{wins}W / {matches.length - wins}L</Badge>
      </div>
    </div>
    <div className="nxt5-kpi-grid mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4"><MetricCard icon={Trophy} label="Winrate bloc" value={`${Math.round((wins / Math.max(1, matches.length)) * 100)}%`} hint="Sur les games du groupe" tone={wins >= matches.length / 2 ? "green" : "red"} /><MetricCard icon={Flame} label="Écart dégâts" value={(damageDiff >= 0 ? "+" : "") + formatPoints(damageDiff)} hint="Total série" tone={diffTone(damageDiff)} sideMarker={winningTeamForDiff(damageDiff)} /><MetricCard icon={Gauge} label="Écart or" value={formatGoldDiff(goldDiff)} hint="Total série" tone={diffTone(goldDiff)} sideMarker={winningTeamForDiff(goldDiff)} /><MetricCard icon={Eye} label="Écart vision" value={(visionDiff >= 0 ? "+" : "") + formatPoints(visionDiff)} hint={`${deaths} morts alliées / ${enemyDeaths} ennemies`} tone={diffTone(visionDiff)} sideMarker={winningTeamForDiff(visionDiff)} /></div>
    {showGames && <div className="nxt5-game-list mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{matches.map((match) => { const activeGame = String(selectedMatchId || "") === String(match.id || ""); return <div key={match.id} className={cx("relative overflow-hidden rounded-2xl border p-4 transition", activeGame ? "border-cyan-200/75 bg-cyan-400/14 shadow-[0_0_0_1px_rgba(103,232,249,.28),0_0_30px_rgba(34,211,238,.18)]" : "border-white/10 bg-black/25 hover:border-cyan-300/25 hover:bg-white/[0.055]")}><div className={cx("pointer-events-none absolute inset-y-4 left-0 w-1 rounded-r-full bg-cyan-200 shadow-[0_0_14px_rgba(103,232,249,.65)] transition", activeGame ? "opacity-100" : "opacity-0")} /><button type="button" aria-pressed={activeGame} onClick={() => onSelectMatch?.(activeGame ? "" : match.id)} className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/60"><div className="flex flex-wrap items-center gap-2"><Badge tone={match.result === "Victoire" ? "green" : "red"}>{match.result || "Analyse"}</Badge><Badge tone="slate">{match.duration || "--:--"}</Badge>{activeGame && <Badge tone="cyan">Sélectionnée</Badge>}</div><p className="mt-3 truncate font-black text-white">{matchDisplayName(match)}</p><p className={cx("mt-1 truncate text-xs font-semibold", activeGame ? "text-cyan-100" : "text-slate-300")}>{match.game_id || ""}</p></button></div>; })}</div>}
  </Surface>;
}

const GAME_WORKSPACE_TABS = [
  { id: "games", label: "Games", icon: Swords, path: "/games" },
  { id: "review", label: "Review", icon: FileText, path: "/rapports" },
];

function GameWorkspace(props) {
  return gameWorkspaceSectionFromPath(props.route?.path) === "review"
    ? <Reports key={props.selectedTeamId} {...props} />
    : <Statistics key={props.selectedTeamId} {...props} />;
}

function Statistics({ data, selectedTeamId, refreshAll, pushToast, currentMember, user, route }) {
  const baseMatches = (data.matches || []).filter((match) => match.team_id === selectedTeamId);
  const matchCategories = (data.matchCategories || []).filter((category) => category.team_id === selectedTeamId);
  const archives = (data.matchArchives || []).filter((archive) => archive.team_id === selectedTeamId);
  const selectedTeamName = (data.teams || []).find((team) => String(team.id) === String(selectedTeamId))?.name || "Notre équipe";
  const query = new URLSearchParams(route?.search ?? window.location.search);
  const urlMatchId = query.get("match") || "";
  const urlArchiveId = query.get("archive") || "";
  const urlImportOpen = query.get("import") === "1";
  const urlView = query.get("view") === "groups" || urlArchiveId ? "groups" : "games";
  const [selectedMatchId, setSelectedMatchId] = useState(urlMatchId);
  const [selectedArchiveId, setSelectedArchiveId] = useState(urlArchiveId);
  const [importOpen, setImportOpen] = useState(urlImportOpen);
  const [importBusy, setImportBusy] = useState(false);
  const [workspaceView, setWorkspaceView] = useState(urlView);
  const [exportingStats, setExportingStats] = useState(false);
  const [archiveForm, setArchiveForm] = useState({ id: "", name: "", description: "", matchIds: [] });
  const [savingArchive, setSavingArchive] = useState(false);
  const [archiveWorkspaceTab, setArchiveWorkspaceTab] = useState("select");
  const importTriggerRef = useRef(null);
  const statsRef = useRef(null);
  const listRef = useRef(null);
  const previousSelection = useRef("");

  useEffect(() => {
    setSelectedMatchId(urlMatchId);
    setSelectedArchiveId(urlArchiveId);
    setImportOpen(urlImportOpen);
    setWorkspaceView(urlView);
  }, [urlMatchId, urlArchiveId, urlImportOpen, urlView]);

  function updateLocation(changes) {
    const next = new URLSearchParams(window.location.search);
    Object.entries(changes).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key));
    if ("match" in changes) setSelectedMatchId(changes.match || "");
    if ("archive" in changes) setSelectedArchiveId(changes.archive || "");
    if ("import" in changes) setImportOpen(changes.import === "1");
    if ("view" in changes) setWorkspaceView(changes.view === "groups" ? "groups" : "games");
    openAppPath(`/games${next.size ? `?${next}` : ""}`);
  }
  const selectMatch = (id) => updateLocation({ match: id });
  const selectArchive = (id) => updateLocation({ archive: id, match: "", view: "groups" });
  const selectView = (id) => updateLocation({ view: id === "groups" ? "groups" : "", archive: "", match: "" });
  useEffect(() => {
    if (selectedMatchId) {
      (statsRef.current?.querySelector?.("h3") || statsRef.current)?.focus({ preventScroll: true });
      statsRef.current?.scrollIntoView({ block: "start", behavior: "instant" });
    } else if (previousSelection.current) {
      const rows = listRef.current?.querySelectorAll?.("[data-match-id]") || [];
      const row = Array.from(rows).find((node) => node.dataset.matchId === previousSelection.current);
      row?.focus({ preventScroll: true });
      row?.scrollIntoView({ block: "center", behavior: "instant" });
    }
    previousSelection.current = selectedMatchId;
  }, [selectedMatchId]);

  const selectedArchive = archives.find((archive) => String(archive.id) === String(selectedArchiveId));
  const matches = baseMatches;
  const scopedMatches = selectedArchive ? matches.filter((match) => archiveMatchIds(selectedArchive).includes(match.id)) : matches;
  const selectedMatchSummary = baseMatches.find((match) => String(match.id) === String(selectedMatchId)) || null;
  const { detail: selectedMatchDetail, error: selectedMatchDetailError, loading: loadingMatchDetail, retry: retryMatchDetail } = useMatchDetails(selectedTeamId, selectedMatchId, data.bootstrapRevision || "");
  const selectedMatch = selectedMatchDetail
    ? { ...selectedMatchSummary, ...selectedMatchDetail, participants: selectedMatchDetail.participants || selectedMatchSummary?.participants || [] }
    : selectedMatchSummary;
  const selectedReport = (data.reports || []).find((report) => report.team_id === selectedTeamId && reportMatchIds(report).includes(selectedMatchId));
  const selectedArchiveReport = selectedArchive ? (data.reports || []).find((report) => {
    const ids = reportMatchIds(report);
    const groupIds = archiveMatchIds(selectedArchive);
    return report.team_id === selectedTeamId && groupIds.length && groupIds.length === ids.length && groupIds.every((id) => ids.includes(id));
  }) : null;
  const wins = baseMatches.filter((match) => match.result === "Victoire").length;
  const losses = baseMatches.filter((match) => match.result === "Défaite").length;
  const openReview = () => openAppPath(selectedReport
    ? `/rapports?report=${encodeURIComponent(selectedReport.id)}&match=${encodeURIComponent(selectedMatchId)}`
    : `/rapports?match=${encodeURIComponent(selectedMatchId)}&compose=1`);
  function finishImport(result) {
    const id = result?.match?.id;
    setImportBusy(false);
    setWorkspaceView("games");
    updateLocation({ import: "", view: "", archive: "", match: id ? String(id) : "" });
  }
  const toggleArchiveMatch = (matchId) => setArchiveForm((current) => ({ ...current, matchIds: current.matchIds.includes(matchId) ? current.matchIds.filter((id) => id !== matchId) : [...current.matchIds, matchId] }));
  const resetArchiveForm = () => setArchiveForm({ id: "", name: "", description: "", matchIds: [] });
  const editArchive = (archive) => {
    setArchiveForm({ id: archive.id, name: archive.name || "", description: archive.description || "", matchIds: archiveMatchIds(archive) });
    setWorkspaceView("groups");
    updateLocation({ match: "", archive: "", view: "groups" });
    setArchiveWorkspaceTab("create");
  };
  async function saveArchive(event) {
    event.preventDefault();
    setSavingArchive(true);
    try {
      const creating = !archiveForm.id;
      await apiFetch("match-archives-manage", { method: "POST", body: JSON.stringify({ action: archiveForm.id ? "update" : "create", teamId: selectedTeamId, archiveId: archiveForm.id, name: archiveForm.name, description: archiveForm.description, matchIds: archiveForm.matchIds }) });
      if (creating) {
        const linked = matches.filter((match) => archiveForm.matchIds.includes(match.id));
        await apiFetch("reports-manage", { method: "POST", body: JSON.stringify({ action: "create", teamId: selectedTeamId, title: archiveForm.name, content: buildArchiveReportContent(archiveForm.name, linked), matchIds: archiveForm.matchIds }) });
      }
      pushToast?.({ type: "green", title: archiveForm.id ? "Archive renommée" : "Archive créée", text: "Le groupe de games est prêt dans Games." });
      resetArchiveForm();
      setArchiveWorkspaceTab("select");
      await refreshAll?.();
    } catch (err) {
      pushToast?.({ type: "red", title: "Archive impossible", text: err.message });
    } finally {
      setSavingArchive(false);
    }
  }
  async function deleteArchive(archive) {
    if (!archive || !window.confirm(`Supprimer l’archive "${archive.name}" ?`)) return;
    setSavingArchive(true);
    try {
      await apiFetch("match-archives-manage", { method: "POST", body: JSON.stringify({ action: "delete", teamId: selectedTeamId, archiveId: archive.id }) });
      if (selectedArchiveId === archive.id) updateLocation({ archive: "", match: "" });
      pushToast?.({ type: "green", title: "Archive supprimée", text: "Le groupe a été retiré." });
      await refreshAll?.();
    } catch (err) {
      pushToast?.({ type: "red", title: "Suppression impossible", text: err.message });
    } finally {
      setSavingArchive(false);
    }
  }
  async function downloadStatsPng(group = false) {
    if (exportingStats) return;
    let exportMatches = group ? scopedMatches : selectedMatch ? [selectedMatch] : [];
    if (!exportMatches.length) return;
    setExportingStats(true);
    try {
      if (group && exportMatches.length === 1) {
        const match = exportMatches[0];
        const payload = await apiFetch("match-details", { method: "POST", body: JSON.stringify({ teamId: selectedTeamId, matchIds: [match.id] }) });
        const detail = payload?.matches?.find((item) => String(item.id) === String(match.id) && String(item.team_id) === String(selectedTeamId));
        if (!detail) throw new Error("Impossible de charger les données complètes de la game.");
        exportMatches = [{ ...match, ...detail }];
      }
      await exportStatsPng({
        title: group ? selectedArchive?.name || "Groupe NXT5" : matchDisplayName(exportMatches[0]),
        subtitle: group ? exportMatches.length + " games" : exportMatches[0].game_id,
        matches: exportMatches,
        filename: group ? "nxt5-groupe-stats.png" : "nxt5-game-" + (exportMatches[0].game_id || "export") + ".png",
      });
    } catch (error) {
      pushToast?.({ type: "red", title: "Export impossible", text: error?.message || "Le PNG n’a pas pu être généré." });
    } finally {
      setExportingStats(false);
    }
  }

  return <div className="nxt5-data-dense nxt5-stats-page nxt5-games-page min-w-0">
    <PageHeader eyebrow={selectedTeamName} title="Games" subtitle={selectedMatchId ? "Les statistiques de ta game, du résultat au détail par rôle." : "Retrouve tes games et ouvre leurs statistiques."}>
      <span ref={importTriggerRef}><Button type="button" variant={selectedMatchId ? "ghost" : "primary"} icon={Upload} onClick={() => updateLocation({ import: "1" })}>Importer une game</Button></span>
    </PageHeader>
    {importOpen && <GameOperationDialog title="Importer une game" description="Télécharge NXT5 Importer ou charge un fichier JSON déjà exporté." onClose={() => updateLocation({ import: "" })} busy={importBusy} returnFocusRef={importTriggerRef}>
      <ImportGameFlow data={data} selectedTeamId={selectedTeamId} refreshAll={refreshAll} pushToast={pushToast} currentMember={currentMember} user={user} onImported={finishImport} onBusyChange={setImportBusy} />
    </GameOperationDialog>}

    {selectedMatchId && <div ref={statsRef} id="selected-game-stats" tabIndex={-1} className="games-detail" aria-label="Statistiques de la game">
      <div className="games-detail-toolbar">
        <Button type="button" variant="ghost" icon={ArrowLeft} onClick={() => selectMatch("")}>{selectedArchive ? "Retour au groupe" : "Retour aux games"}</Button>
        {selectedMatch && <div className="games-detail-actions">
          <Button type="button" variant="ghost" icon={Download} onClick={() => downloadStatsPng(false)} disabled={loadingMatchDetail || Boolean(selectedMatchDetailError) || exportingStats}>{exportingStats ? "Export…" : "Exporter PNG"}</Button>
          <Button type="button" variant="ghost" icon={FileText} onClick={openReview}>{selectedReport ? "Ouvrir la review" : "Créer une review"}</Button>
          <GameActions key={selectedMatchId} disabled={loadingMatchDetail || Boolean(selectedMatchDetailError)} match={selectedMatch} data={data} selectedTeamId={selectedTeamId} refreshAll={refreshAll} pushToast={pushToast} currentMember={currentMember} user={user} onDeleted={() => updateLocation({ match: "", ...(selectedArchive && scopedMatches.length <= 1 ? { archive: "" } : {}) })} onUpdated={retryMatchDetail} />
        </div>}
      </div>
      {!selectedMatch && <div className="games-detail-title"><h3>Statistiques de la game</h3></div>}
      {loadingMatchDetail && <p className="games-load-state" role="status"><Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />Chargement des statistiques détaillées…</p>}
      {!loadingMatchDetail && selectedMatchDetailError && <Surface className="mt-4"><p role="alert">{selectedMatchDetailError}{selectedMatch && " Les statistiques déjà chargées restent disponibles."}</p><Button type="button" variant="ghost" className="mt-3" icon={RefreshCw} onClick={retryMatchDetail}>Réessayer</Button></Surface>}
      {selectedMatch && <MatchDataPanel match={selectedMatch} teamName={selectedTeamName} statsFirst />}
      {!selectedMatch && !loadingMatchDetail && !selectedMatchDetailError && <Surface><EmptyState icon={Search} title="Game introuvable" text="Elle n’est plus disponible dans cette équipe." /></Surface>}
    </div>}

    <div hidden={Boolean(selectedMatchId)}>
      <div className="games-library-toolbar">
        <TabNav label="Bibliothèque de games" items={[{ id: "games", label: "Games", meta: String(baseMatches.length) }, { id: "groups", label: "Groupes", meta: String(archives.length) }]} activeId={workspaceView} onChange={selectView} columns="sm:grid-cols-2" />
        {baseMatches.length > 0 && <p className="games-team-record"><span>Équipe</span><strong>{wins} V · {losses} D</strong><span>{Math.round(wins / baseMatches.length * 100)} % de victoires</span></p>}
      </div>
      {workspaceView === "groups" && !selectedArchive && <Surface className="mt-4">
        <div className="games-group-heading"><div><h3>Groupes de games</h3><p>Analyse ensemble les games d’une session ou d’une série.</p></div><Button type="button" variant="ghost" icon={archiveWorkspaceTab === "create" ? X : Plus} onClick={() => { resetArchiveForm(); setArchiveWorkspaceTab(archiveWorkspaceTab === "create" ? "select" : "create"); }}>{archiveWorkspaceTab === "create" ? "Fermer" : "Créer un groupe"}</Button></div>
        {archiveWorkspaceTab === "select" ? <div className="games-group-list">
          {archives.map((archive) => {
            const groupMatches = baseMatches.filter((match) => archiveMatchIds(archive).includes(match.id));
            const groupWins = groupMatches.filter((match) => match.result === "Victoire").length;
            return <div key={archive.id} className="games-group-row">
              <button type="button" className="games-group-open" onClick={() => selectArchive(archive.id)}><span><strong>{archive.name}</strong><span>{archive.description || `${groupMatches.length} games`}</span></span><span>{groupWins} V · {groupMatches.filter((match) => match.result === "Défaite").length} D</span><ChevronRight aria-hidden="true" className="h-4 w-4" /></button>
              <div className="games-group-tools"><button type="button" className="ig-icon-button" aria-label={`Modifier le groupe ${archive.name}`} onClick={() => editArchive(archive)} disabled={savingArchive}><Pencil aria-hidden="true" /></button><button type="button" className="ig-icon-button" aria-label={`Supprimer le groupe ${archive.name}`} onClick={() => deleteArchive(archive)} disabled={savingArchive}><Trash2 aria-hidden="true" /></button></div>
            </div>;
          })}
          {!archives.length && <EmptyState icon={FileText} title="Aucun groupe" text="Rassemble les games d’un scrim ou d’une compétition pour lire leurs résultats ensemble." />}
        </div> : <form onSubmit={saveArchive} className="games-group-form">
          <fieldset disabled={savingArchive}>
            <div className="games-group-fields"><TextInput label="Nom du groupe" value={archiveForm.name} onChange={(name) => setArchiveForm((current) => ({ ...current, name }))} placeholder="Scrim vs BK — 08/09" required /><TextInput label="Description" value={archiveForm.description} onChange={(description) => setArchiveForm((current) => ({ ...current, description }))} placeholder="Session, objectif du bloc…" /></div>
            <div className="games-group-heading"><p>{archiveForm.matchIds.length} game(s) sélectionnée(s)</p><div className="flex flex-wrap gap-2"><Button type="button" variant="ghost" onClick={() => setArchiveForm((current) => ({ ...current, matchIds: matches.map((match) => match.id) }))} disabled={!matches.length}>Tout sélectionner</Button><Button type="button" variant="ghost" onClick={() => setArchiveForm((current) => ({ ...current, matchIds: [] }))} disabled={!archiveForm.matchIds.length}>Vider</Button></div></div>
            <div className="games-group-picks">{matches.map((match) => <label key={match.id}><input type="checkbox" checked={archiveForm.matchIds.includes(match.id)} onChange={() => toggleArchiveMatch(match.id)} /><span><strong>{matchDisplayName(match)}</strong><span>{match.game_id} · {match.result || "Résultat inconnu"}</span></span></label>)}</div>
            {!matches.length && <p>Importe une première game pour créer un groupe.</p>}
            <div className="games-group-form-actions"><Button type="button" variant="ghost" onClick={() => { resetArchiveForm(); setArchiveWorkspaceTab("select"); }}>Annuler</Button><Button type="submit" icon={savingArchive ? Loader2 : Check} disabled={!archiveForm.name.trim() || !archiveForm.matchIds.length || savingArchive}>{savingArchive ? "Enregistrement…" : archiveForm.id ? "Enregistrer" : "Créer le groupe"}</Button></div>
          </fieldset>
        </form>}
      </Surface>}
      {selectedArchive && <>
        <div className="games-detail-toolbar mt-4"><Button type="button" variant="ghost" icon={ArrowLeft} onClick={() => selectArchive("")}>Tous les groupes</Button><div className="games-detail-actions"><Button type="button" variant="ghost" icon={Download} onClick={() => downloadStatsPng(true)} disabled={!scopedMatches.length || exportingStats}>Exporter le groupe PNG</Button>{selectedArchiveReport && <Button type="button" variant="ghost" icon={FileText} onClick={() => openAppPath(`/rapports?report=${encodeURIComponent(selectedArchiveReport.id)}`)}>Ouvrir la review</Button>}</div></div>
        <div className="games-detail-title"><h3>{selectedArchive.name}</h3>{selectedArchive.description && <p>{selectedArchive.description}</p>}</div>
        <ScrimArchiveSummary matches={scopedMatches} showGames={false} />
      </>}
      {selectedArchiveId && !selectedArchive && <p role="status" className="games-load-state">Ce groupe n’est plus disponible. Choisis un autre groupe.</p>}
      <div ref={listRef} hidden={workspaceView === "groups" && !selectedArchive}>
        <ImportedGames
          matches={scopedMatches} categories={matchCategories} selectedMatchId={selectedMatchId} selectedMatch={selectedMatch}
          onSelectMatch={selectMatch} showSelection={false} showCategoryFilter allowImportSort
          title={selectedArchive ? "Games du groupe" : "Toutes les games"}
          description="Recherche une game et ouvre directement ses statistiques."
          scopeName={selectedArchive?.name || ""}
          headerActions={<GameCategoryManager data={data} selectedTeamId={selectedTeamId} refreshAll={refreshAll} pushToast={pushToast} currentMember={currentMember} user={user} />}
          emptyAction={<Button type="button" icon={Upload} onClick={() => updateLocation({ import: "1" })}>Importer une game</Button>}
        />
      </div>
    </div>
  </div>;
}

function reportMatchIds(report) {
  if (Array.isArray(report.match_ids)) return report.match_ids;
  if (typeof report.match_ids === "string") {
    try {
      const parsed = JSON.parse(report.match_ids);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }
  if (report.match_id) return [report.match_id];
  return [];
}

function reportTitleFromMatchIds(matchIds = [], matches = [], fallback = "Review") {
  const linked = matches.filter((match) => matchIds.includes(match.id));
  if (linked.length === 1) return matchDisplayName(linked[0], fallback);
  if (linked.length > 1) {
    const names = linked.slice(0, 2).map((match) => matchDisplayName(match, "Game"));
    return `${names.join(" + ")}${linked.length > 2 ? ` +${linked.length - 2}` : ""}`;
  }
  return fallback;
}

function reportDisplayName(report, matches = [], fallback = "Review") {
  return reportTitleFromMatchIds(reportMatchIds(report), matches, report?.title || fallback);
}

function reportRows(matches, matchIds) {
  const selected = matches.filter((match) => matchIds.includes(match.id));
  return selected.flatMap((match) => (match.participants || []).map((row) => ({ ...row, match }))).filter((row) => row.team_key === "ALLY");
}

function roleRows(rows, role) {
  const needle = String(role || "").replace(/["']/g, "").toUpperCase();
  return rows.filter((row) => String(row.role || "").toUpperCase() === needle);
}

function commandResult(command, rows) {
  const raw = String(command || "").trim();
  const teamMatch = raw.match(/^\/TEAM\s+(KDA|DAMAGE|VISION|GOLD|KP)/i);
  if (teamMatch) {
    if (!rows.length) return `${raw} -> aucune game liée.`;
    const key = teamMatch[1].toUpperCase();
    const avg = (field) => Math.round(rows.reduce((sum, row) => sum + Number(row[field] || 0), 0) / rows.length);
    const avgFloat = (field) => (rows.reduce((sum, row) => sum + Number(row[field] || 0), 0) / rows.length).toFixed(2);
    if (key === "KDA") return `Team KDA moyen: ${avgFloat("kda")} sur ${rows.length} lignes joueur.`;
    if (key === "DAMAGE") return `Team dégâts moyens par joueur: ${formatPoints(avg("damage"))}.`;
    if (key === "VISION") return `Team vision moyenne par joueur: ${avg("vision")}.`;
    if (key === "GOLD") return `Team gold moyen par joueur: ${formatPoints(avg("gold"))}.`;
    return `Team KP moyen: ${Math.round(Number(avgFloat("kp")) * 100)}%`;
  }
  const match = raw.match(/^\/(KDA|DAMAGE|VISION|GOLD|KP)\s+["']?([A-Z]{2,3})["']?/i);
  if (!match) return null;
  const [, key, role] = match;
  const scoped = roleRows(rows, role);
  if (!scoped.length) return `${raw} -> aucune donnée pour ${role.toUpperCase()}.`;
  const avg = (field) => Math.round(scoped.reduce((sum, row) => sum + Number(row[field] || 0), 0) / scoped.length);
  const avgFloat = (field) => (scoped.reduce((sum, row) => sum + Number(row[field] || 0), 0) / scoped.length).toFixed(2);
  const label = role.toUpperCase();
  if (key.toUpperCase() === "KDA") return `${label} KDA moyen: ${avgFloat("kda")} sur ${scoped.length} game${scoped.length > 1 ? "s" : ""}.`;
  if (key.toUpperCase() === "DAMAGE") return `${label} dégâts moyens: ${formatPoints(avg("damage"))}.`;
  if (key.toUpperCase() === "VISION") return `${label} vision moyenne: ${avg("vision")}.`;
  if (key.toUpperCase() === "GOLD") return `${label} gold moyen: ${formatPoints(avg("gold"))}.`;
  return `${label} KP moyen: ${Math.round(Number(avgFloat("kp")) * 100)}%`;
}

function renderReportContent(content, rows) {
  const blockedSections = [/^points?\s+forts?\s*:$/i, /^focus\s*:$/i, /^objectif\s+principal\s*:$/i, /^axes?\s+de\s+travail\s*:$/i];
  const sectionTone = (line) => {
    const value = String(line || "").replace(/^#+\s*/, "").toLowerCase();
    if (/verdict|cause racine|à corriger|non négociable/.test(value)) return "border-rose-300/25 bg-rose-400/[0.08] text-rose-100";
    if (/à garder|standard attendu|validation/.test(value)) return "border-emerald-300/20 bg-emerald-400/[0.07] text-emerald-100";
    if (/plan d'exécution|action prochaine|checkpoints? vod|questions? coach/.test(value)) return "border-cyan-300/22 bg-cyan-400/[0.07] text-cyan-100";
    return "border-purple-300/20 bg-purple-400/[0.07] text-purple-100";
  };
  return <div className="space-y-1.5">{String(content || "").split("\n").filter((line) => !blockedSections.some((pattern) => pattern.test(line))).map((line, index) => {
    const result = commandResult(line, rows);
    const trimmed = String(line || "").trim();
    if (result) return <p key={index} className="min-h-[1.5rem] break-words whitespace-pre-wrap rounded-lg bg-cyan-300/[0.055] px-2.5 py-1 font-mono text-[0.76rem] font-bold leading-6 text-cyan-50 sm:text-[0.82rem]">{result}</p>;
    if (trimmed === REPORT_REWRITE_MARKER || trimmed === "[NXT5_REPORT_V2]") return null;
    if (!trimmed) return <div key={index} className="h-2" />;
    if (/^#{1,3}\s+/.test(trimmed) || /^(VERDICT COACH|CAUSE RACINE|STANDARD ATTENDU|À GARDER|À CORRIGER|CHECKPOINTS? VOD|PLAN D'EXÉCUTION|VALIDATION|QUESTIONS? COACH|LECTURE PAR JOUEUR|NOTES STAFF(?: CONSERVÉES)?|REPÈRES)$/i.test(trimmed)) {
      return <h4 key={index} className={cx("mt-4 rounded-xl border px-3 py-2 text-[0.67rem] font-black uppercase tracking-[0.18em]", sectionTone(trimmed))}>{trimmed.replace(/^#{1,3}\s+/, "")}</h4>;
    }
    if (/^[-•]\s+/.test(trimmed)) return <p key={index} className="relative min-h-[1.5rem] break-words whitespace-pre-wrap pl-5 text-slate-100 before:absolute before:left-1 before:top-[0.65rem] before:h-1.5 before:w-1.5 before:rounded-full before:bg-cyan-300">{trimmed.replace(/^[-•]\s+/, "")}</p>;
    return <p key={index} className="min-h-[1.5rem] break-words whitespace-pre-wrap">{line}</p>;
  })}</div>;
}

function ReviewAnalysisStatus({ details }) {
  if (details.loading) return <p role="status" className="mb-3 text-sm font-semibold text-cyan-100">Préparation automatique de l’analyse des games liées…</p>;
  if (details.error) return <div role="alert" className="mb-3 space-y-2 text-sm text-amber-100"><p>{details.error} Le contenu enregistré et les notes restent disponibles.</p><Button type="button" variant="ghost" onClick={details.retry}>Réessayer</Button></div>;
  return null;
}

function ReportPreview({ content, rows, matches = [], matchIds = [] }) {
  return <div className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-black/[0.26] p-3 text-[0.82rem] leading-6 text-slate-100 shadow-inner shadow-black/35 sm:p-4 sm:text-sm sm:leading-7">{String(content || "").trim() ? renderReportContent(content, rows) : <p className="text-sm font-semibold text-slate-300">L’aperçu apparaîtra ici.</p>}</div>;
}

// V2 was fully editable: preserve its text, including corrections in the coaching block.
const REPORT_REWRITE_MARKER = "[NXT5_REPORT_V3]";

function stripGeneratedReportContent(content) {
  const text = String(content || "");
  const marker = /^\[NXT5_REPORT_V3\]\r?$/m.exec(text);
  if (!marker) {
    // Remove only the legacy structural separator, never its editable coaching text.
    return text.replace(/^\[NXT5_REPORT_V2\]\r?\n(?=Notes (?:précédentes|conservées|staff(?: conservées)?)[ \t]*:?(?:\r?\n|$))/m, "");
  }
  // Only the first generated boundary belongs to NXT5. Keep the notes verbatim.
  return text.slice(marker.index + marker[0].length)
    .replace(/^\r?\nNotes (?:précédentes|conservées|staff(?: conservées)?)[ \t]*:?(?:\r?\n|$)/i, "");
}

function reportRawGameLine(match) {
  const rows = (match.participants || []).filter((row) => row.team_key === "ALLY");
  const sum = (field) => rows.reduce((total, row) => total + Number(row[field] || 0), 0);
  const kills = sum("kills");
  const deaths = sum("deaths");
  const assists = sum("assists");
  const damage = sum("damage");
  const gold = sum("gold");
  const vision = sum("vision");
  const objectives = match.objective_score ? ` · Objectifs: ${match.objective_score}` : "";
  const core = `${matchDisplayName(match, "Adversaire inconnu")} · ${match.game_id || "Game ID"} · ${match.result || "Résultat ?"} · ${match.side || "Side ?"} · ${match.duration || "--:--"}`;
  if (!rows.length) return `${core} · Données joueurs absentes`;
  return `${core} · KDA ${kills}/${deaths}/${assists} · DMG ${formatPoints(damage)} · Gold ${formatPoints(gold)} · Vision ${vision}${objectives}`;
}

function reportRawSummaryLines(matches) {
  if (!matches.length) return ["Aucune game liée."];
  const rows = matches.flatMap((match) => (match.participants || []).filter((row) => row.team_key === "ALLY"));
  if (!rows.length) return ["Games liées, mais données joueurs absentes."];
  const sum = (field) => rows.reduce((total, row) => total + Number(row[field] || 0), 0);
  const wins = matches.filter((match) => match.result === "Victoire").length;
  const games = matches.length;
  return [
    `Games: ${games} · ${wins}W - ${games - wins}L · WR ${Math.round((wins / Math.max(1, games)) * 100)}%`,
    `KDA équipe: ${sum("kills")}/${sum("deaths")}/${sum("assists")}`,
    `Moyennes joueur/game: ${formatPoints(sum("damage") / Math.max(1, rows.length))} DMG · ${formatPoints(sum("gold") / Math.max(1, rows.length))} Gold · ${Math.round(sum("vision") / Math.max(1, rows.length))} Vision`,
  ];
}

function buildGameReviewContent(match) {
  if (!match) return "";
  const snapshot = matchCoachSnapshot(match);
  return [
    "VERDICT COACH",
    `- ${snapshot.verdict}`,
    "",
    `Game: ${matchDisplayName(match, "Game")}`,
    `Résultat: ${match.result || "Analyse"} · ${match.side || "Side ?"} · ${match.duration || "--:--"}`,
    `Données: ${timelineStatus(match).label} · ${timelineStatus(match).detail}`,
    "",
    "CAUSE RACINE",
    `- ${snapshot.title}`,
    `- ${snapshot.summary}`,
    `- Lane à review: ${snapshot.roleText}`,
    "",
    "STANDARD ATTENDU",
    `- ${snapshot.standard}`,
    "",
    "À GARDER",
    `- ${snapshot.keep}`,
    "",
    "À CORRIGER",
    `- ${snapshot.correct}`,
    "",
    "CHECKPOINTS VOD",
    ...snapshot.vodCheckpoints.map((item) => `- ${item}`),
    "",
    "LECTURE PAR JOUEUR",
    ...snapshot.playerReads.flatMap((player) => [
      `### ${player.role} · ${player.name}`,
      `- Catch : ${player.catchText}`,
      `- Exécution juste : ${player.goodText}`,
      `- ${player.laneText}`,
      `- WEAKSIDE : ${player.weakside}`,
      `- STRONGSIDE : ${player.strongside}`,
      "",
    ]),
    "PLAN D'EXÉCUTION",
    ...snapshot.executionPlan.map((item, index) => `- ${index + 1}. ${item}`),
    "",
    "VALIDATION",
    `- ${snapshot.validation}`,
    "",
    "QUESTIONS COACH",
    ...snapshot.coachQuestions.map((item) => `- ${item}`),
    "",
    "Repères",
    ...snapshot.metrics.map(([label, value, detail]) => `- ${label}: ${value} (${detail})`),
    "",
    REPORT_REWRITE_MARKER,
    "Notes staff",
    "",
  ].join("\n");
}

function buildArchiveReportContent(name, matches) {
  const linked = Array.isArray(matches) ? matches.filter(Boolean) : [];
  const gameLines = linked.length ? linked.map((match, index) => `${index + 1}. ${reportRawGameLine(match)}`).join("\n") : "Aucune game liée.";
  const wins = linked.filter((match) => match.result === "Victoire").length;
  const losses = linked.length - wins;
  return [
    "VERDICT COACH",
    `- Ce bloc affiche ${wins} victoire${wins > 1 ? "s" : ""} et ${losses} défaite${losses > 1 ? "s" : ""}. Le score ne suffit pas : la review doit isoler le pattern qui se répète et la décision qui l'alimente.`,
    "",
    `Groupe: ${name || "Groupe"}`,
    "",
    "CAUSE RACINE",
    ...reportRawSummaryLines(linked),
    "",
    "CHECKPOINTS VOD",
    "- Comparer la première transition de map des games : information disponible, call et coût de la décision.",
    "- Comparer les 60 secondes avant chaque objectif décisif : waves, resets, vision et responsabilité du setup.",
    "- Isoler une séquence gagnée et une séquence perdue sur le même thème pour séparer exécution et résultat.",
    "",
    "PLAN D'EXÉCUTION",
    "- 1. Nommer un seul standard collectif pour le prochain bloc.",
    "- 2. Désigner le joueur qui déclenche le call et celui qui le confirme.",
    "- 3. Revoir exactement le même indicateur après 3 games.",
    "",
    "VALIDATION",
    "- Validé si le call arrive avant l'action et si le même défaut ne se répète pas sur 3 games consécutives.",
    "",
    "REPÈRES",
    gameLines,
    "",
    ...linked.flatMap((match, index) => [
      `## GAME ${index + 1} · ${matchDisplayName(match, "Game")}`,
      buildGameReviewContent(match).split(REPORT_REWRITE_MARKER)[0].trim(),
      "",
    ]),
    REPORT_REWRITE_MARKER,
    "Notes staff",
    "",
  ].join("\n");
}

function buildRetroactiveCoachContent(report, matches, staffNotes = stripGeneratedReportContent(report?.content)) {
  const ids = [...new Set(reportMatchIds(report))];
  const linked = ids.map((id) => matches.find((match) => match.id === id)).filter(Boolean);
  // A partial block must never be presented or saved as the complete review.
  if (!ids.length || linked.length !== ids.length) return String(report?.content || "");
  const generated = linked.length === 1
    ? buildGameReviewContent(linked[0])
    : buildArchiveReportContent(reportDisplayName(report, matches, "Review de groupe"), linked);
  const coachingBlock = generated.split(REPORT_REWRITE_MARKER)[0].trim();
  return `${coachingBlock}\n\n${REPORT_REWRITE_MARKER}\nNotes staff\n${staffNotes}`;
}

function Reports({ data, selectedTeamId, refreshAll, pushToast, currentMember, user }) {
  const reports = (data.reports || []).filter((report) => report.team_id === selectedTeamId);
  const baseMatches = (data.matches || []).filter((match) => match.team_id === selectedTeamId);
  const archives = (data.matchArchives || []).filter((archive) => archive.team_id === selectedTeamId);
  const urlParams = new URLSearchParams(window.location.search);
  const urlReportId = urlParams.get("report") || "";
  const urlMatchId = urlParams.get("match") || "";
  const urlComposeReview = urlParams.get("compose") === "1";
  const { detail: requestedMatch, loading: loadingReviewMatch, error: reviewMatchError, retry: retryReviewMatch } = useMatchDetails(selectedTeamId, urlMatchId, data.bootstrapRevision || "");
  const canCaptainDelete = canStaffManage(currentMember?.role);
  const [form, setForm] = useState({ id: null, title: "", content: "", matchIds: [] });
  const [selectedArchiveId, setSelectedArchiveId] = useState("");
  const [selectedReportId, setSelectedReportId] = useState(urlReportId || null);
  const [lexiconOpen, setLexiconOpen] = useState(false);
  const [reportSearch, setReportSearch] = useState("");
  const deferredReportSearch = useDeferredValue(reportSearch);
  const [composerOpen, setComposerOpen] = useState(false);
  const [workspaceView, setWorkspaceView] = useState("library");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!composerOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    const previousDocumentOverflow = document.documentElement.style.overflow;
    const closeOnEscape = (event) => {
      if (event.key !== "Escape") return;
      setComposerOpen(false);
      setLexiconOpen(false);
      setForm({ id: null, title: "", content: "", matchIds: [] });
    };
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.documentElement.style.overflow = previousDocumentOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [composerOpen]);
  const selectedArchive = archives.find((archive) => archive.id === selectedArchiveId);
  const scopedReports = selectedArchive ? reports.filter((report) => reportMatchIds(report).some((id) => archiveMatchIds(selectedArchive).includes(id))) : reports;
  const selected = scopedReports.find((report) => report.id === selectedReportId) || scopedReports[0] || null;
  const activeReviewIds = composerOpen ? form.matchIds : selected ? reportMatchIds(selected) : [];
  const reviewDetails = useReviewMatchDetails(selectedTeamId, activeReviewIds, data.bootstrapRevision || "");
  const matches = [...new Map([...baseMatches, ...(requestedMatch ? [requestedMatch] : []), ...reviewDetails.matches].map((match) => [match.id, match])).values()];
  const scopedMatches = selectedArchive ? matches.filter((match) => archiveMatchIds(selectedArchive).includes(match.id)) : matches;
  const selectedContent = useMemo(() => selected && !composerOpen && reviewDetails.complete
    ? buildRetroactiveCoachContent(selected, reviewDetails.matches)
    : selected?.content || "", [selected, composerOpen, reviewDetails.complete, reviewDetails.matches]);
  const formCoaching = useMemo(() => composerOpen && reviewDetails.complete
    ? buildRetroactiveCoachContent({ title: form.title, content: "", match_ids: form.matchIds }, reviewDetails.matches, "")
    : "", [composerOpen, form.title, form.matchIds, reviewDetails.complete, reviewDetails.matches]);
  const formContent = formCoaching + form.content;
  const formCanSave = Boolean(selectedTeamId && (form.content.trim() || form.matchIds.length) && form.matchIds.length <= 20 && reviewDetails.complete);

  const selectedRows = selected ? reportRows(matches, reportMatchIds(selected)) : [];
  const formRows = reportRows(matches, form.matchIds);
  const canEditSelected = selected && (canCaptainDelete || selected.created_by === user?.id);
  const selectedMatchForReport = selected ? matches.find((match) => reportMatchIds(selected).includes(match.id) && (!urlMatchId || match.id === urlMatchId)) || matches.find((match) => reportMatchIds(selected).includes(match.id)) : null;
  const formDisplayTitle = reportTitleFromMatchIds(form.matchIds, matches, form.title || "Review");
  const reviewMatches = form.matchIds.length ? matches.filter((match) => form.matchIds.includes(match.id)) : [];
  const selectedMatchIds = selected ? reportMatchIds(selected) : [];
  const selectedStatsMatchId = selectedMatchForReport?.id || selectedMatchIds[0] || "";
  const selectedMatches = selected ? matches.filter((match) => selectedMatchIds.includes(match.id)) : [];
  const selectedGamesComplete = selectedMatchIds.length === selectedMatches.length;
  const reviewWins = reviewMatches.filter((match) => match.result === "Victoire").length;
  const selectedWins = selectedMatches.filter((match) => match.result === "Victoire").length;
  const pendingReviewCount = matches.filter((match) => String(match.review_status || "todo") !== "done").length;
  const searchNeedle = deferredReportSearch.trim().toLowerCase();
  const filteredReports = scopedReports.filter((report) => {
    if (!searchNeedle) return true;
    const title = reportDisplayName(report, matches).toLowerCase();
    const author = String(report.author_name || "").toLowerCase();
    return title.includes(searchNeedle) || author.includes(searchNeedle) || String(report.content || "").toLowerCase().includes(searchNeedle);
  });
  const selectionLabel = reviewMatches.length ? `${reviewWins}W - ${reviewMatches.length - reviewWins}L · ${Math.round((reviewWins / Math.max(1, reviewMatches.length)) * 100)}% WR` : "Aucune game sélectionnée";

  function startBlankReview() {
    resetReportForm();
    setComposerOpen(true);
    setLexiconOpen(false);
  }

  function startReviewFromMatch(match) {
    if (!match?.id) return;
    openAppPath(`/rapports?match=${encodeURIComponent(match.id)}&compose=1`);
  }

  function selectReport(report) {
    setSelectedReportId(report.id);
    window.history.replaceState({}, "", "/rapports?report=" + report.id);
  }

  function openQueuedReview(report) {
    setSelectedArchiveId("");
    setSelectedReportId(report.id);
    setWorkspaceView("library");
    window.history.replaceState({}, "", "/rapports?report=" + report.id);
  }

  function selectAllScopedMatches() {
    setForm((current) => ({ ...current, matchIds: scopedMatches.map((match) => match.id) }));
  }

  useEffect(() => {
    if (urlReportId && reports.some((report) => report.id === urlReportId)) setSelectedReportId(urlReportId);
    else if (urlMatchId) {
      const report = reports.find((item) => reportMatchIds(item).includes(urlMatchId));
      if (report) setSelectedReportId(report.id);
    }
  }, [urlReportId, urlMatchId, reports.map((report) => report.id).join("|")]);

  useEffect(() => {
    if (!urlComposeReview || !urlMatchId || !requestedMatch) return;
    setSelectedArchiveId("");
    setForm({ id: null, title: matchDisplayName(requestedMatch, "Review"), content: "", matchIds: [requestedMatch.id] });
    setComposerOpen(true);
    setLexiconOpen(false);
    window.history.replaceState({}, "", `/rapports?match=${encodeURIComponent(urlMatchId)}`);
  }, [urlComposeReview, urlMatchId, requestedMatch]);

  function toggleMatch(id) {
    setForm((current) => ({ ...current, matchIds: current.matchIds.includes(id) ? current.matchIds.filter((item) => item !== id) : [...current.matchIds, id] }));
  }

  function useArchiveForReport(archive) {
    const ids = archiveMatchIds(archive);
    setSelectedArchiveId((current) => current === archive.id ? "" : archive.id);
    setForm((current) => ({
      ...current,
      title: current.title || archive.name || "",
      matchIds: current.matchIds.length ? current.matchIds : ids,
    }));
  }

  function insertCommand(command) {
    setForm((current) => ({ ...current, content: `${current.content}${current.content.endsWith("\n") || !current.content ? "" : "\n"}${command}` }));
  }

  function editReport(report) {
    setForm({ id: report.id, title: reportDisplayName(report, matches), content: stripGeneratedReportContent(report.content), matchIds: reportMatchIds(report) });
    setComposerOpen(true);
    setLexiconOpen(false);
  }

  function duplicateReport(report) {
    setForm({ id: null, title: `${reportDisplayName(report, matches)} copie`, content: stripGeneratedReportContent(report.content), matchIds: reportMatchIds(report) });
    setComposerOpen(true);
    setLexiconOpen(false);
  }

  function resetReportForm() {
    setForm({ id: null, title: "", content: "", matchIds: [] });
  }

  function closeComposer() {
    setComposerOpen(false);
    setLexiconOpen(false);
    resetReportForm();
  }

  async function saveReport(event) {
    event.preventDefault();
    if (saving || !formCanSave) return;
    setSaving(true);
    try {
      const title = reportTitleFromMatchIds(form.matchIds, matches, form.title || "Review");
      await apiFetch("reports-manage", { method: "POST", body: JSON.stringify({ action: form.id ? "update" : "create", teamId: selectedTeamId, reportId: form.id, title, content: formContent, matchIds: form.matchIds }) });
      resetReportForm();
      setComposerOpen(false);
      setLexiconOpen(false);
      setWorkspaceView("library");
      await refreshAll();
      pushToast({ type: "green", title: form.id ? "Review mise à jour" : "Review créée", text: "Le contenu de review est enregistré." });
    } catch (err) {
      pushToast({ type: "red", title: "Enregistrement impossible", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function deleteReport(report) {
    const canDelete = canCaptainDelete || report.created_by === user?.id;
    if (!canDelete || !window.confirm("Supprimer cette review ?")) return;
    setSaving(true);
    try {
      await apiFetch("reports-manage", { method: "POST", body: JSON.stringify({ action: "delete", teamId: selectedTeamId, reportId: report.id }) });
      await refreshAll();
      pushToast({ type: "green", title: "Review supprimée", text: "La review a été retirée." });
    } catch (err) {
      pushToast({ type: "red", title: "Suppression impossible", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  const commands = [[`/KDA "ADC"`, "KDA moyen d’un rôle."], [`/DAMAGE "MID"`, "Dégâts moyens d’un rôle."], [`/VISION "SUP"`, "Vision moyenne d’un rôle."], [`/GOLD "JGL"`, "Gold moyen d’un rôle."], [`/KP "TOP"`, "Participation moyenne aux kills."], ["/TEAM KDA", "KDA moyen de l’équipe."], ["/TEAM DAMAGE", "Dégâts moyens par joueur."]];
  const noteTemplates = [
    ["Verdict", "## VERDICT COACH\n- Le fait décisif : \n- La décision attendue : "],
    ["Cause racine", "## CAUSE RACINE\n- Symptôme observé : \n- Décision qui crée le problème : \n- Information manquante : "],
    ["VOD", "## CHECKPOINTS VOD\n- Timestamp : contexte → décision → conséquence\n- Timestamp : contexte → décision → conséquence"],
    ["Joueur", "## LECTURE PAR JOUEUR\n### RÔLE · Joueur\n- Catch : timestamp + information disponible\n- Exécution juste : timestamp + décision à reproduire\n- WEAKSIDE : fenêtre + comportement attendu\n- STRONGSIDE : fenêtre + ressource à convertir"],
    ["Plan", "## PLAN D'EXÉCUTION\n- 1. Avant la game : \n- 2. En game : \n- 3. Après la game : "],
    ["Validation", "## VALIDATION\n- Réussi si : \n- Échec si : \n- Mesuré sur : 3 games"],
    ["Draft", "## Draft\n- Pick à sécuriser :\n- Ban prioritaire :\n- Réponse adverse : "],
  ];
  return (
    <div className="nxt5-data-dense min-w-0 overflow-hidden">
      <PageHeader
        eyebrow="Reviews"
        title="Review"
        subtitle="L’analyse des games liées est préparée automatiquement. Ajoute tes notes et les décisions du staff."
      >
        <Button icon={Plus} onClick={startBlankReview}>Créer une review</Button>
        <Button variant="ghost" icon={BarChart3} onClick={() => openAppPath("/games")}>Voir les stats</Button>
      </PageHeader>

      {urlComposeReview && (loadingReviewMatch || reviewMatchError) && <Surface className="mb-4"><p role="status">{loadingReviewMatch ? "Chargement de la game pour préparer la review…" : reviewMatchError}</p>{reviewMatchError && <Button type="button" className="mt-2" onClick={retryReviewMatch}>Réessayer</Button>}</Surface>}
      <TabNav className="mb-5" label="Sections Review" items={[
        { id: "library", label: "Bibliothèque", meta: reports.length, icon: FileText },
        { id: "queue", label: "À traiter", meta: pendingReviewCount, icon: Check },
      ]} activeId={workspaceView} onChange={setWorkspaceView} columns="sm:grid-cols-2" />

      {workspaceView === "queue" ? <ReviewQueuePanel matches={matches} reports={reports} selectedTeamId={selectedTeamId} refreshAll={refreshAll} pushToast={pushToast} onStartReview={startReviewFromMatch} onOpenReview={openQueuedReview} /> : <div className="grid gap-5 2xl:grid-cols-[minmax(20rem,25rem)_minmax(0,1fr)]">
        <aside className="min-w-0 overflow-hidden rounded-2xl border border-cyan-200/18 bg-[#070b17]/88 shadow-[0_18px_54px_rgba(0,0,0,.32)] backdrop-blur-2xl 2xl:sticky 2xl:top-4 2xl:self-start">
          <div className="border-b border-white/10 px-4 py-4 sm:px-5">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-200/18 bg-cyan-300/[0.07] text-cyan-100"><FileText className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <h3 className="text-xl font-black text-white">Bibliothèque</h3>
                  <span className="shrink-0 whitespace-nowrap text-xs font-black tabular-nums text-cyan-100">{reports.length} review{reports.length > 1 ? "s" : ""}</span>
                </div>
                <p className="mt-1 text-xs font-semibold leading-5 text-slate-400">Sélectionne une review pour l’ouvrir.</p>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <label className="flex h-11 items-center gap-2 border-b border-white/12 px-1 transition focus-within:border-cyan-200/55">
                <span className="sr-only">Chercher une review</span>
                <Search className="h-4 w-4 shrink-0 text-cyan-100/70" />
                <input value={reportSearch} onChange={(event) => setReportSearch(event.target.value)} placeholder="Rechercher par game ou auteur" className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-white outline-none placeholder:text-slate-500" />
              </label>
              <label className="relative block">
                <span className="sr-only">Filtrer par contexte</span>
                <select value={selectedArchiveId} onChange={(event) => setSelectedArchiveId(event.target.value)} className="h-10 w-full appearance-none border-0 bg-transparent px-1 pr-8 text-sm font-bold text-slate-200 outline-none transition hover:text-white focus:text-white">
                  <option value="">Toutes les reviews</option>
                  {archives.map((archive) => <option key={archive.id} value={archive.id}>{archive.name} · {archiveMatchIds(archive).length} games</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-1 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </label>
            </div>

            {(searchNeedle || selectedArchiveId) && <p className="mt-3 text-[0.68rem] font-bold text-slate-400"><span className="text-white">{filteredReports.length}</span> résultat{filteredReports.length > 1 ? "s" : ""} sur {reports.length}</p>}
          </div>

          <div className="nxt5-review-list max-h-[min(66vh,44rem)] overflow-y-auto overscroll-contain">
            {filteredReports.length ? filteredReports.map((report) => {
              const active = selected?.id === report.id;
              const ids = reportMatchIds(report);
              return <button key={report.id} type="button" aria-current={active ? "true" : undefined} onClick={() => selectReport(report)} className={cx("group/report relative grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-white/[0.075] px-4 py-3.5 text-left transition last:border-b-0 sm:px-5", active ? "bg-gradient-to-r from-cyan-400/14 via-cyan-300/[0.055] to-transparent" : "hover:bg-white/[0.045]")}>
                <span className={cx("absolute inset-y-2 left-0 w-0.5 rounded-r-full transition", active ? "bg-cyan-200 shadow-[0_0_14px_rgba(103,232,249,.9)]" : "bg-transparent group-hover/report:bg-cyan-200/35")} />
                <span className="min-w-0">
                  <span className={cx("block break-words text-sm font-black leading-5 transition", active ? "text-cyan-50" : "text-white group-hover/report:text-cyan-50")}>{reportDisplayName(report, matches)}</span>
                  <span className="mt-1.5 block truncate text-[0.7rem] font-semibold text-slate-400">{report.author_name || "NXT5"} · {new Date(report.updated_at || report.created_at).toLocaleDateString("fr-FR")}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5 pl-1">
                  <span className={cx("whitespace-nowrap text-[0.65rem] font-black tabular-nums", active ? "text-cyan-100" : "text-slate-400")}>{ids.length} game{ids.length > 1 ? "s" : ""}</span>
                  <ChevronRight className={cx("h-4 w-4 transition", active ? "translate-x-0.5 text-cyan-100" : "text-slate-600 group-hover/report:translate-x-0.5 group-hover/report:text-cyan-100")} />
                </span>
              </button>;
            }) : <div className="p-4"><EmptyState icon={FileText} title="Aucune review" text="Modifie la recherche ou crée une nouvelle review." /></div>}
          </div>
        </aside>

        <Surface glow={Boolean(selected)} className="p-5">
          {selected ? <>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <Badge tone="purple">Review active</Badge>
                <h3 className="mt-3 break-words text-3xl font-black text-white">{reportDisplayName(selected, matches)}</h3>
                <p className="mt-2 text-sm font-semibold text-slate-300">Par {selected.author_name || "NXT5"} · {selectedMatchIds.length} game{selectedMatchIds.length > 1 ? "s" : ""} liée{selectedMatchIds.length > 1 ? "s" : ""}</p>
              </div>
              <div className="flex flex-wrap gap-2 lg:max-w-[26rem] lg:justify-end">
                <Button variant="ghost" icon={ArrowRight} onClick={() => selectedStatsMatchId && openAppPath(`/games?match=${encodeURIComponent(selectedStatsMatchId)}`)} disabled={!selectedStatsMatchId}>Stats</Button>
                <Button variant="ghost" icon={RefreshCw} onClick={() => duplicateReport(selected)} disabled={saving}>Dupliquer</Button>
                {canEditSelected && <Button variant="ghost" icon={Clipboard} onClick={() => editReport(selected)} disabled={saving}>Éditer</Button>}
                {canEditSelected && <Button variant="ghost" icon={Trash2} onClick={() => deleteReport(selected)} disabled={saving}>Supprimer</Button>}
              </div>
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              <div className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2"><p className="text-[0.58rem] font-black uppercase tracking-[0.14em] text-slate-400">Games</p><p className="mt-1 text-lg font-black text-white">{selectedMatchIds.length}</p></div>
              <div className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2"><p className="text-[0.58rem] font-black uppercase tracking-[0.14em] text-slate-400">Record</p><p className="mt-1 text-lg font-black text-white">{selectedGamesComplete && selectedMatches.length ? `${selectedWins}W - ${selectedMatches.length - selectedWins}L` : "--"}</p></div>
              <div className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2"><p className="text-[0.58rem] font-black uppercase tracking-[0.14em] text-slate-400">WR</p><p className="mt-1 text-lg font-black text-white">{selectedGamesComplete && selectedMatches.length ? `${Math.round((selectedWins / Math.max(1, selectedMatches.length)) * 100)}%` : "--"}</p></div>
            </div>
            {!selectedGamesComplete && <p className="mt-3 text-xs text-amber-100">{selectedMatches.length} sur {selectedMatchIds.length} games liées chargées. Les games restantes sont chargées automatiquement pour compléter l’analyse.</p>}
            <div className="mt-5">
              <ReviewAnalysisStatus details={reviewDetails} />
              <ReportPreview content={selectedContent} rows={selectedRows} matches={matches} matchIds={reportMatchIds(selected)} />
            </div>
          </> : <EmptyState icon={FileText} title="Aucune review sélectionnée" text="Choisis une review dans la bibliothèque ou crée-en une nouvelle." />}
        </Surface>
      </div>}

      {composerOpen && createPortal(
        <div className="nxt5-fade-in fixed inset-0 z-[300] isolate flex items-end justify-center bg-[#020511]/94 backdrop-blur-xl sm:items-center sm:p-3 lg:p-5">
          <section role="dialog" aria-modal="true" aria-labelledby="review-composer-title" className="nxt5-enter-fast relative flex h-[100dvh] w-full min-w-0 flex-col overflow-hidden border border-cyan-200/24 bg-[#050814] shadow-[0_30px_120px_rgba(0,0,0,.82),0_0_54px_rgba(34,211,238,.16)] sm:h-auto sm:max-h-[calc(100dvh-1.5rem)] sm:max-w-[96rem] sm:rounded-[1.5rem]">
            <div className="pointer-events-none absolute inset-x-8 top-0 z-20 h-px bg-gradient-to-r from-transparent via-cyan-100/75 to-fuchsia-100/55" />
            <form onSubmit={saveReport} className="flex min-h-0 flex-1 flex-col">
              <div className="shrink-0 border-b border-white/10 bg-[#050814]/96 px-4 py-4 backdrop-blur-xl sm:px-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0"><Badge tone={form.id ? "yellow" : "green"}>{form.id ? "Modifier la review" : "Nouvelle review"}</Badge><h3 id="review-composer-title" className="mt-3 break-words text-2xl font-black text-white sm:text-3xl">{formDisplayTitle || "Créer une review"}</h3><p className="mt-1 text-sm font-semibold text-slate-300">L’analyse se complète avec les games liées. Ajoute les notes et les décisions du staff.</p></div>
                  <div className="flex flex-wrap gap-2 lg:justify-end"><Button type="button" variant="ghost" icon={Clipboard} onClick={() => setLexiconOpen((value) => !value)}>Commandes</Button><Button type="button" variant="ghost" icon={X} onClick={closeComposer}>Fermer</Button><Button type="submit" icon={saving ? Loader2 : form.id ? Check : Plus} disabled={saving || !formCanSave || !formDisplayTitle.trim()}>{form.id ? "Enregistrer" : "Créer"}</Button></div>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 sm:px-5 sm:pb-5">
                {lexiconOpen && <div className="mt-4 rounded-2xl border border-cyan-300/14 bg-cyan-400/[0.055] p-3"><div className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-4">{commands.map(([command, text]) => <button key={command} type="button" onClick={() => insertCommand(command)} className="rounded-xl border border-white/10 bg-black/22 p-3 text-left transition hover:border-cyan-300/25 hover:bg-cyan-400/10"><p className="font-mono text-sm font-black text-cyan-100">{command}</p><p className="mt-1 text-xs font-semibold text-slate-300">{text}</p></button>)}</div></div>}

                <div className="mt-4 grid gap-4 2xl:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)]">
              <div className="min-w-0 rounded-2xl border border-white/10 bg-black/20 p-3">
                <div className="flex items-start justify-between gap-3"><div><p className="text-[0.66rem] font-black uppercase tracking-[0.22em] text-slate-300">Games liées</p><p className="mt-1 text-xs font-semibold text-slate-400">{selectionLabel}</p></div><Badge tone={form.matchIds.length ? "cyan" : "slate"}>{form.matchIds.length}</Badge></div>
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1"><button type="button" onClick={() => setSelectedArchiveId("")} className={cx("shrink-0 rounded-xl border px-3 py-2 text-left text-xs font-black uppercase tracking-[0.12em] transition", !selectedArchiveId ? "border-cyan-300/35 bg-cyan-400/12 text-cyan-50" : "border-white/10 bg-white/[0.03] text-slate-300")}>Toutes</button>{archives.map((archive) => { const ids = archiveMatchIds(archive); const active = selectedArchiveId === archive.id; return <button key={archive.id} type="button" onClick={() => useArchiveForReport(archive)} className={cx("min-w-[140px] shrink-0 rounded-xl border px-3 py-2 text-left transition", active ? "border-purple-300/40 bg-purple-400/12 text-white" : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-purple-300/25")}><p className="truncate text-xs font-black text-white">{archive.name}</p><p className="mt-1 text-[0.58rem] font-black uppercase tracking-[0.12em] text-slate-400">{ids.length} game{ids.length > 1 ? "s" : ""}</p></button>; })}</div>
                <div className="mt-3 grid grid-cols-2 gap-2"><Button type="button" variant="ghost" icon={Check} onClick={selectAllScopedMatches} disabled={!scopedMatches.length}>Tout lier</Button><Button type="button" variant="ghost" icon={X} onClick={() => setForm((current) => ({ ...current, matchIds: [] }))} disabled={!form.matchIds.length}>Vider</Button></div>
                <div className="mt-3 max-h-[min(46vh,28rem)] space-y-2 overflow-auto pr-1">{scopedMatches.length ? scopedMatches.map((match) => { const checked = form.matchIds.includes(match.id); return <button key={match.id} type="button" onClick={() => toggleMatch(match.id)} className={cx("w-full rounded-xl border p-3 text-left transition", checked ? "border-cyan-300/40 bg-cyan-400/12" : "border-white/10 bg-white/[0.03] hover:border-cyan-300/22 hover:bg-white/[0.055]")}><div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="flex flex-wrap items-center gap-1.5"><Badge tone={match.result === "Victoire" ? "green" : match.result === "Défaite" ? "red" : "slate"}>{match.result || "Game"}</Badge>{checked && <Badge tone="cyan">Liée</Badge>}</div><p className="mt-2 truncate text-sm font-black text-white">{matchDisplayName(match)}</p><p className="mt-1 truncate text-xs font-semibold text-slate-400">{match.duration || "--:--"} · {match.side || "Side ?"}</p></div><span className={cx("mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border", checked ? "border-cyan-200 bg-cyan-300 text-slate-950" : "border-white/15 bg-black/30 text-transparent")}><Check className="h-3 w-3" /></span></div></button>; }) : <EmptyState icon={Swords} title="Aucune game" text="Importe une game ou retire le filtre actif." />}</div>
              </div>

              <div className="min-w-0 space-y-4">
                <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(12rem,14rem)]"><TextInput label="Titre de secours" value={form.title} onChange={(title) => setForm((current) => ({ ...current, title }))} placeholder="Ex: Review scrim bloc 2" icon={FileText} /><div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3"><p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-slate-400">Bilan sélection</p><p className="mt-2 text-xl font-black text-white">{reviewMatches.length ? `${reviewWins}W - ${reviewMatches.length - reviewWins}L` : "--"}</p><p className="mt-1 text-xs font-semibold text-slate-400">{reviewMatches.length ? `${Math.round((reviewWins / Math.max(1, reviewMatches.length)) * 100)}% winrate` : "Sélectionne des games"}</p></div></div>
                <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.78fr)]"><label className="block"><span className="mb-2 block text-[0.66rem] font-black uppercase tracking-[0.22em] text-slate-300">Notes staff</span><div className="mb-2 flex flex-wrap gap-2">{noteTemplates.map(([label, template]) => <button key={label} type="button" onClick={() => setForm((current) => ({ ...current, content: `${current.content}${current.content.endsWith("\n") || !current.content ? "" : "\n\n"}${template}` }))} className="rounded-xl border border-cyan-200/14 bg-cyan-300/[0.07] px-3 py-1.5 text-xs font-black uppercase tracking-[0.1em] text-cyan-50 transition hover:bg-cyan-300/14">{label}</button>)}</div><textarea value={form.content} onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))} placeholder={`Décisions\n- Ce qu'on garde\n- Ce qu'on corrige\n- Action pour la prochaine game\n\n/KDA "ADC"`} required={!form.matchIds.length} rows={18} className="min-h-[22rem] w-full resize-y rounded-2xl xl:min-h-[28rem] border border-cyan-300/14 bg-black/[0.28] px-4 py-3 text-sm font-semibold leading-6 text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/45" /></label><div className="min-w-0"><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><p className="text-[0.66rem] font-black uppercase tracking-[0.22em] text-slate-300">Preview live</p><Badge tone="slate">Live</Badge></div><ReviewAnalysisStatus details={reviewDetails} />{form.matchIds.length > 20 && <p role="alert" className="mb-3 text-sm text-amber-100">Une review peut lier au maximum 20 games. Retire des games pour enregistrer.</p>}<ReportPreview content={formContent} rows={formRows} matches={matches} matchIds={form.matchIds} /></div></div>
              </div>
                </div>
              </div>
            </form>
          </section>
        </div>,
        document.body
      )}
    </div>
  );
}

export { exportStatsPng, GameWorkspace, Matches, matchImportTitle, CategoryMultiSelect, JsonUploadProgress, ImportRoleHeader, ImportHistoryEditor, matchCategoriesForMatch, GAME_WORKSPACE_TABS, Statistics, MatchDataPanel, MetricCard, MetricSideMarker, metricSideMarkerMeta, winningSideForDiff, oppositeSideKey, matchTeamSideKey, timelineStatus, MatchTimelineReview, championKillEvents, timelineFrames, teamKeyFromTeamId, rowByParticipantId, teamGoldAtMinute, objectiveContext, timelineTeamLabel, formatSignedShort, timelinePhaseMeta, fightWindows, timelineTeamTone, timelineMilestones, importantBuildingEvents, buildingEvents, TimelineGoldCheckpoint, TimelineReadoutCard, TimelinePhaseColumn, TimelineEventCard, timelineGoldDiff, teamGoldAtTimestamp, killScoreAtTimestamp, TimelineEventGlyph, objectiveEventIcon, objectivePictogramType, objectiveDragonIconType, objectiveDragonElementKey, ObjectivePictogram, OBJECTIVE_ICON_SOURCES, ObjectiveFallbackIcon, RoleDiffPanel, roleDiffRows, DeathContextPanel, deathContext, DraftImpactPanel, GameSummaryPanel, GameMetricSignals, roleScore, MatchVersusOverview, formatCompactGoldDiff, ObjectiveHud, objectiveEventTone, objectiveTeamKeyForSide, objectiveSummaryHasData, ObjectiveTeamCard, objectiveDragonElement, VersusPlayerMini, LaneComparisonPanel, SideColumnHeader, MatchCoachBrief, matchCoachSnapshot, teamObjectiveScore, matchPlayerCoachReads, playerReviewName, playerSideTimings, archiveMatchIds, ScrimArchiveSummary, winningTeamForDiff, reportMatchIds, buildArchiveReportContent, REPORT_REWRITE_MARKER, reportRawGameLine, reportRawSummaryLines, Reports, ReviewQueuePanel, reportTitleFromMatchIds, reportDisplayName, reportRows, ReportPreview, renderReportContent, commandResult, roleRows, buildGameReviewContent, buildRetroactiveCoachContent, stripGeneratedReportContent };
