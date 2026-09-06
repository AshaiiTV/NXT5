import React, { useEffect, useState } from "react";
import { Activity, AlertTriangle, Check, Clipboard, Crown, Download, Eye, FileText, Flame, Gauge, Loader2, Shield, Swords, Target, Trophy, ArrowRight, ChevronDown, ChevronRight, RefreshCw, Search, ShieldCheck, BookOpen, BarChart3 } from "lucide-react";
import { apiFetch } from "../../api/client.js";
import { profilePathFromView, profileViewFromPath, openAppPath } from "../../app/routing.js";
import { Badge, Button, EmptyState, PageHeader, SelectInput, Surface, TabNav } from "../../components/ui/Core.jsx";
import { cx, tone } from "../../app/helpers.js";
import { matchDisplayName, matchHasCategory, opponentRoleRow, assetProxyUrl } from "../../utils/matches.js";
import { csAtMinute } from "../../utils/match-timeline.js";
import { useMatchDetails } from "../../hooks/useMatchDetails.js";
import { championDisplayName, championPortraitSources, sortPlayersByRole, canStaffManage, isGameplayRole, formatPoints, normalizeProfileRole, playerIntegratedRows, matchCategoryTone, CategoryFilter, itemSlots, parsePercent, teamRows, shareOfTeam, lazyNamed, loadNextPhase, COMP_ROLES, normalizeProfileKey, ChampionPortrait, matchImportDateLabel, ChampionBackdrop, championStyleTags, championStyleTone, tagLabel, formatGoldDiff, itemIconSources, statValue, creepScore, sumRows, HudIcon, summonerSpellIconSources, summonerSpellIds, trinketItemId, formatCountdown, matchTimelineFrames, rowParticipantId, DDRAGON_FALLBACK_VERSIONS, championKey, championAssetId, exportChampionTierListPng, championPoolStatus, CHAMPION_TIERS, championTierFrame, championTierColumnFrame, championTierColumnGlow, ChampionTierMark, championPoolStatusLabel, championPoolStatusTone } from "./workspace-shared.jsx";
import { roleLabel } from "./shell-shared.jsx";
import { PNG_THEME, pngAccent, pngFitText, pngWrapText, pngLine, pngPanel, pngBackground, pngHeader, pngFooter, pngLoadImage, pngImageCover, pngMetricStrip, pngDownload } from "../../utils/png-report.js";

const PlayerGoalsPanel = lazyNamed(loadNextPhase, "PlayerGoalsPanel");

const DDRAGON_VERSION = "16.16.1";

function towerDamage(row) {
  return Number(row?.damage_to_turrets ?? row?.damageToTurrets ?? row?.raw?.damageDealtToTurrets ?? row?.raw?.damageToTurrets ?? row?.raw?.damage_to_turrets ?? 0);
}

function profileLinkAuditRows(player, matches = [], players = []) {
  const playerRole = normalizeProfileRole(player?.role);
  if (!player?.id || !COMP_ROLES.includes(playerRole)) return [];

  const playerId = String(player.id);
  const riotKey = normalizeProfileKey(player.riot_id);
  const riotNameKey = normalizeProfileKey(String(player.riot_id || "").split("#")[0]);
  const linkedMatchKeys = new Set(playerIntegratedRows(player, matches).map((row) => String(row.match?.id || row.match?.game_id || "")));
  const playerById = new Map(players.map((item) => [String(item.id || ""), item]));

  return matches.flatMap((match) => {
    const matchKeyValue = String(match?.id || match?.game_id || "");
    if (linkedMatchKeys.has(matchKeyValue)) return [];

    const allies = (match?.participants || []).filter((row) => row.team_key === "ALLY");
    const identityRow = allies.find((row) => String(row.player_id || "") === playerId) || allies.find((row) => {
      const rowRiotKey = normalizeProfileKey(row.riot_id);
      const rowSummonerKey = normalizeProfileKey(row.summoner_name);
      const fullRiotMatch = Boolean(riotKey) && rowRiotKey === riotKey;
      const gameNameMatch = Boolean(riotNameKey) && (rowSummonerKey === riotNameKey || (!String(row.riot_id || "").includes("#") && rowRiotKey === riotNameKey));
      return fullRiotMatch || gameNameMatch;
    });
    const roleRow = allies.find((row) => normalizeProfileRole(row.role || row.raw?.teamPosition || row.raw?.individualPosition || row.raw?.lane) === playerRole);
    const row = identityRow || roleRow || null;
    const currentPlayer = row?.player_id ? playerById.get(String(row.player_id)) || null : null;
    const recordedRole = normalizeProfileRole(row?.role || row?.raw?.teamPosition || row?.raw?.individualPosition || row?.raw?.lane);
    let issue = "Participant introuvable dans cet import";
    if (row) {
      if (identityRow && recordedRole !== playerRole) issue = `Poste enregistré : ${roleLabel(recordedRole || "inconnu")}`;
      else if (currentPlayer && String(currentPlayer.id) !== playerId) issue = `Actuellement lié à ${currentPlayer.name}`;
      else if (!row.player_id) issue = "Aucun profil NXT5 lié";
      else issue = "Liaison à vérifier";
    }

    return [{
      match,
      row,
      roleRow,
      currentPlayer,
      recordedRole,
      identityMatched: Boolean(identityRow),
      issue,
    }];
  });
}

function ProfileLinkAuditPanel({ player, matches, issues, open, canRepair, repairingId, onToggle, onRepair }) {
  if (!player || !COMP_ROLES.includes(normalizeProfileRole(player.role)) || !matches.length) return null;
  const linkedGames = Math.max(0, matches.length - issues.length);
  const complete = issues.length === 0;
  return <section className={cx("mt-4 overflow-hidden border-y", complete ? "border-emerald-300/18 bg-emerald-400/[0.045]" : "border-amber-300/20 bg-amber-400/[0.055]")}>
    <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span className={cx("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border", complete ? "border-emerald-300/24 bg-emerald-400/10 text-emerald-100" : "border-amber-300/24 bg-amber-400/10 text-amber-100")}>
          {complete ? <Check className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-black text-white">{complete ? "Toutes les games sont reliées" : `${issues.length} game${issues.length > 1 ? "s" : ""} à vérifier`}</p>
          <p className="mt-0.5 text-xs font-semibold text-slate-300">{matches.length} games équipe · {linkedGames} reliées à {player.name}</p>
        </div>
      </div>
      {!complete && <Button type="button" variant="ghost" icon={open ? ChevronDown : ChevronRight} onClick={onToggle}>{open ? "Masquer" : "Voir les games"}</Button>}
    </div>
    {open && !complete && <div className="border-t border-white/10">
      {issues.map((item) => {
        const row = item.row;
        const account = row?.riot_id || row?.summoner_name || "Compte non identifié";
        const repairing = repairingId === row?.id;
        return <div key={item.match.id || item.match.game_id} className="grid gap-3 border-b border-white/[0.07] px-4 py-3 last:border-b-0 lg:grid-cols-[minmax(0,1fr)_minmax(180px,.55fr)_auto] lg:items-center">
          <div className="flex min-w-0 items-center gap-3">
            {row ? <ChampionPortrait row={row} champion={row.champion} alt={row.champion} className="h-11 w-11 shrink-0 rounded-xl object-cover" /> : <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/20 text-slate-400"><Swords className="h-4 w-4" /></span>}
            <div className="min-w-0"><p className="truncate text-sm font-black text-white">{matchDisplayName(item.match)}</p><p className="mt-1 truncate text-xs font-semibold text-slate-400">{matchImportDateLabel(item.match)} · {item.match.duration || "--:--"}{row?.champion ? ` · ${championDisplayName(row.champion)}` : ""}</p></div>
          </div>
          <div className="min-w-0"><p className="truncate text-xs font-black text-slate-100">{account}</p><p className="mt-1 truncate text-xs font-semibold text-amber-100/80">{item.issue}</p></div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            <Button type="button" variant="ghost" icon={ArrowRight} onClick={() => openAppPath(`/statistiques?match=${encodeURIComponent(item.match.id)}`)}>Ouvrir</Button>
            {canRepair && row && <Button type="button" icon={repairing ? Loader2 : RefreshCw} disabled={Boolean(repairingId)} onClick={() => onRepair(item)}>{repairing ? "Correction..." : `Attribuer à ${player.name}`}</Button>}
            {!canRepair && <Badge tone="slate">Lecture seule</Badge>}
          </div>
        </div>;
      })}
    </div>}
  </section>;
}

function PlayerUltimateProfile({ data, selectedTeamId, currentMember, user, refreshAll, pushToast, route, navigate }) {
  const players = sortPlayersByRole((data.players || []).filter((player) => player.team_id === selectedTeamId && isGameplayRole(player.role)));
  const matches = (data.matches || []).filter((match) => match.team_id === selectedTeamId);
  const matchCategories = (data.matchCategories || []).filter((category) => category.team_id === selectedTeamId);
  const canObserveAll = true;
  const linkedPlayer = players.find((player) => player.user_id === user?.id);
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [profileView, setProfileView] = useState(() => profileViewFromPath(route?.path || window.location.pathname));
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedProfileChampion, setSelectedProfileChampion] = useState("");
  const [coachingContent, setCoachingContent] = useState("");
  const [savingCoaching, setSavingCoaching] = useState(false);
  const [profileLinkAuditOpen, setProfileLinkAuditOpen] = useState(false);
  const [repairingProfileLinkId, setRepairingProfileLinkId] = useState("");
  useEffect(() => {
    const requestedPlayerId = new URLSearchParams(window.location.search || "").get("player") || "";
    const requestedPlayer = players.find((player) => String(player.id || "") === String(requestedPlayerId));
    const fallback = requestedPlayer?.id || linkedPlayer?.id || players[0]?.id;
    if (!selectedPlayerId || !players.some((player) => player.id === selectedPlayerId)) setSelectedPlayerId(fallback || "");
  }, [linkedPlayer?.id, players.map((player) => player.id).join("|"), selectedPlayerId]);
  useEffect(() => {
    setSelectedProfileChampion("");
    setProfileLinkAuditOpen(false);
  }, [selectedPlayerId, selectedCategoryId]);
  useEffect(() => {
    setSelectedCategoryId("");
  }, [selectedTeamId]);
  useEffect(() => {
    setProfileView(profileViewFromPath(route?.path || window.location.pathname));
  }, [route?.path]);
  function openProfileView(viewId) {
    const nextView = profileView === viewId ? "overview" : viewId;
    setProfileView(nextView);
    navigate?.(`${profilePathFromView(nextView)}${route?.search || window.location.search || ""}`);
  }
  function selectProfile(playerId) {
    setSelectedPlayerId(playerId);
    const params = new URLSearchParams(window.location.search || "");
    params.set("player", playerId);
    navigate?.(`${window.location.pathname}?${params.toString()}`, { replace: true });
  }
  const selectedPlayer = players.find((player) => player.id === selectedPlayerId) || linkedPlayer || players[0];
  const coachingNote = (data.profileCoachingNotes || []).find((note) => note.team_id === selectedTeamId && note.player_id === selectedPlayer?.id);
  const canEditCoaching = canObserveAll;
  useEffect(() => {
    setCoachingContent(coachingNote?.content || "");
  }, [selectedPlayerId, coachingNote?.content]);
  const filteredMatches = selectedCategoryId ? matches.filter((match) => matchHasCategory(match, selectedCategoryId)) : matches;
  const activeProfileCategory = matchCategories.find((category) => String(category.id || "") === String(selectedCategoryId || ""));
  const rows = selectedPlayer ? playerIntegratedRows(selectedPlayer, filteredMatches) : [];
  const games = rows.length;
  const profileLinkIssues = selectedPlayer ? profileLinkAuditRows(selectedPlayer, filteredMatches, players) : [];
  const selectedTeam = (data.teams || []).find((team) => String(team.id || "") === String(selectedTeamId || ""));
  const canRepairProfileLinks = selectedTeam?.owner_id === user?.id || canStaffManage(currentMember?.role);
  const wins = rows.filter((row) => row.match?.result === "Victoire").length;
  const losses = Math.max(0, games - wins);
  const sum = (field) => rows.reduce((total, row) => total + Number(row[field] || 0), 0);
  const avg = (field, decimals = 1) => (sum(field) / Math.max(1, games)).toFixed(decimals);
  const kda = ((sum("kills") + sum("assists")) / Math.max(1, sum("deaths"))).toFixed(2);
  const championPool = (data.championPool || []).filter((row) => row.team_id === selectedTeamId && (row.player_id === selectedPlayer?.id || row.player_name === selectedPlayer?.name));
  const championStats = Array.from(rows.reduce((map, row) => {
    const key = row.champion || "Champion";
    const current = map.get(key) || { champion: key, rows: [], games: 0, wins: 0, kills: 0, deaths: 0, assists: 0, damage: 0, vision: 0, gold: 0, csPerMin: 0, kp: 0 };
    current.rows.push(row);
    current.games += 1;
    current.wins += row.match?.result === "Victoire" ? 1 : 0;
    current.kills += Number(row.kills || 0);
    current.deaths += Number(row.deaths || 0);
    current.assists += Number(row.assists || 0);
    current.damage += Number(row.damage || 0);
    current.vision += Number(row.vision || 0);
    current.gold += Number(row.gold || 0);
    current.csPerMin += Number(row.cs_per_min || 0);
    current.kp += parsePercent(row.kill_participation || row.kp || 0);
    map.set(key, current);
    return map;
  }, new Map()).values()).map((stat) => ({ ...stat, winrate: Math.round((stat.wins / Math.max(1, stat.games)) * 100), kda: ((stat.kills + stat.assists) / Math.max(1, stat.deaths)).toFixed(2) })).sort((a, b) => b.games - a.games || b.winrate - a.winrate);
  const activeProfileChampion = selectedProfileChampion || championStats[0]?.champion || "";
  const selectedProfileChampionStats = championStats.find((stat) => stat.champion === activeProfileChampion) || null;
  const selectedProfileChampionRows = selectedProfileChampionStats?.rows || [];
  const selectedProfileChampionMatchups = Array.from(selectedProfileChampionRows.reduce((map, row) => {
    const enemy = opponentRoleRow(row.match, row.role || selectedPlayer?.role, row.raw?.participantId || row.participantId);
    const champion = enemy?.champion || "Adversaire";
    const current = map.get(champion) || { champion, games: 0, wins: 0, kills: 0, deaths: 0, assists: 0, damage: 0, vision: 0 };
    current.games += 1;
    current.wins += row.match?.result === "Victoire" ? 1 : 0;
    current.kills += Number(row.kills || 0);
    current.deaths += Number(row.deaths || 0);
    current.assists += Number(row.assists || 0);
    current.damage += Number(row.damage || 0);
    current.vision += Number(row.vision || 0);
    map.set(champion, current);
    return map;
  }, new Map()).values()).map((item) => ({ ...item, losses: Math.max(0, item.games - item.wins), winrate: Math.round((item.wins / Math.max(1, item.games)) * 100), kda: ((item.kills + item.assists) / Math.max(1, item.deaths)).toFixed(2), avgDamage: item.damage / Math.max(1, item.games), avgVision: item.vision / Math.max(1, item.games) })).sort((a, b) => b.games - a.games || b.winrate - a.winrate);
  const matchups = Array.from(rows.reduce((map, row) => {
    const enemy = opponentRoleRow(row.match, row.role || selectedPlayer?.role, row.raw?.participantId || row.participantId);
    if (!enemy?.champion) return map;
    const key = enemy.champion;
    const current = map.get(key) || { champion: key, games: 0, wins: 0, kills: 0, deaths: 0, assists: 0, damage: 0, rows: [] };
    current.games += 1;
    current.wins += row.match?.result === "Victoire" ? 1 : 0;
    current.kills += Number(row.kills || 0);
    current.deaths += Number(row.deaths || 0);
    current.assists += Number(row.assists || 0);
    current.damage += Number(row.damage || 0);
    current.rows.push({ row, enemy });
    map.set(key, current);
    return map;
  }, new Map()).values()).map((item) => ({ ...item, losses: Math.max(0, item.games - item.wins), winrate: Math.round((item.wins / Math.max(1, item.games)) * 100), kda: ((item.kills + item.assists) / Math.max(1, item.deaths)).toFixed(2) })).sort((a, b) => b.games - a.games || b.winrate - a.winrate);
  const bestMatchups = matchups.filter((item) => item.games >= 1).slice().sort((a, b) => b.winrate - a.winrate || b.games - a.games).slice(0, 5);
  const worstMatchups = matchups.filter((item) => item.games >= 1).slice().sort((a, b) => a.winrate - b.winrate || b.games - a.games).slice(0, 5);
  const bangers = championStats.filter((stat) => stat.games >= 1).slice().sort((a, b) => (b.winrate * 2 + Number(b.kda) * 12 + b.games * 3) - (a.winrate * 2 + Number(a.kda) * 12 + a.games * 3)).slice(0, 3);
  const flops = championStats.filter((stat) => stat.games >= 1).slice().sort((a, b) => (a.winrate * 2 + Number(a.kda) * 12 - a.games * 2) - (b.winrate * 2 + Number(b.kda) * 12 - b.games * 2)).slice(0, 3);
  const avgDeaths = Number(avg("deaths"));
  const avgKills = Number(avg("kills"));
  const avgAssists = Number(avg("assists"));
  const avgKp = rows.reduce((total, row) => total + parsePercent(row.kill_participation || row.kp || 0), 0) / Math.max(1, games);
  const avgDamageShare = rows.reduce((total, row) => total + shareOfTeam(row, teamRows(row.match, "ALLY"), "damage"), 0) / Math.max(1, games);
  const avgGoldShare = rows.reduce((total, row) => total + shareOfTeam(row, teamRows(row.match, "ALLY"), "gold"), 0) / Math.max(1, games);
  const avgVisionShare = rows.reduce((total, row) => total + shareOfTeam(row, teamRows(row.match, "ALLY"), "vision"), 0) / Math.max(1, games);
  const avgDeathShare = rows.reduce((total, row) => total + shareOfTeam(row, teamRows(row.match, "ALLY"), "deaths"), 0) / Math.max(1, games);
  const damageResourceDelta = avgDamageShare - avgGoldShare;
  const topChampion = championStats[0];
  const topChampionShare = topChampion ? Math.round((topChampion.games / Math.max(1, games)) * 100) : 0;
  const sortedProfileRows = rows.slice().sort((a, b) => String(b.match?.created_at || b.match?.game_date || b.match?.game_id || "").localeCompare(String(a.match?.created_at || a.match?.game_date || a.match?.game_id || "")));
	  const avgRows = (items, getter, decimals = 1) => (items.reduce((total, item) => total + Number(getter(item) || 0), 0) / Math.max(1, items.length)).toFixed(decimals);
	  const globalCs = csMilestoneSummary(rows);
	  const avgCsPerMin = Number(avgRows(rows, (row) => row.cs_per_min));
	  const roleKey = normalizeProfileRole(selectedPlayer?.role);
  const roleRowsAll = filteredMatches.flatMap((match) => (match.participants || []).filter((row) => row.team_key === "ALLY" && normalizeProfileRole(row.role || row.raw?.teamPosition || row.raw?.individualPosition || row.raw?.lane) === roleKey).map((row) => ({ ...row, match })));
  const roleReferenceRows = roleRowsAll.filter((row) => !rows.some((item) => item.id === row.id));
  const benchmarkRows = roleReferenceRows.length ? roleReferenceRows : roleRowsAll;
  const benchmarkCs = csMilestoneSummary(benchmarkRows);
  const benchmarkKp = Number(avgRows(benchmarkRows, (row) => parsePercent(row.kill_participation || row.kp || 0), 0));
  const benchmarkDeaths = Number(avgRows(benchmarkRows, (row) => row.deaths));
	  const benchmarkDamageShare = benchmarkRows.reduce((total, row) => total + shareOfTeam(row, teamRows(row.match, "ALLY"), "damage"), 0) / Math.max(1, benchmarkRows.length);
	  const benchmarkGoldShare = benchmarkRows.reduce((total, row) => total + shareOfTeam(row, teamRows(row.match, "ALLY"), "gold"), 0) / Math.max(1, benchmarkRows.length);
	  const benchmarkResourceDelta = benchmarkDamageShare - benchmarkGoldShare;
	  const cs20Values = rows.map((row) => csAtMinute(row, 20)).filter((value) => Number.isFinite(value));
	  const benchmarkCs10Delta = benchmarkCs.samples ? Number(globalCs.at10 || 0) - Number(benchmarkCs.at10 || 0) : null;
	  const benchmarkCs20Delta = benchmarkCs.samples ? Number(globalCs.at20 || 0) - Number(benchmarkCs.at20 || 0) : null;
	  const roleKpDelta = benchmarkRows.length ? avgKp - benchmarkKp : null;
	  const roleDeathDelta = benchmarkRows.length ? avgDeaths - benchmarkDeaths : null;
	  const cs10Target = { TOP: 70, MID: 72, ADC: 74, JGL: 56, SUP: null }[normalizeProfileRole(selectedPlayer?.role)] ?? null;
	  const cs10Values = rows.map((row) => csAtMinute(row, 10)).filter((value) => Number.isFinite(value));
	  const lowCs10Count = cs10Target ? cs10Values.filter((value) => value < cs10Target - 8).length : 0;
	  const highDeathRows = rows.filter((row) => Number(row.deaths || 0) >= Math.max(4, Math.ceil(avgDeaths + 1)));
	  const lowKpRows = rows.filter((row) => parsePercent(row.kill_participation || row.kp || 0) < 50);
	  const lowCsRows = cs10Target ? rows.filter((row) => { const value = csAtMinute(row, 10); return Number.isFinite(value) && value < cs10Target - 8; }) : [];
	  const reviewRows = sortedProfileRows.filter((row) => highDeathRows.includes(row) || lowKpRows.includes(row) || lowCsRows.includes(row)).slice(0, 3);
	  const worstDeathRow = rows.slice().sort((a, b) => Number(b.deaths || 0) - Number(a.deaths || 0))[0];
	  const worstKpRow = rows.slice().sort((a, b) => parsePercent(a.kill_participation || a.kp || 0) - parsePercent(b.kill_participation || b.kp || 0))[0];
	  const worstCs10Row = rows
	    .map((row) => ({ row, value: csAtMinute(row, 10), enemy: opponentRoleRow(row.match, row.role || selectedPlayer?.role, row.raw?.participantId || row.participantId) }))
	    .map((item) => ({ ...item, enemyValue: item.enemy ? csAtMinute({ ...item.enemy, match: item.row.match }, 10) : null }))
	    .filter((item) => Number.isFinite(item.value) && Number.isFinite(item.enemyValue))
	    .sort((a, b) => (a.value - a.enemyValue) - (b.value - b.enemyValue))[0];
	  const roleCoachLens = {
	    TOP: { lane: "jouer les deux premières waves pour garder le contrôle du bounce", fight: "annoncer TP ou absence de TP 70s avant objectif", vision: "poser une ward profonde uniquement quand la wave est fixée", draft: "prioriser un pick qui tient weakside si le plan équipe joue bot" },
	    JGL: { lane: "verrouiller le premier clear et annoncer le premier move avant 3:15", fight: "lier chaque fight à un objectif ou à une wave prenable", vision: "poser la vision d'entrée 45s avant drake/grubs, pas au spawn", draft: "séparer les picks tempo des picks scaling dans les reviews" },
	    MID: { lane: "transformer la prio wave en move river ou en reset tempo", fight: "arriver au fight avec la wave déjà neutralisée", vision: "warder un côté fort puis jouer autour de ce côté", draft: "garder au moins un champion prio lane et un champion contrôle" },
	    ADC: { lane: "sécuriser les resets canon et éviter les trades sans wave favorable", fight: "jouer le premier fight autour de la distance max et du peel disponible", vision: "demander la ligne de vision avant de toucher mid T1 ou drake", draft: "distinguer les picks carry ressources des picks utilitaires" },
	    SUP: { lane: "lier chaque roam à une wave bot crash ou un timer reset adverse", fight: "entrer en fight seulement si le carry peut suivre ou si la cible est isolée", vision: "placer le premier setup objectif avant le reset de contrôle", draft: "préparer un engage et un pick peel selon le plan ADC" },
	  }[roleKey] || { lane: "clarifier le plan de lane", fight: "clarifier la présence en fight", vision: "clarifier la routine vision", draft: "clarifier le rôle en draft" };
	  const championName = (stat) => stat?.champion ? championDisplayName(stat.champion) : "le champion principal";
	  const matchName = (row) => row?.match ? matchDisplayName(row.match, "la game ciblée") : "la game ciblée";
	  const coachComparisons = [
	    { label: "CS10 vs poste", value: globalCs.at10 ?? "-", detail: benchmarkCs.samples ? `${Number(globalCs.at10 || 0) - Number(benchmarkCs.at10 || 0) >= 0 ? "+" : ""}${Number(globalCs.at10 || 0) - Number(benchmarkCs.at10 || 0)} vs réf.` : cs10Target ? `cible ${cs10Target}` : "réf. indisponible", toneName: benchmarkCs.samples ? Number(globalCs.at10 || 0) >= Number(benchmarkCs.at10 || 0) ? "green" : "orange" : "slate", icon: Target },
	    { label: "KP vs poste", value: `${Math.round(avgKp)}%`, detail: benchmarkRows.length ? (avgKp >= benchmarkKp ? "au-dessus de la réf." : "sous la réf.") : "réf. indisponible", toneName: !benchmarkRows.length || avgKp >= benchmarkKp ? "cyan" : "yellow", icon: Swords },
	    { label: "Morts vs poste", value: avgDeaths.toFixed(1), detail: benchmarkRows.length ? `${(avgDeaths - benchmarkDeaths) >= 0 ? "+" : ""}${(avgDeaths - benchmarkDeaths).toFixed(1)} vs réf.` : "réf. indisponible", toneName: !benchmarkRows.length || avgDeaths <= benchmarkDeaths ? "green" : "red", icon: Shield },
	    { label: "Rendement ressources", value: `${avgDamageShare.toFixed(1)}%`, detail: `${avgGoldShare.toFixed(1)}% de l'or équipe`, toneName: !benchmarkRows.length || damageResourceDelta >= benchmarkResourceDelta ? "green" : "orange", icon: Gauge },
	  ];
	  const coachSignals = [
	    games < 3 && { kind: "issue", priority: 98, title: "Volume trop faible", text: `${games} game${games > 1 ? "s" : ""} seulement : le bon angle est de formuler une hypothèse, pas une conclusion.`, action: `Prochaine review : choisir un seul test mesurable pour ${roleLabel(roleKey)} (${roleCoachLens.lane}) et le recontrôler après 3 games.`, toneName: "slate", icon: AlertTriangle },
	    cs10Target && globalCs.samples > 0 && Number(globalCs.at10 || 0) < cs10Target - 8 && { kind: "issue", priority: 94, title: "Lane trop coûteuse avant 10", text: `CS10 moyen ${globalCs.at10} pour une cible ${cs10Target}. Le problème prioritaire n'est pas le farm final, c'est le plan des trois premières waves.`, action: worstCs10Row ? `Ouvrir ${matchName(worstCs10Row.row)} : ${championDisplayName(worstCs10Row.row.champion)} est à ${worstCs10Row.value - worstCs10Row.enemyValue} CS au CS10. Revoir matchup, wave 1-3 et premier reset.` : `En scrim : ${roleCoachLens.lane}, puis noter CS10 + reset timing.`, toneName: "orange", icon: Target },
	    benchmarkCs.samples && benchmarkCs20Delta < -14 && { kind: "issue", priority: 90, title: "La lane ne se répare pas au midgame", text: `CS20 ${globalCs.at20 ?? "-"} (${benchmarkCs20Delta} vs référence du poste). Le retard continue après la lane, donc le problème est aussi sur les resets et la collecte side/mid.`, action: `Sur les 2 prochaines games : call explicite du prochain catch de wave avant chaque objectif, puis vérifier si le CS20 repasse au-dessus de ${Number(benchmarkCs.at20 || 0)}.`, toneName: "orange", icon: Target },
	    avgDeathShare > 24 && { kind: "issue", priority: 88, title: "Exposition qui coûte les fights", text: `${avgDeaths.toFixed(1)} morts moy. et ${avgDeathShare.toFixed(1)}% des morts équipe. Le joueur prend trop souvent la mort qui rend le setup injouable.`, action: worstDeathRow ? `Review ${matchName(worstDeathRow)} : ${Number(worstDeathRow.deaths || 0)} morts sur ${championDisplayName(worstDeathRow.champion)}. Classer chaque mort : wave, vision, greed ou fight forcé.` : `En review : isoler les morts 90s avant objectif et décider si la règle doit être "reset" ou "pas de facecheck".`, toneName: "red", icon: Shield },
	    avgKp < 55 && { kind: "issue", priority: 84, title: "Connexion fights insuffisante", text: `${Math.round(avgKp)}% KP moyen${Number.isFinite(roleKpDelta) ? ` (${roleKpDelta >= 0 ? "+" : ""}${roleKpDelta.toFixed(0)} vs poste)` : ""}. Le joueur est trop souvent hors du fight utile ou arrive après la conversion.`, action: worstKpRow ? `Ouvrir ${matchName(worstKpRow)} : KP ${Math.round(parsePercent(worstKpRow.kill_participation || worstKpRow.kp || 0))}% sur ${championDisplayName(worstKpRow.champion)}. Revoir le move juste avant les 2 premiers objectifs.` : `Prochain bloc : annoncer 30s avant objectif "je peux fight / je dois catch / je dois reset".`, toneName: "yellow", icon: Swords },
	    damageResourceDelta < -4 && { kind: "issue", priority: 80, title: "Ressources mal converties", text: `${avgDamageShare.toFixed(1)}% des dégâts pour ${avgGoldShare.toFixed(1)}% de l'or équipe. L'équipe investit plus que ce que le profil transforme en pression.`, action: `Draft/review : si ${championName(topChampion)} reçoit les ressources, définir l'objectif de conversion avant 14:00 : plaque, drake, Herald/grubs ou tempo mid.`, toneName: "orange", icon: Gauge },
	    avgVisionShare < 17 && { kind: "issue", priority: 72, title: "Vision sans impact visible", text: `${avgVisionShare.toFixed(1)}% de la vision équipe. Le sujet n'est pas juste le score de vision : il faut vérifier si les wards protègent le prochain move du rôle.`, action: `Prochain scrim : ${roleCoachLens.vision}. En review, garder uniquement les wards qui ont créé un fight, évité une mort ou sécurisé un objectif.`, toneName: "purple", icon: Eye },
	    topChampionShare >= 65 && championStats.length > 1 && { kind: "issue", priority: 68, title: "Draft trop lisible", text: `${championDisplayName(topChampion.champion)} représente ${topChampionShare}% des games. Le joueur a peut-être un bon confort, mais le plan devient facile à cibler.`, action: `Préparer une alternative de même fonction que ${championDisplayName(topChampion.champion)} et une alternative opposée : ${roleCoachLens.draft}.`, toneName: "yellow", icon: Crown },
	    avgDamageShare >= avgGoldShare + 3 && { kind: "strength", priority: 78, title: "Impact rentable", text: `${avgDamageShare.toFixed(1)}% dégâts pour ${avgGoldShare.toFixed(1)}% gold : le joueur convertit bien les ressources reçues.`, action: `À maintenir : continuer à lui donner les mêmes timings de ressources quand la draft demande du carry ${roleLabel(roleKey)}.`, toneName: "green", icon: Flame },
	    avgKp >= 65 && { kind: "strength", priority: 74, title: "Présence fights solide", text: `${Math.round(avgKp)}% KP moyen : le joueur est connecté aux kills utiles et participe aux conversions.`, action: `À pousser : utiliser cette présence pour caller plus tôt le prochain objectif après kill, surtout quand ${championName(topChampion)} est joué.`, toneName: "cyan", icon: Swords },
	    avgDeathShare <= 18 && games >= 3 && { kind: "strength", priority: 70, title: "Profil stable sous pression", text: `${avgDeaths.toFixed(1)} morts moy. et faible exposition relative. Il garde assez souvent la game jouable.`, action: `À conserver : ne pas le forcer dans des engages sans information ; construire autour de sa capacité à rester vivant jusqu'au fight clé.`, toneName: "green", icon: Shield },
	    avgVisionShare >= 22 && { kind: "strength", priority: 64, title: "Bonne présence sur la map", text: `${avgVisionShare.toFixed(1)}% de la vision de l’équipe.`, action: `À préciser : annoncer "on entre / on trade / on abandonne" avant les objectifs.`, toneName: "cyan", icon: Eye },
	    topChampion && topChampion.winrate >= 55 && { kind: "strength", priority: 62, title: "Pick de confiance identifié", text: `${championDisplayName(topChampion.champion)} : ${topChampion.winrate}% WR sur ${topChampion.games} game${topChampion.games > 1 ? "s" : ""}, KDA ${topChampion.kda}.`, action: `Draft : garder ${championDisplayName(topChampion.champion)} comme référence, mais noter dans quelles lanes/matchups il gagne vraiment son avantage.`, toneName: "green", icon: Crown },
	  ].filter(Boolean).sort((a, b) => b.priority - a.priority);
	  const coachIssues = coachSignals.filter((item) => item.kind === "issue").slice(0, 4);
	  const coachStrengths = coachSignals.filter((item) => item.kind === "strength").slice(0, 3);
	  const coachDecisions = [
	    { label: "Angle prioritaire", text: coachIssues[0]?.title || coachStrengths[0]?.title || "Stabiliser le rôle", toneName: coachIssues[0]?.toneName || coachStrengths[0]?.toneName || "cyan" },
	    { label: "Consigne scrim", text: coachIssues[0]?.action || coachStrengths[0]?.action || roleCoachLens.lane, toneName: coachIssues[0]?.toneName || "green" },
	    { label: "Pick à valoriser", text: bangers[0] ? championDisplayName(bangers[0].champion) : topChampion ? championDisplayName(topChampion.champion) : "À confirmer", toneName: "green" },
	    { label: "Pick / matchup à revoir", text: flops[0] ? championDisplayName(flops[0].champion) : worstMatchups[0] ? `vs ${championDisplayName(worstMatchups[0].champion)}` : "Aucune alerte", toneName: flops[0] || worstMatchups[0] ? "red" : "slate" },
	  ];
	  const coachActions = [
	    ...(coachIssues[0] ? [coachIssues[0].action] : [coachStrengths[0]?.action || `Conserver la base actuelle, puis contrôler ${roleCoachLens.fight} sur le prochain bloc.`]),
	    reviewRows[0] ? `Ouvrir ${matchDisplayName(reviewRows[0].match, "la game prioritaire")} : vérifier précisément le déclencheur avant la mauvaise stat, pas seulement le score final.` : flops[0] ? `Mettre ${championDisplayName(flops[0].champion)} en review avant de le ressortir : identifier si le problème vient du matchup, du build ou du plan équipe.` : `Comparer ${championName(topChampion)} à une alternative de pool après quelques imports supplémentaires.`,
	    worstMatchups[0] ? `Isoler les games vs ${championDisplayName(worstMatchups[0].champion)} : noter le plan de lane, le premier reset et le premier fight objectif.` : `Draft : ${roleCoachLens.draft}.`,
	  ].filter(Boolean);
  const coachPillars = [
    { label: "Laning / farm", value: globalCs.at10 ?? "-", detail: cs10Target ? `${lowCs10Count}/${cs10Values.length || 0} sous cible CS10` : `${avgCsPerMin.toFixed(1)} CS/min moyen`, toneName: cs10Target && lowCs10Count > Math.max(1, cs10Values.length * 0.35) ? "orange" : "green", icon: Target },
    { label: "Fights", value: `${Math.round(avgKp)}%`, detail: `${lowKpRows.length} game${lowKpRows.length > 1 ? "s" : ""} sous 50% KP`, toneName: avgKp >= 60 ? "cyan" : "yellow", icon: Swords },
    { label: "Ressources", value: `${avgDamageShare.toFixed(1)}%`, detail: `${avgGoldShare.toFixed(1)}% de l'or équipe`, toneName: damageResourceDelta >= 0 ? "green" : "orange", icon: Gauge },
    { label: "Sécurité", value: avgDeaths.toFixed(1), detail: `${highDeathRows.length} game${highDeathRows.length > 1 ? "s" : ""} à morts hautes`, toneName: avgDeathShare <= 20 ? "green" : "red", icon: Shield },
    { label: "Pool", value: championStats.length, detail: topChampion ? `${topChampionShare}% sur ${championDisplayName(topChampion.champion)}` : "aucun champion", toneName: topChampionShare >= 60 ? "yellow" : "cyan", icon: Crown },
  ];
  const coachVerdict = coachIssues[0]?.title || coachStrengths[0]?.title || "Données à enrichir";
  const coachSummary = coachIssues.length ? coachIssues[0].text : coachStrengths[0]?.text || "Importe quelques games supplémentaires pour obtenir un bilan.";
  const profileSignals = [
    { title: "Impact dégâts", value: `${avgDamageShare.toFixed(1)}%`, detail: `${formatPoints(sum("damage") / Math.max(1, games))} dégâts moyens · ${avgGoldShare.toFixed(1)}% gold équipe`, toneName: avgDamageShare >= avgGoldShare ? "purple" : "orange", icon: Flame },
    { title: "Rendement ressources", value: `${avgDamageShare.toFixed(1)}%`, detail: `${avgGoldShare.toFixed(1)}% de l'or équipe reçu.`, toneName: damageResourceDelta >= 0 ? "green" : "red", icon: Gauge },
    { title: "Participation combats", value: `${Math.round(avgKp)}% KP`, detail: `${avgKills.toFixed(1)} kills · ${avgAssists.toFixed(1)} assists moyens`, toneName: avgKp >= 60 ? "cyan" : "yellow", icon: Swords },
    { title: "Exposition", value: `${avgDeathShare.toFixed(1)}%`, detail: `${avgDeaths.toFixed(1)} morts moyennes · part des morts équipe`, toneName: avgDeathShare <= 20 ? "green" : "red", icon: Shield },
    { title: "Présence vision", value: `${avgVisionShare.toFixed(1)}%`, detail: `${avg("vision")} vision moyenne · part vision équipe`, toneName: avgVisionShare >= 20 ? "cyan" : "purple", icon: Eye },
    { title: "Pool joué", value: `${championStats.length} champions`, detail: topChampion ? `${championDisplayName(topChampion.champion)} représente ${topChampionShare}% des games` : "Aucune game importée.", toneName: topChampionShare >= 60 ? "orange" : "green", icon: Crown },
  ];
  async function saveCoachingNote() {
    if (!selectedPlayer || !selectedTeamId || !canEditCoaching) return;
    setSavingCoaching(true);
    try {
      await apiFetch("player-coaching-notes-manage", { method: "POST", body: JSON.stringify({ teamId: selectedTeamId, playerId: selectedPlayer.id, content: coachingContent }) });
      await refreshAll?.();
      pushToast?.({ type: "green", title: "Bilan coaching enregistré", text: "La note globale du profil est à jour." });
    } catch (err) {
      pushToast?.({ type: "red", title: "Bilan impossible", text: err.message });
    } finally {
      setSavingCoaching(false);
    }
  }
  async function repairProfileLink(item) {
    if (!selectedPlayer || !item?.row?.id || !item?.match?.id || !canRepairProfileLinks) return;
    const selectedRole = normalizeProfileRole(selectedPlayer.role);
    const roles = { [item.row.id]: { role: selectedRole, playerId: selectedPlayer.id } };
    const swapsRoles = item.identityMatched && item.recordedRole && item.recordedRole !== selectedRole && item.roleRow?.id && item.roleRow.id !== item.row.id;
    if (swapsRoles) roles[item.roleRow.id] = { role: item.recordedRole, playerId: item.roleRow.player_id || "" };
    const currentLink = item.currentPlayer && String(item.currentPlayer.id) !== String(selectedPlayer.id) ? ` Cette game est actuellement liée à ${item.currentPlayer.name}.` : "";
    const roleChange = swapsRoles ? ` Les postes ${roleLabel(selectedRole)} et ${roleLabel(item.recordedRole)} seront aussi remis dans le bon ordre.` : "";
    if (!window.confirm(`Attribuer ${matchDisplayName(item.match)} à ${selectedPlayer.name} ?${currentLink}${roleChange}`)) return;
    setRepairingProfileLinkId(item.row.id);
    try {
      await apiFetch("matches-manage", { method: "POST", body: JSON.stringify({ action: "roles", teamId: selectedTeamId, matchId: item.match.id, roles }) });
      await refreshAll?.();
      pushToast?.({ type: "green", title: "Game reliée", text: `${matchDisplayName(item.match)} compte maintenant dans le profil de ${selectedPlayer.name}.` });
    } catch (err) {
      pushToast?.({ type: "red", title: "Liaison impossible", text: err.message });
    } finally {
      setRepairingProfileLinkId("");
    }
  }
  async function exportProfilePng() {
    if (!selectedPlayer) return;
    await document.fonts?.ready;
    const canvas = document.createElement("canvas");
    canvas.width = 1920;
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const margin = 64;
    const gap = 24;
    const contentWidth = W - margin * 2;
    const columnWidth = (contentWidth - gap) / 2;
    const rightX = margin + columnWidth + gap;
    const bodyFont = "500 18px Inter, Arial, sans-serif";
    const lineHeight = 27;
    const fit = (text, x, y, width, options) => pngFitText(ctx, text, x, y, width, options);
    const wrap = (text, width, font = bodyFont) => pngWrapText(ctx, String(text ?? ""), width, { font, maxLines: Infinity });
    const verdictFont = "600 23px Inter, Arial, sans-serif";
    const verdictLines = wrap(coachVerdict, columnWidth - 56, verdictFont);
    const summaryLines = wrap(coachSummary, columnWidth - 56);
    const decisionLayouts = coachDecisions.map((item) => ({ ...item, lines: wrap(item.text, columnWidth - 56) }));
    const coachHeight = 104 + verdictLines.length * 32 + summaryLines.length * lineHeight + decisionLayouts.reduce((total, item) => total + 48 + item.lines.length * lineHeight, 0);
    const championsShown = championStats.slice(0, 6);
    const championHeight = 150 + Math.max(1, championsShown.length) * 56 + (championStats.length > 6 ? 28 : 0);
    const detailY = 344;
    const detailHeight = Math.max(championHeight, coachHeight);
    const coachingY = detailY + detailHeight + gap;
    const coachingLines = wrap(coachingContent.trim() || "Aucun bilan global renseigné.", contentWidth - 56, "500 20px Inter, Arial, sans-serif");
    const coachingHeight = 96 + coachingLines.length * 30;
    canvas.height = Math.max(1080, coachingY + coachingHeight + 112);
    const H = canvas.height;
    const imageCache = new Map();
    const imageUrls = new Set(["/assets/nxt5-wordmark.png"]);
    championsShown.forEach((stat) => championPortraitSources(stat.champion, stat.champion).forEach((url) => imageUrls.add(url)));
    await Promise.all([...imageUrls].filter(Boolean).map(async (url) => imageCache.set(url, await pngLoadImage(url))));

    pngBackground(ctx, W, H);
    pngHeader(ctx, {
      width: W,
      title: selectedPlayer.name || "Profil NXT5",
      subtitle: `${roleLabel(selectedPlayer.role)} · ${selectedPlayer.riot_id || "Riot ID non lié"}`,
      eyebrow: "Profil joueur",
      logo: imageCache.get("/assets/nxt5-wordmark.png"),
      meta: `${games} game${games > 1 ? "s" : ""} importée${games > 1 ? "s" : ""}`,
    });
    const metrics = [
      ["Games", String(games), `${wins}W - ${losses}L`, "cyan"],
      ["Winrate", `${Math.round((wins / Math.max(1, games)) * 100)}%`, "Résumé importé", wins >= losses ? "green" : "orange"],
      ["KDA", kda, `${avg("kills")}/${avg("deaths")}/${avg("assists")} moy.`, "cyan"],
      ["KP", `${Math.round(avgKp)}%`, "Participation fights", avgKp >= 60 ? "green" : "yellow"],
      ["Dégâts", formatPoints(sum("damage") / Math.max(1, games)), "Moyenne / game", "purple"],
      ["Vision", String(Math.round(sum("vision") / Math.max(1, games))), "Moyenne / game", "orange"],
    ];
    pngMetricStrip(ctx, { x: margin, width: contentWidth, items: metrics.map(([label, value, detail, accent], index) => ({
      label,
      value,
      detail,
      accent: index === 1 || index === 3 ? accent : undefined,
    })) });

    pngPanel(ctx, margin, detailY, columnWidth, detailHeight);
    fit("Champions joués", margin + 28, detailY + 42, columnWidth - 56, { font: "700 24px Inter, Arial, sans-serif", color: PNG_THEME.text, min: 18 });
    fit("Volume, winrate et KDA sur les imports", margin + 28, detailY + 70, columnWidth - 56, { font: "500 16px Inter, Arial, sans-serif", color: PNG_THEME.muted });
    const gamesX = margin + columnWidth * 0.61;
    const winrateX = margin + columnWidth * 0.77;
    const kdaX = margin + columnWidth - 28;
    [
      ["Champion", margin + 28, "left"],
      ["Games", gamesX, "right"],
      ["Winrate", winrateX, "right"],
      ["KDA", kdaX, "right"],
    ].forEach(([label, x, align]) => fit(label, x, detailY + 112, columnWidth * 0.16, { font: "600 14px Inter, Arial, sans-serif", color: PNG_THEME.muted, align }));
    pngLine(ctx, margin + 28, detailY + 126, margin + columnWidth - 28, detailY + 126);
    championsShown.forEach((stat, index) => {
      const y = detailY + 138 + index * 56;
      if (index % 2 === 0) {
        ctx.fillStyle = PNG_THEME.panelAlt;
        ctx.fillRect(margin + 16, y - 2, columnWidth - 32, 56);
      }
      const image = championPortraitSources(stat.champion, stat.champion).map((url) => imageCache.get(url)).find(Boolean);
      pngPanel(ctx, margin + 28, y + 5, 40, 40, { fill: PNG_THEME.bg, radius: 9 });
      pngImageCover(ctx, image, margin + 28, y + 5, 40, 40, 9);
      fit(championDisplayName(stat.champion), margin + 82, y + 31, gamesX - margin - 120, { font: "600 19px Inter, Arial, sans-serif", color: PNG_THEME.text, min: 14 });
      fit(String(stat.games), gamesX, y + 31, 90, { font: "500 18px Inter, Arial, sans-serif", color: PNG_THEME.text, align: "right" });
      fit(`${stat.winrate}%`, winrateX, y + 31, 100, { font: "600 18px Inter, Arial, sans-serif", color: stat.winrate >= 50 ? PNG_THEME.green : PNG_THEME.red, align: "right" });
      fit(stat.kda, kdaX, y + 31, 130, { font: "500 18px Inter, Arial, sans-serif", color: PNG_THEME.text, align: "right", min: 14 });
    });
    if (!championsShown.length) fit("Aucun champion importé.", margin + 28, detailY + 170, columnWidth - 56, { font: bodyFont, color: PNG_THEME.muted });
    if (championStats.length > 6) fit(`Les 6 champions les plus joués · ${championStats.length} champions au total`, margin + 28, detailY + 162 + championsShown.length * 56, columnWidth - 56, { font: "500 14px Inter, Arial, sans-serif", color: PNG_THEME.muted });

    pngPanel(ctx, rightX, detailY, columnWidth, detailHeight);
    fit("Lecture coach", rightX + 28, detailY + 42, columnWidth - 56, { font: "700 24px Inter, Arial, sans-serif", color: PNG_THEME.text, min: 18 });
    let coachY = detailY + 84;
    ctx.font = verdictFont;
    ctx.fillStyle = PNG_THEME.text;
    verdictLines.forEach((line, index) => ctx.fillText(line, rightX + 28, coachY + index * 32));
    coachY += verdictLines.length * 32 + 8;
    ctx.font = bodyFont;
    ctx.fillStyle = PNG_THEME.muted;
    summaryLines.forEach((line, index) => ctx.fillText(line, rightX + 28, coachY + index * lineHeight));
    coachY += summaryLines.length * lineHeight + 12;
    pngLine(ctx, rightX + 28, coachY, rightX + columnWidth - 28, coachY);
    coachY += 30;
    decisionLayouts.forEach((item) => {
      fit(item.label, rightX + 28, coachY, columnWidth - 56, { font: "600 14px Inter, Arial, sans-serif", color: pngAccent(item.toneName), min: 13 });
      ctx.font = bodyFont;
      ctx.fillStyle = PNG_THEME.text;
      item.lines.forEach((line, index) => ctx.fillText(line, rightX + 28, coachY + 27 + index * lineHeight));
      coachY += 48 + item.lines.length * lineHeight;
    });

    pngPanel(ctx, margin, coachingY, contentWidth, coachingHeight);
    fit("Bilan coaching", margin + 28, coachingY + 42, contentWidth - 56, { font: "700 24px Inter, Arial, sans-serif", color: PNG_THEME.text, min: 18 });
    ctx.font = "500 20px Inter, Arial, sans-serif";
    ctx.fillStyle = PNG_THEME.muted;
    coachingLines.forEach((line, index) => ctx.fillText(line, margin + 28, coachingY + 80 + index * 30));
    pngFooter(ctx, { width: W, height: H, label: "Profil joueur · Bilan coaching" });
    await pngDownload(canvas, `nxt5-profil-${String(selectedPlayer.name || "joueur").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`);
    pushToast?.({ type: "cyan", title: "PNG exporté", text: "Le résumé du profil a été téléchargé." });
  }

  const buildRowsCount = rows.filter((row) => itemSlots(row).some(Boolean) || itemBuildTimeline(row).length).length;
  const buildRows = sortedProfileRows.filter((row) => itemSlots(row).some(Boolean) || itemBuildTimeline(row).length);
  const profileViews = [
    ["overview", "Synthèse", Activity, `${games}G`],
    ["champions", "Champions", Crown, `${championStats.length}/${buildRowsCount}`],
    ["pool", "Pool", Shield, championPool.length],
    ["history", "Historique", FileText, rows.length],
    ["coaching", "Coaching", Clipboard, coachingContent.trim() ? "OK" : "—"],
  ];
  if (!selectedPlayer) return <Surface glow><EmptyState icon={Activity} title="Profil introuvable" text="Lie ton compte à un profil joueur dans Gestion équipe pour alimenter cette page." /></Surface>;
  return <div className="nxt5-data-dense min-w-0 overflow-hidden">
    <PageHeader eyebrow="Joueur" title="Mon profil" subtitle="Stats, historique, pool et notes du coach." />
    <Surface className="relative overflow-hidden p-5">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_20%,rgba(34,211,238,.16),transparent_34%),radial-gradient(circle_at_86%_18%,rgba(217,70,239,.13),transparent_34%)]" />
      <div className="relative z-10 mb-5 flex flex-col gap-3 border-b border-white/10 pb-4 2xl:flex-row 2xl:items-end 2xl:justify-between">
        <div className="grid min-w-0 flex-1 gap-3 lg:grid-cols-[minmax(220px,320px)_minmax(0,1fr)] lg:items-end">
          <div className="min-w-0"><SelectInput label={"Profil observ\u00e9"} value={selectedPlayer.id} onChange={selectProfile}>{sortPlayersByRole(players).map((player) => <option key={player.id} value={player.id}>{roleLabel(player.role)}{" \u00b7 "}{player.name}</option>)}</SelectInput></div>
          {matchCategories.length > 0 && <div className="min-w-0 rounded-2xl border border-cyan-300/14 bg-black/20 p-2.5"><CategoryFilter categories={matchCategories} selectedCategoryId={selectedCategoryId} onSelect={(categoryId) => setSelectedCategoryId(categoryId)} label="Filtrer" /></div>}
        </div>
        <Button type="button" variant="ghost" icon={Download} onClick={exportProfilePng} className="shrink-0 justify-center 2xl:w-auto">{"Exporter le r\u00e9sum\u00e9 PNG"}</Button>
      </div>
      <div className="relative z-10 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Badge tone="cyan">{roleLabel(selectedPlayer.role)}</Badge>{selectedPlayer.user_id === user?.id && <Badge tone="orange">Moi</Badge>}<Badge tone={games ? "green" : "slate"}>{games} game{games > 1 ? "s" : ""}</Badge>{activeProfileCategory && <Badge tone={matchCategoryTone(activeProfileCategory)}>{activeProfileCategory.name}</Badge>}</div><h2 className="mt-4 break-words text-4xl font-black leading-tight text-white md:text-5xl">{selectedPlayer.name}</h2><p className="mt-2 break-words text-sm font-semibold text-slate-300">{selectedPlayer.riot_id || "Riot ID non lié"}</p></div>
        <div className="grid w-full gap-2 sm:grid-cols-2 2xl:grid-cols-4 2xl:w-auto 2xl:min-w-[560px]"><ProfileHudMetric icon={Trophy} label="WR" value={`${Math.round((wins / Math.max(1, games)) * 100)}%`} detail={`${wins}W - ${losses}L`} tone={wins >= losses ? "green" : "orange"} /><ProfileHudMetric icon={Swords} label="KDA" value={kda} detail={`${avg("kills")}/${avg("deaths")}/${avg("assists")} moy.`} tone="cyan" /><ProfileHudMetric icon={Flame} label="Dégâts" value={formatPoints(sum("damage") / Math.max(1, games))} detail="Moyenne/game" tone="purple" /><ProfileHudMetric icon={Eye} label="Vision" value={Math.round(sum("vision") / Math.max(1, games))} detail="Moyenne/game" tone="orange" /></div>
      </div>
    </Surface>
    <ProfileLinkAuditPanel player={selectedPlayer} matches={filteredMatches} issues={profileLinkIssues} open={profileLinkAuditOpen} canRepair={canRepairProfileLinks} repairingId={repairingProfileLinkId} onToggle={() => setProfileLinkAuditOpen((value) => !value)} onRepair={repairProfileLink} />
    <TabNav className="mt-5" label="Sections du profil" items={profileViews.map(([id, label, icon, meta]) => ({ id, label, icon, meta }))} activeId={profileView} onChange={openProfileView} columns="sm:grid-cols-2 xl:grid-cols-5" />
    <React.Fragment>
      <div key={profileView} className="nxt5-enter-fast mt-5">
        {profileView === "overview" && <><PlayerGoalsPanel goals={data.playerGoals || []} rows={rows} player={selectedPlayer} selectedTeamId={selectedTeamId} canManage={canRepairProfileLinks} refreshAll={refreshAll} pushToast={pushToast} /><CoachDiagnosticPanel player={selectedPlayer} games={games} wins={wins} losses={losses} verdict={coachVerdict} summary={coachSummary} issues={coachIssues} strengths={coachStrengths} actions={coachActions} pillars={coachPillars} comparisons={coachComparisons} decisions={coachDecisions} evidenceRows={reviewRows} /></>}
        {profileView === "champions" && <ProfileChampionsView championStats={championStats} selectedChampion={activeProfileChampion} onSelectChampion={setSelectedProfileChampion} selectedPlayer={selectedPlayer} matchups={matchups} bestMatchups={bestMatchups} worstMatchups={worstMatchups} buildRows={buildRows} buildRowsCount={buildRowsCount} selectedCategoryId={selectedCategoryId} navigate={navigate} bootstrapRevision={data.bootstrapRevision} />}
        {profileView === "pool" && <ProfileChampionPoolView championPool={championPool} championStats={championStats} selectedPlayer={selectedPlayer} pushToast={pushToast} />}
        {profileView === "history" && <ProfileHistoryView rows={rows} selectedCategoryId={selectedCategoryId} navigate={navigate} />}
        {profileView === "coaching" && <ProfileFold title="Bilan coaching global" badge="Staff notes" icon={Clipboard} toneName="cyan"><div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,.35fr)]"><div className="min-w-0"><label className="block"><span className="mb-2 block text-[0.66rem] font-black uppercase tracking-[0.22em] text-slate-300">Notes globales du joueur</span><textarea value={coachingContent} onChange={(event) => setCoachingContent(event.target.value.slice(0, 4000))} readOnly={!canEditCoaching} rows={14} placeholder={canEditCoaching ? "Bilan global, axes de travail, suivi hors game, remarques staff..." : "Aucun bilan coaching renseigné pour ce profil."} className={cx("w-full resize-y rounded-2xl border px-4 py-3 text-sm font-semibold leading-6 text-white outline-none placeholder:text-slate-300", canEditCoaching ? "border-cyan-300/18 bg-black/[0.24] focus:border-cyan-300/45" : "border-white/10 bg-black/[0.18] text-slate-200")}/></label><div className="mt-3 flex flex-wrap items-center justify-between gap-3"><p className="text-xs font-bold text-slate-300">{coachingContent.length}/4000 caractères</p>{canEditCoaching && <Button type="button" icon={savingCoaching ? Loader2 : Check} disabled={savingCoaching || coachingContent.length > 4000} onClick={saveCoachingNote}>{savingCoaching ? "Enregistrement..." : "Enregistrer le bilan"}</Button>}</div></div><div className="rounded-2xl border border-cyan-300/14 bg-cyan-400/[0.055] p-4"><Badge tone={canEditCoaching ? "green" : "slate"}>{canEditCoaching ? "Édition staff" : "Lecture seule"}</Badge><h4 className="mt-4 text-xl font-black text-white">Suivi global</h4><p className="mt-2 text-sm font-semibold leading-6 text-slate-200">Cet espace sert au bilan longue durée du joueur. Il reste indépendant des reviews liees aux games pour éviter de mélanger review ponctuelle et suivi global.</p><div className="mt-4 rounded-xl border border-white/10 bg-black/24 p-3 text-xs font-semibold leading-5 text-slate-300">Dernière mise à jour : {coachingNote?.updated_at ? new Date(coachingNote.updated_at).toLocaleString("fr-FR") : "jamais"}{coachingNote?.updated_by_name ? ` · ${coachingNote.updated_by_name}` : ""}</div></div></div></ProfileFold>}
      </div>
    </React.Fragment>
  </div>;
}

function CoachDiagnosticPanel({ player, games, wins, losses, verdict, summary, issues, strengths, actions, pillars, comparisons, decisions, evidenceRows }) {
  const mainTone = issues.length ? issues[0].toneName : strengths[0]?.toneName || "cyan";
  const readableItems = (issues.length ? issues : strengths).slice(0, 3);
  const referenceMetrics = [...pillars.slice(0, 4), ...comparisons.slice(0, 2)].map((item) => {
    const lower = String(item.label || "").toLowerCase();
    const title = lower.includes("laning") || lower.includes("cs10") ? "Lane et farm" : lower.includes("fight") || lower.includes("kp") ? "Présence en fight" : lower.includes("ressource") || lower.includes("rendement") ? "Ressources" : lower.includes("sécurité") || lower.includes("mort") ? "Sécurité" : item.label;
    const read = lower.includes("laning") || lower.includes("cs10")
      ? `CS10 ${item.value}. ${item.detail}.`
      : lower.includes("fight") || lower.includes("kp")
        ? `KP ${item.value}. ${item.detail}.`
        : lower.includes("ressource") || lower.includes("rendement")
          ? `${item.value} des dégâts pour ${item.detail}.`
          : lower.includes("sécurité") || lower.includes("mort")
            ? `${item.value} morts/game. ${item.detail}.`
            : `${item.value} · ${item.detail}`;
    const action = lower.includes("laning") || lower.includes("cs10")
      ? "Regarder waves 1-3, premier reset, puis CS10."
      : lower.includes("fight") || lower.includes("kp")
        ? "Regarder le move 30s avant les objectifs."
        : lower.includes("ressource") || lower.includes("rendement")
          ? "Vérifier si les ressources donnent une vraie conversion."
          : lower.includes("sécurité") || lower.includes("mort")
            ? "Classer les morts : vision, wave, greed ou fight forcé."
            : "Utiliser ce repère comme point de contrôle.";
    return { ...item, title, read, action };
  }).slice(0, 4);
  return <Surface className="p-5 md:p-6">
    <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2"><Badge tone={mainTone}>Bilan du joueur</Badge><Badge tone="slate">{games} game{games > 1 ? "s" : ""}</Badge><Badge tone={wins >= losses ? "green" : "orange"}>{wins}W - {losses}L</Badge></div>
        <h3 className="mt-4 max-w-4xl text-3xl font-black leading-tight text-white md:text-4xl">{verdict}</h3>
        <p className="mt-3 max-w-4xl text-sm font-semibold leading-6 text-slate-200">{summary}</p>
      </div>
      <div className="grid shrink-0 grid-cols-3 gap-4 border-y border-white/10 py-3 text-center sm:min-w-[340px] xl:border-y-0 xl:border-l xl:py-0 xl:pl-5">
        <div><p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-slate-400">Games</p><p className="mt-1 text-xl font-black text-white">{games}</p></div>
        <div><p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-slate-400">Winrate</p><p className="mt-1 text-xl font-black text-white">{Math.round((wins / Math.max(1, games)) * 100)}%</p></div>
        <div><p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-slate-400">Bilan</p><p className="mt-1 truncate text-sm font-black text-white">{issues.length ? "À corriger" : "Stable"}</p></div>
      </div>
    </div>
    <div className="mt-6 grid gap-7 xl:grid-cols-[minmax(0,1fr)_minmax(290px,.38fr)]">
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-100">Point à revoir</p>
          <span className="text-xs font-bold text-slate-400">Détails dans les onglets dédiés</span>
        </div>
        <div className="mt-3 divide-y divide-white/10 border-y border-white/10">
          {readableItems.length ? readableItems.map((item) => {
            const Icon = item.icon || Activity;
            return <div key={item.title} className="flex gap-3 py-4">
              <span className={cx("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border", tone(item.toneName))}><Icon className="h-4 w-4" /></span>
              <div className="min-w-0"><p className="font-black text-white">{item.title}</p><p className="mt-1 text-sm font-semibold leading-6 text-slate-300">{item.text}</p>{item.action && <p className="mt-2 rounded-xl border border-cyan-300/12 bg-cyan-400/[0.055] px-3 py-2 text-xs font-black leading-5 text-cyan-50">{item.action}</p>}</div>
            </div>;
          }) : <p className="py-4 text-sm font-semibold text-slate-300">Importe plus de games pour obtenir un bilan.</p>}
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {decisions.map((item) => <div key={item.label} className={cx("min-w-0 border-l-2 pl-3", item.toneName === "green" ? "border-emerald-300/60" : item.toneName === "red" ? "border-rose-300/60" : item.toneName === "orange" ? "border-amber-300/60" : item.toneName === "purple" ? "border-fuchsia-300/60" : "border-cyan-300/60")}>
            <p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-slate-400">{item.label}</p>
            <p className="mt-1 break-words text-sm font-black leading-5 text-white">{item.text}</p>
          </div>)}
        </div>
      </div>
      <aside className="min-w-0 xl:border-l xl:border-white/10 xl:pl-6">
        <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-100">Plan coach</p><p className="mt-1 text-sm font-semibold text-slate-400">{player?.name || "Profil"} · prochaines reviews</p></div><Target className="h-5 w-5 text-cyan-100" /></div>
        <ol className="mt-4 space-y-3">{actions.map((action, index) => <li key={`${action}-${index}`} className="flex gap-3">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-cyan-300/25 text-[0.62rem] font-black text-cyan-50">{index + 1}</span>
          <p className="text-sm font-semibold leading-6 text-slate-100">{action}</p>
        </li>)}</ol>
        <div className="mt-5 border-t border-white/10 pt-4">
          <div className="flex items-center justify-between gap-3"><p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-100">Preuves</p><Badge tone={evidenceRows.length ? "cyan" : "slate"}>{evidenceRows.length}</Badge></div>
          <div className="mt-2 divide-y divide-white/10">{evidenceRows.length ? evidenceRows.slice(0, 4).map((row, index) => <button key={`${row.match?.id || index}-coach-proof`} type="button" onClick={() => openAppPath(`/statistiques?match=${row.match?.id || ""}`)} className="flex w-full min-w-0 items-center justify-between gap-3 py-3 text-left transition hover:text-cyan-100"><span className="min-w-0"><span className="block truncate text-xs font-black text-white">{matchDisplayName(row.match, "Game")}</span><span className="mt-0.5 block truncate text-[0.62rem] font-semibold text-slate-400">{championDisplayName(row.champion)} · {row.kills || 0}/{row.deaths || 0}/{row.assists || 0} · KP {Math.round(parsePercent(row.kill_participation || row.kp || 0))}%</span></span><ArrowRight className="h-4 w-4 shrink-0 text-cyan-100" /></button>) : <p className="py-3 text-xs font-semibold leading-5 text-slate-400">Aucune game critique isolée pour ce profil.</p>}</div>
        </div>
      </aside>
    </div>
    <div className="mt-6 border-t border-white/10 pt-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-100">À vérifier en review</p>
          <p className="mt-1 text-sm font-semibold text-slate-400">Les contrôles simples à ouvrir dans les games sources.</p>
        </div>
        <Badge tone="slate">{referenceMetrics.length} axes</Badge>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">{referenceMetrics.map((item) => <CoachReferenceMetric key={item.label} item={item} />)}</div>
    </div>
  </Surface>;
}

function CoachReferenceMetric({ item }) {
  const Icon = item.icon || Activity;
  return <article className="min-w-0 rounded-2xl bg-white/[0.028] p-3">
    <div className="flex items-start gap-3">
      <span className={cx("grid h-9 w-9 shrink-0 place-items-center rounded-xl", tone(item.toneName))}><Icon className="h-4 w-4" /></span>
      <div className="min-w-0">
        <h4 className="text-sm font-black text-white">{item.title || item.label}</h4>
        <p className="mt-1 text-xs font-semibold leading-5 text-slate-300">{item.read || `${item.value} · ${item.detail}`}</p>
      </div>
    </div>
    <p className="mt-3 border-t border-white/10 pt-3 text-xs font-black leading-5 text-cyan-100">{item.action}</p>
  </article>;
}

function ProfileChampionsView({ championStats = [], selectedChampion, onSelectChampion, selectedPlayer, matchups = [], bestMatchups = [], worstMatchups = [], buildRows = [], buildRowsCount = 0, selectedCategoryId, navigate, bootstrapRevision }) {
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState("volume");
  const totalGames = championStats.reduce((total, stat) => total + Number(stat.games || 0), 0);
  const enhancedStats = championStats.map((stat) => {
    const safeGames = Math.max(1, Number(stat.games || 0));
    const buildCount = (stat.rows || []).filter((row) => itemSlots(row).some(Boolean) || itemBuildTimeline(row).length).length;
    const matchupCount = Array.from((stat.rows || []).reduce((map, row) => {
      const enemy = opponentRoleRow(row.match, row.role || selectedPlayer?.role, row.raw?.participantId || row.participantId);
      if (enemy?.champion) map.set(enemy.champion, true);
      return map;
    }, new Map()).keys()).length;
    const avgDamage = Number(stat.damage || 0) / safeGames;
    const avgVision = Number(stat.vision || 0) / safeGames;
    const avgKp = Number(stat.kp || 0) / safeGames;
    const share = Math.round((Number(stat.games || 0) / Math.max(1, totalGames)) * 100);
    const score = Math.round((Number(stat.winrate || 0) * 0.9) + (Number(stat.kda || 0) * 9) + (Math.min(5, Number(stat.games || 0)) * 7) + Math.min(18, buildCount * 4) + Math.min(12, matchupCount * 2));
    const risk = Number(stat.games || 0) <= 1 ? "sample" : Number(stat.winrate || 0) < 45 ? "wr" : Number(stat.kda || 0) < 2 ? "kda" : share >= 60 ? "overfocus" : "";
    const status = Number(stat.games || 0) >= 2 && Number(stat.winrate || 0) >= 55 ? "lock" : Number(stat.games || 0) >= 2 && Number(stat.winrate || 0) >= 48 ? "playable" : risk ? "review" : "test";
    return { ...stat, buildCount, matchupCount, avgDamage, avgVision, avgKp, share, score, risk, status };
  });
  const activeStat = enhancedStats.find((stat) => stat.champion === selectedChampion) || enhancedStats[0] || null;
  const activeRows = activeStat?.rows || [];
  const sortedStats = enhancedStats
    .filter((stat) => championDisplayName(stat.champion).toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => {
      if (sortMode === "wr") return b.winrate - a.winrate || b.games - a.games;
      if (sortMode === "kda") return Number(b.kda || 0) - Number(a.kda || 0) || b.games - a.games;
      if (sortMode === "volume") return b.games - a.games || b.score - a.score;
      return b.score - a.score || b.games - a.games;
    });
  const bestPick = enhancedStats.slice().sort((a, b) => b.score - a.score || b.games - a.games)[0];
  const safestPick = enhancedStats.filter((stat) => stat.games >= 2).sort((a, b) => b.winrate - a.winrate || Number(b.kda || 0) - Number(a.kda || 0))[0] || bestPick;
  const urgentPick = enhancedStats.filter((stat) => stat.games >= 1).sort((a, b) => (a.winrate + Number(a.kda || 0) * 8) - (b.winrate + Number(b.kda || 0) * 8))[0];
  const topShare = bestPick ? bestPick.share : 0;
  const nextActions = [
    bestPick && { title: "Premier choix", text: `${championDisplayName(bestPick.champion)} sort le meilleur mix volume, WR et KDA.`, toneName: "green", icon: ShieldCheck, champion: bestPick.champion },
    urgentPick && { title: "A verifier", text: `${championDisplayName(urgentPick.champion)} demande une review avant de le remettre en draft.`, toneName: "orange", icon: AlertTriangle, champion: urgentPick.champion },
  ].filter(Boolean).slice(0, 3);
  const sortOptions = [["volume", "Quantité"], ["kda", "KDA"], ["wr", "Winrate"]];
  if (!championStats.length) return <Surface glow className="p-6"><EmptyState icon={Crown} title="Aucun champion importe" text={selectedCategoryId ? "Aucune game de cette categorie pour ce profil." : "Importe une game pour alimenter les champions joues."} /></Surface>;
  return <div className="space-y-5">
    <Surface className="relative overflow-hidden p-0">
      {bestPick?.champion && <ChampionBackdrop champion={bestPick.champion} focus="face" />}
      <div className="relative z-10 grid gap-0 xl:grid-cols-[minmax(0,1fr)_minmax(360px,.36fr)]">
        <div className="min-w-0 p-5 md:p-6">
          <div className="flex flex-wrap items-center gap-2"><Badge tone="cyan">Champions joués</Badge><Badge tone="slate">{roleLabel(selectedPlayer?.role)}</Badge><Badge tone={selectedCategoryId ? "purple" : "green"}>{selectedCategoryId ? "Filtre actif" : "Toutes les games"}</Badge></div>
          <h3 className="mt-4 max-w-4xl text-3xl font-black leading-tight text-white md:text-5xl">{bestPick ? `Pick de référence : ${championDisplayName(bestPick.champion)}` : "Champions joués"}</h3>
          <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-slate-200">La page commence par la decision, puis donne les preuves. Tu dois pouvoir choisir un pick, comprendre le risque et ouvrir la review sans fouiller.</p>
          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            <ProfileChampionSignal icon={Crown} label="Pool joue" value={enhancedStats.length} detail={`${totalGames} games`} toneName={enhancedStats.length >= 4 ? "green" : "yellow"} />
            <ProfileChampionSignal icon={Target} label="Pickrate" value={bestPick ? `${topShare}%` : "-"} detail={bestPick ? championDisplayName(bestPick.champion) : "Aucun pick"} toneName={topShare >= 60 ? "orange" : "cyan"} />
            <ProfileChampionSignal icon={Swords} label="Duels" value={matchups.length} detail="matchups reconnus" toneName={matchups.length ? "purple" : "slate"} />
          </div>
        </div>
        <aside className="border-t border-white/10 bg-black/32 p-5 xl:border-l xl:border-t-0">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-100">Plan d'action</p>
          <div className="mt-4 space-y-3">{nextActions.map((item) => <ProfileChampionAction key={item.title} item={item} onSelect={item.champion ? () => onSelectChampion(item.champion) : undefined} />)}</div>
        </aside>
      </div>
    </Surface>

    <div className="grid gap-5 2xl:grid-cols-[minmax(300px,.28fr)_minmax(0,.72fr)]">
      <Surface className="min-w-0 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0"><Badge tone="cyan">{sortedStats.length}/{enhancedStats.length} visibles</Badge><h4 className="mt-3 text-xl font-black text-white">Board champions</h4><p className="mt-1 text-xs font-semibold leading-5 text-slate-400">Trie par quantité, KDA ou winrate.</p></div>
          <Search className="h-5 w-5 shrink-0 text-cyan-100" />
        </div>
        <label className="mt-4 flex min-w-0 items-center gap-2 rounded-2xl border border-white/10 bg-black/24 px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-cyan-100" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Chercher un champion" className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-white outline-none placeholder:text-slate-400" />
        </label>
        <div className="mt-4 rounded-2xl border border-white/10 bg-black/22 p-1.5">
          <div className="grid grid-cols-3 gap-1">{sortOptions.map(([id, label]) => <button key={id} type="button" onClick={() => setSortMode(id)} className={cx("rounded-xl px-2 py-2 text-[0.66rem] font-black uppercase tracking-[0.08em] transition", sortMode === id ? "bg-cyan-300 text-slate-950 shadow-[0_0_18px_rgba(34,211,238,.16)]" : "text-slate-300 hover:bg-white/[0.055] hover:text-white")}>{label}</button>)}</div>
        </div>
        <div className="mt-4 grid max-h-[64rem] gap-2 overflow-auto pr-1 [grid-template-columns:repeat(auto-fit,minmax(min(100%,18rem),1fr))] 2xl:grid-cols-1">
          {sortedStats.length ? sortedStats.map((stat) => <ProfileChampionCommandCard key={stat.champion} stat={stat} active={activeStat?.champion === stat.champion} onClick={() => onSelectChampion(stat.champion)} />) : <p className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm font-semibold text-slate-300">Aucun champion ne correspond à ce filtre.</p>}
        </div>
      </Surface>

      <div className="min-w-0 space-y-5">
        <Surface className="min-w-0 overflow-hidden p-4 md:p-5">
          {activeStat ? <ChampionProfileDetail stat={activeStat} rows={activeRows} navigate={navigate} bootstrapRevision={bootstrapRevision} /> : <EmptyState icon={Crown} title="Selection vide" text="Choisis un champion pour ouvrir son analyse." />}
        </Surface>
        <ProfileChampionDecisionCard stat={activeStat} safestPick={safestPick} urgentPick={urgentPick} />
      </div>
    </div>

  </div>;
}

function ProfileChampionSignal({ icon: Icon = Activity, label, value, detail, toneName = "cyan" }) {
  return <div className="min-w-0 rounded-2xl border border-white/10 bg-black/30 p-3">
    <div className="flex items-center justify-between gap-3"><p className="truncate text-[0.62rem] font-black uppercase tracking-[0.16em] text-slate-400">{label}</p><span className={cx("flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border", tone(toneName))}><Icon className="h-4 w-4" /></span></div>
    <p className="mt-2 truncate text-2xl font-black text-white">{value}</p>
    <p className="mt-1 truncate text-xs font-semibold text-slate-300">{detail}</p>
  </div>;
}

function ProfileChampionAction({ item, onSelect }) {
  const Icon = item.icon || Activity;
  const content = <><span className={cx("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border", tone(item.toneName))}><Icon className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-black text-white">{item.title}</span><span className="mt-1 block text-xs font-semibold leading-5 text-slate-300">{item.text}</span></span>{onSelect && <ArrowRight className="h-4 w-4 shrink-0 text-cyan-100" />}</>;
  return onSelect ? <button type="button" onClick={onSelect} className="flex w-full gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 text-left transition hover:border-cyan-300/25 hover:bg-white/[0.06]">{content}</button> : <div className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3">{content}</div>;
}

function profileChampionStatusMeta(status) {
  return {
    lock: { label: "Lock", toneName: "green", text: "Pret a draft" },
    playable: { label: "Jouable", toneName: "cyan", text: "Bon signal" },
    review: { label: "Review", toneName: "orange", text: "Risque visible" },
    test: { label: "Test", toneName: "purple", text: "A confirmer" },
  }[status] || { label: "Data", toneName: "slate", text: "A lire" };
}

function ProfileChampionCommandCard({ stat, active, onClick }) {
  const meta = profileChampionStatusMeta(stat.status);
  return <button type="button" onClick={onClick} className={cx("group min-w-0 overflow-hidden rounded-2xl border p-3 text-left transition hover:border-cyan-200/35 hover:bg-white/[0.055]", active ? "border-cyan-200/65 bg-cyan-400/12 shadow-[0_0_24px_rgba(34,211,238,.13)]" : "border-white/10 bg-black/24")}>
    <div className="grid min-w-0 grid-cols-[3.5rem_minmax(0,1fr)] gap-3">
      <ChampionPortrait champion={stat.champion} alt={stat.champion} className="h-14 w-14 shrink-0 rounded-2xl border border-white/10 object-cover" />
      <div className="min-w-0">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-2"><p className="min-w-0 truncate font-black text-white">{championDisplayName(stat.champion)}</p><span className="min-w-0 shrink-0"><Badge tone={meta.toneName}>{meta.label}</Badge></span></div>
        <p className="mt-1 truncate text-xs font-semibold text-slate-300">{meta.text} - score {stat.score}</p>
        <div className="mt-3 grid gap-1.5 [grid-template-columns:repeat(auto-fit,minmax(3.8rem,1fr))]">
          <ProfileChampionMini label="G" value={stat.games} />
          <ProfileChampionMini label="WR" value={`${stat.winrate}%`} toneName={stat.winrate >= 50 ? "green" : "red"} />
          <ProfileChampionMini label="KDA" value={stat.kda} />
          <ProfileChampionMini label="DMG" value={formatPoints(stat.avgDamage)} />
        </div>
      </div>
    </div>
    <div className="mt-3 flex min-w-0 flex-wrap gap-1.5"><Badge tone="slate">{stat.share}% volume</Badge><Badge tone={stat.buildCount ? "purple" : "slate"}>{stat.buildCount} build{stat.buildCount > 1 ? "s" : ""}</Badge><Badge tone={stat.matchupCount ? "cyan" : "slate"}>{stat.matchupCount} duel{stat.matchupCount > 1 ? "s" : ""}</Badge></div>
  </button>;
}

function ProfileChampionMini({ label, value, toneName = "cyan" }) {
  return <span className="min-w-0 rounded-xl border border-white/10 bg-black/24 px-2 py-1.5"><span className="block truncate text-[0.52rem] font-black uppercase tracking-[0.06em] text-slate-400">{label}</span><span className={cx("mt-0.5 block min-w-0 truncate text-xs font-black", toneName === "green" ? "text-emerald-100" : toneName === "red" ? "text-rose-100" : "text-white")}>{value}</span></span>;
}

function ProfileChampionDecisionCard({ stat, safestPick, urgentPick }) {
  if (!stat) return <Surface className="p-4"><EmptyState icon={Crown} title="Aucun pick" text="Selectionne un champion." /></Surface>;
  const meta = profileChampionStatusMeta(stat.status);
  const recommendations = [
    { label: "Decision", value: stat.status === "lock" ? "Draftable" : stat.status === "playable" ? "Possible" : stat.status === "review" ? "Review first" : "A tester", toneName: meta.toneName },
    { label: "Risque", value: stat.risk === "overfocus" ? "Pool trop centre" : stat.risk === "sample" ? "Sample faible" : stat.risk === "wr" ? "WR bas" : stat.risk === "kda" ? "KDA bas" : "Controle", toneName: stat.risk ? "orange" : "green" },
    { label: "Alternative sure", value: safestPick ? championDisplayName(safestPick.champion) : "-", toneName: "cyan" },
    { label: "Pick critique", value: urgentPick ? championDisplayName(urgentPick.champion) : "-", toneName: "red" },
  ];
  return <Surface glow className="min-w-0 p-4 md:p-5">
    <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(260px,.34fr)_minmax(0,.66fr)] xl:items-start">
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-3"><Badge tone={meta.toneName}>{meta.label}</Badge><Target className="h-5 w-5 text-cyan-100" /></div>
        <h4 className="mt-4 text-2xl font-black text-white">Decision rapide</h4>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-300">{championDisplayName(stat.champion)} est classé selon son volume, son WR, son KDA, ses builds et ses stats de lane.</p>
      </div>
    <div className="divide-y divide-white/10 border-y border-white/10">
      {recommendations.map((item) => <div key={item.label} className="grid grid-cols-[minmax(0,1fr)_minmax(92px,.42fr)] items-center gap-3 py-3"><p className="truncate text-xs font-black uppercase tracking-[0.14em] text-slate-400">{item.label}</p><p className={cx("truncate text-right text-sm font-black", item.toneName === "green" ? "text-emerald-100" : item.toneName === "red" ? "text-rose-100" : item.toneName === "orange" ? "text-amber-100" : "text-cyan-100")}>{item.value}</p></div>)}
    </div>
    </div>
  </Surface>;
}

function ProfileChampionPoolView({ championPool = [], championStats = [], selectedPlayer, pushToast }) {
  const tierOrder = Object.fromEntries(CHAMPION_TIERS.map((tier, index) => [tier.id, index]));
  const statsByChampion = championStats.reduce((map, stat) => {
    map.set(championAssetId(stat.champion), stat);
    map.set(championKey(stat.champion), stat);
    return map;
  }, new Map());
  const getChampionStat = (row) => statsByChampion.get(championAssetId(row.champion)) || statsByChampion.get(championKey(row.champion));
  const orderedRows = championPool.slice().sort((a, b) => (tierOrder[championPoolStatus(a)] ?? 9) - (tierOrder[championPoolStatus(b)] ?? 9) || championDisplayName(a.champion).localeCompare(championDisplayName(b.champion)));
  const rowsByTier = CHAMPION_TIERS.reduce((map, tier) => ({ ...map, [tier.id]: [] }), {});
  orderedRows.forEach((row) => rowsByTier[championPoolStatus(row)].push(row));
  const total = orderedRows.length;
  const readyCount = (rowsByTier.lock.length || 0) + (rowsByTier.pocket.length || 0);
  const workCount = (rowsByTier.work.length || 0) + (rowsByTier.danger.length || 0);
  const importedCount = orderedRows.filter((row) => getChampionStat(row)).length;
  const leadingTier = CHAMPION_TIERS.slice().sort((a, b) => (rowsByTier[b.id]?.length || 0) - (rowsByTier[a.id]?.length || 0))[0];
  const spotlightRow = rowsByTier.lock[0] || rowsByTier.pocket[0] || orderedRows[0];
  const readiness = !total ? "Pool à remplir" : readyCount >= Math.max(2, Math.ceil(total * 0.55)) ? "Pool prêt" : "Pool à consolider";
  const readinessTone = !total ? "slate" : readyCount >= Math.max(2, Math.ceil(total * 0.55)) ? "green" : "yellow";
  const exportTierList = () => exportChampionTierListPng({ player: selectedPlayer, rowsByTier, pushToast });
  return <div className="space-y-5">
    <Surface className="relative overflow-hidden p-5 md:p-6">
      {spotlightRow?.champion && <ChampionBackdrop champion={spotlightRow.champion} focus="face" />}
      <div className="relative z-10 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,.44fr)] xl:items-end">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><Badge tone="green">Pool dédié</Badge><Badge tone={readinessTone}>{readiness}</Badge><Badge tone="slate">{roleLabel(selectedPlayer?.role)}</Badge></div>
          <h3 className="mt-4 text-3xl font-black leading-tight text-white md:text-4xl">Pool de {selectedPlayer?.name || "joueur"}</h3>
          <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-slate-200">Les champions déclarés sont classés par statut : confiance, situationnel, validation ou entraînement.</p>
          <div className="mt-4">
            <Button type="button" variant="ghost" icon={Download} onClick={exportTierList} disabled={!total}>Exporter la tier list PNG</Button>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <ProfileHudMetric icon={ShieldCheck} label="Confiance" value={rowsByTier.lock.length} detail="Picks fiables" tone="green" />
          <ProfileHudMetric icon={Flame} label="Situationnels" value={rowsByTier.pocket.length} detail="Options de contexte" tone="orange" />
          <ProfileHudMetric icon={Gauge} label="À valider" value={workCount} detail="Validation + training" tone="cyan" />
          <ProfileHudMetric icon={Activity} label="Importés" value={`${importedCount}/${total || 0}`} detail="Avec stats de games" tone="purple" />
        </div>
      </div>
    </Surface>

    <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
      {CHAMPION_TIERS.map((tier) => {
        const rows = rowsByTier[tier.id] || [];
        return <div key={tier.id} className={cx("relative overflow-hidden rounded-2xl border p-4", championTierFrame(tier, rows.length > 0))}>
          <div className={cx("pointer-events-none absolute inset-0 bg-gradient-to-br", championTierColumnGlow(tier))} />
          <div className="relative z-10 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] opacity-75">Catégorie de pool</p>
              <p className="mt-1 text-xl font-black text-white">{tier.title}</p>
            </div>
            <ChampionTierMark tier={tier} active={rows.length > 0} />
          </div>
          <div className="relative z-10 mt-4 flex items-end justify-between gap-3 border-t border-white/10 pt-3">
            <span className="text-3xl font-black text-white">{rows.length}</span>
            <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-300">{total ? Math.round((rows.length / total) * 100) : 0}% du pool</span>
          </div>
        </div>;
      })}
    </div>

    {total ? <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,.36fr)]">
      <div className="grid gap-4 2xl:grid-cols-2">
        {CHAMPION_TIERS.map((tier) => {
          const tierRows = rowsByTier[tier.id] || [];
          return <section key={tier.id} className={cx("relative min-w-0 overflow-hidden rounded-[1.35rem] border p-4", championTierColumnFrame(tier))}>
            <div className={cx("pointer-events-none absolute inset-0 bg-gradient-to-br", championTierColumnGlow(tier))} />
            <div className="relative z-10 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-300">{tier.title}</p>
              </div>
              <Badge tone={tier.tone}>{tierRows.length}</Badge>
            </div>
            <div className="relative z-10 mt-4 grid gap-2">
              {tierRows.length ? tierRows.map((row, index) => <ProfilePoolChampionRow key={`${row.id || row.champion}-${index}`} row={row} stat={getChampionStat(row)} selectedPlayer={selectedPlayer} />) : <p className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm font-semibold text-slate-300">Aucun champion dans ce tier.</p>}
            </div>
          </section>;
        })}
      </div>
      <aside className="space-y-4">
        <div className="rounded-[1.35rem] border border-cyan-300/14 bg-cyan-400/[0.055] p-4">
          <div className="flex items-center justify-between gap-3"><Badge tone={readinessTone}>{readiness}</Badge><Target className="h-5 w-5 text-cyan-100" /></div>
          <h4 className="mt-4 text-xl font-black text-white">Pour la draft</h4>
          <div className="mt-4 divide-y divide-white/10 border-y border-white/10">
            <ProfilePoolReadLine label="Prêts à sortir" value={readyCount} detail="Confiance + situationnels" toneName={readyCount ? "green" : "slate"} />
            <ProfilePoolReadLine label="À travailler" value={workCount} detail="Validation + training" toneName={workCount ? "yellow" : "green"} />
            <ProfilePoolReadLine label="Catégorie dominante" value={leadingTier?.title || "-"} detail={`${rowsByTier[leadingTier?.id]?.length || 0} champion${(rowsByTier[leadingTier?.id]?.length || 0) > 1 ? "s" : ""}`} toneName={leadingTier?.tone || "slate"} />
          </div>
        </div>
        <div className="rounded-[1.35rem] border border-white/10 bg-black/24 p-4">
          <div className="flex items-center justify-between gap-3"><Badge tone="cyan">Guide catégories</Badge><BookOpen className="h-5 w-5 text-cyan-100" /></div>
          <div className="mt-4 space-y-3">
            {CHAMPION_TIERS.map((tier) => <div key={tier.id} className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3">
              <ChampionTierMark tier={tier} active className="h-8 w-8 rounded-xl [&_svg]:h-4 [&_svg]:w-4" />
              <div className="min-w-0"><p className="text-sm font-black text-white">{tier.title}</p></div>
            </div>)}
          </div>
        </div>
      </aside>
    </div> : <Surface glow className="p-6"><EmptyState icon={Shield} title="Pool non renseigné" text="Ajoute des champions dans Champion Pool pour afficher les catégories de ce profil." /></Surface>}
  </div>;
}

function ProfilePoolReadLine({ label, value, detail, toneName = "cyan" }) {
  return <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(70px,.35fr)] items-center gap-3 py-3">
    <div className="min-w-0"><p className="truncate text-xs font-black uppercase tracking-[0.14em] text-slate-400">{label}</p><p className="mt-1 truncate text-xs font-semibold text-slate-300">{detail}</p></div>
    <p className={cx("truncate text-right text-sm font-black", toneName === "green" ? "text-emerald-100" : toneName === "yellow" ? "text-amber-100" : toneName === "red" ? "text-rose-100" : "text-cyan-100")}>{value}</p>
  </div>;
}

function ProfilePoolChampionRow({ row, stat, selectedPlayer }) {
  const status = championPoolStatus(row);
  const tags = championStyleTags(row.champion).slice(0, 2);
  const sourceLabel = ["manual", "riot_manual"].includes(String(row.source || "")) ? "Déclaré" : "Pool";
  const games = Number(stat?.games ?? row.games ?? 0);
  const winrate = stat ? stat.winrate : games ? Math.round((Number(row.wins || 0) / Math.max(1, games)) * 100) : null;
  const kda = stat?.kda || (games ? Number(row.kda || 0).toFixed(1) : "");
  const statTone = !games ? "slate" : winrate >= 55 ? "green" : winrate >= 45 ? "yellow" : "red";
  return <div className="group min-w-0 rounded-2xl border border-white/10 bg-black/26 p-3 transition hover:border-cyan-300/25 hover:bg-white/[0.045]">
    <div className="flex min-w-0 gap-3">
      <span className="inline-flex h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-black/30">
        <ChampionPortrait row={row} champion={row.champion} alt={row.champion} className="h-full w-full object-cover" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <p className="truncate font-black text-white">{championDisplayName(row.champion)}</p>
          <Badge tone={championPoolStatusTone(status)}>{championPoolStatusLabel(status)}</Badge>
        </div>
        <p className="mt-1 truncate text-xs font-semibold text-slate-300">{roleLabel(row.role || selectedPlayer?.role)} · {sourceLabel}</p>
      </div>
    </div>
    <div className="mt-3 flex flex-wrap gap-2">
      <Badge tone={statTone}>{games ? `${games}G${winrate !== null ? ` · ${winrate}% WR` : ""}${kda ? ` · KDA ${kda}` : ""}` : "Pas encore importé"}</Badge>
      {tags.map((tag) => <Badge key={tag} tone={championStyleTone(tag)}>{tagLabel(tag)}</Badge>)}
    </div>
  </div>;
}

function ChampionProfileDetail({ stat, rows, navigate, bootstrapRevision }) {
  const safeGames = Math.max(1, stat.games || rows.length || 0);
  const avg = (value, decimals = 1) => (Number(value || 0) / safeGames).toFixed(decimals);
  const sortedRows = rows.slice().sort((a, b) => String(b.match?.created_at || b.match?.game_date || b.match?.game_id || "").localeCompare(String(a.match?.created_at || a.match?.game_date || a.match?.game_id || "")));
  const bestDamageRow = rows.slice().sort((a, b) => Number(b.damage || 0) - Number(a.damage || 0))[0];
  const csMilestones = csMilestoneSummary(rows);
  const buildRows = sortedRows.filter((row) => itemSlots(row).some(Boolean) || itemBuildTimeline(row).length);
  const styleTags = championStyleTags(stat.champion).slice(0, 3);
  const heroStats = [
    ["WR", `${stat.winrate}%`, `${stat.wins}W - ${Math.max(0, stat.games - stat.wins)}L`, stat.winrate >= 50 ? "text-emerald-100" : "text-amber-100"],
    ["KDA", stat.kda, `${stat.kills}/${stat.deaths}/${stat.assists} total`, "text-cyan-100"],
    ["KP", `${avg(stat.kp, 0)}%`, "moyenne", "text-fuchsia-100"],
    ["CS/min", avg(stat.csPerMin), csMilestones.samples > 0 ? `CS10/20 ${csMilestones.at10 ?? "-"} / ${csMilestones.at20 ?? "-"}` : "moyenne", "text-amber-100"],
  ];
  return <div className="space-y-4">
    <div className="rounded-2xl border border-cyan-300/14 bg-black/24 p-4">
      <div className="grid min-w-0 gap-4 2xl:grid-cols-[minmax(0,.58fr)_minmax(260px,.42fr)] 2xl:items-center">
        <div className="grid min-w-0 grid-cols-[4rem_minmax(0,1fr)] items-center gap-4 sm:grid-cols-[5rem_minmax(0,1fr)]">
          <ChampionPortrait champion={stat.champion} alt={stat.champion} className="h-16 w-16 shrink-0 rounded-2xl border border-cyan-200/18 object-cover sm:h-20 sm:w-20" />
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap gap-2">{styleTags.map((tag) => <ChampionStylePill key={tag} tag={tag} />)}</div>
            <p className="mt-3 min-w-0 truncate text-2xl font-black leading-none text-white md:text-3xl">{championDisplayName(stat.champion)}</p>
            <p className="mt-2 max-w-full text-sm font-semibold leading-5 text-slate-300 sm:truncate">{stat.games} game{stat.games > 1 ? "s" : ""} analysée{stat.games > 1 ? "s" : ""} · {buildRows.length} build{buildRows.length > 1 ? "s" : ""}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 2xl:grid-cols-2">
          {heroStats.map(([label, value, detail, color]) => <ChampionVisualMetric key={label} label={label} value={value} detail={detail} color={color} />)}
        </div>
      </div>
    </div>

    <div className="grid min-w-0 gap-5">
      <section className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-100/80">Repères champion</p><Badge tone="cyan">{formatPoints(stat.damage / safeGames)} DMG moy.</Badge></div>
        <div className="mt-3 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 md:grid-cols-2 xl:grid-cols-5">
          <ChampionReferenceLine label="Vision" value={avg(stat.vision)} detail="moyenne/game" />
          <ChampionReferenceLine label="Dégâts" value={formatPoints(stat.damage / safeGames)} detail="moyenne/game" />
          <ChampionReferenceLine label="Or" value={formatPoints(stat.gold / safeGames)} detail="moyenne/game" />
          {csMilestones.samples > 0 && <ChampionReferenceLine label="CS 10 / 20" value={`${csMilestones.at10 ?? "-"} / ${csMilestones.at20 ?? "-"}`} detail={`${csMilestones.samples} timeline${csMilestones.samples > 1 ? "s" : ""}`} />}
          {bestDamageRow && <ChampionReferenceLine label="Peak dégâts" value={formatPoints(bestDamageRow.damage)} detail={matchDisplayName(bestDamageRow.match, "game inconnue")} />}
        </div>
      </section>
      <ChampionLanePanel rows={sortedRows} navigate={navigate} bootstrapRevision={bootstrapRevision} />
    </div>

  </div>;
}

function ChampionStylePill({ tag }) {
  return <span className={cx("inline-flex shrink-0 items-center rounded-full border px-3 py-1 text-[0.62rem] font-black uppercase leading-4 tracking-[0.08em] whitespace-nowrap shadow-[0_0_14px_rgba(255,255,255,.035)]", tone(championStyleTone(tag)))}>
    {tagLabel(tag)}
  </span>;
}

function ChampionVisualMetric({ label, value, detail, color }) {
  return <div className="min-w-0">
    <p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
    <p className={cx("mt-1 break-words text-xl font-black leading-tight sm:text-2xl", color)}>{value}</p>
    <p className="mt-1 truncate text-xs font-semibold text-slate-300">{detail}</p>
  </div>;
}

function ChampionReferenceLine({ label, value, detail }) {
  return <div className="grid min-w-0 gap-1 bg-[#07101d] p-3">
    <p className="truncate text-xs font-black uppercase tracking-[0.12em] text-slate-400">{label}</p>
    <p className="break-words text-lg font-black text-white">{value}</p>
    <p className="break-words text-xs font-semibold text-slate-400 sm:truncate">{detail}</p>
  </div>;
}

function ChampionLanePanel({ rows, navigate, bootstrapRevision }) {
  const buildRows = rows.filter((row) => itemSlots(row).some(Boolean) || itemBuildTimeline(row).length);
  return <section className="min-w-0">
    <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-100/80">Lecture lane</p><div className="flex flex-wrap gap-2"><Badge tone="cyan">{rows.length} game{rows.length > 1 ? "s" : ""}</Badge><Badge tone={buildRows.length ? "purple" : "slate"}>{buildRows.length} build{buildRows.length > 1 ? "s" : ""}</Badge></div></div>
    <div className="mt-3 max-h-[34rem] divide-y divide-white/10 overflow-auto border-y border-white/10 pr-1">{rows.length ? rows.map((row, index) => {
      const enemy = (row.match?.participants || []).find((item) => item.team_key === "ENEMY" && String(item.role || "").toUpperCase() === String(row.role || "").toUpperCase());
      const cs10 = csAtMinute(row, 10);
      const cs20 = csAtMinute(row, 20);
      const enemyCs10 = enemy ? csAtMinute({ ...enemy, match: row.match }, 10) : null;
      const diff10 = Number.isFinite(cs10) && Number.isFinite(enemyCs10) ? cs10 - enemyCs10 : null;
      return <ChampionLaneGameLine key={`${row.match?.id || row.match?.game_id || index}-lane`} row={row} enemy={enemy} cs10={cs10} cs20={cs20} diff10={diff10} navigate={navigate} bootstrapRevision={bootstrapRevision} />;
    }) : <p className="py-4 text-sm font-semibold text-slate-400">Aucune donnée de lane pour ce champion.</p>}</div>
  </section>;
}

function ParticipantCompareCard({ title, row, match, toneName = "cyan" }) {
  const participant = row ? { ...row, match: row.match || match } : null;
  const items = participant ? finalBuildItems(participant) : [];
  const spells = participant ? summonerSpellIds(participant) : [];
  const timeline = participant ? itemBuildTimeline(participant) : [];
  const champion = participant?.champion || "";
  return <div className={cx("min-w-0 rounded-2xl border p-3", toneName === "red" ? "border-rose-300/14 bg-rose-500/[0.035]" : "border-cyan-300/14 bg-cyan-400/[0.04]")}>
    <div className="flex min-w-0 items-start justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        {champion ? <ChampionPortrait champion={champion} row={participant} alt={champion} className="h-14 w-14 shrink-0 rounded-xl border border-white/10 object-cover" /> : <span className="h-14 w-14 shrink-0 rounded-xl border border-dashed border-white/10 bg-black/20" />}
        <div className="min-w-0">
          <Badge tone={toneName}>{title}</Badge>
          <p className="mt-2 truncate text-base font-black text-white">{participant?.summoner_name || participant?.riot_id || "Inconnu"}</p>
          <p className="truncate text-xs font-semibold text-slate-300">{champion ? championDisplayName(champion) : "Champion ?"} - {roleLabel(participant?.role)}</p>
        </div>
      </div>
      {spells.length > 0 && <div className="flex shrink-0 gap-1">{spells.map((spell, index) => <HudIcon key={`${participant?.id || participant?.riot_id || title}-spell-${index}-${spell}`} sources={summonerSpellIconSources(spell)} label={`Sort ${spell}`} fallback={spell} emptyText="S" className="h-8 w-8 rounded-lg" />)}</div>}
    </div>
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
      <ProfileChampionMini label="KDA" value={participant ? `${participant.kills || 0}/${participant.deaths || 0}/${participant.assists || 0}` : "-"} toneName={toneName} />
      <ProfileChampionMini label="CS" value={participant ? creepScore(participant) || "-" : "-"} toneName="cyan" />
      <ProfileChampionMini label="Gold" value={participant ? formatPoints(participant.gold || 0) : "-"} toneName="yellow" />
      <ProfileChampionMini label="DMG" value={participant ? formatPoints(participant.damage || 0) : "-"} toneName="purple" />
      <ProfileChampionMini label="Vision" value={participant ? Math.round(Number(participant.vision || 0)) : "-"} toneName="cyan" />
    </div>
    <div className="mt-3 rounded-xl border border-white/10 bg-black/24 p-2.5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[0.58rem] font-black uppercase tracking-[0.14em] text-slate-300">Stuff final</p>
        <Badge tone={items.length ? toneName : "slate"}>{items.length || "Aucun"}</Badge>
      </div>
      {items.length ? <div className="mt-2 flex min-w-0 flex-wrap gap-1.5">{items.map((item, index) => <HudIcon key={`${participant?.id || participant?.riot_id || title}-final-${index}-${item.id}`} sources={itemIconSources(item.id)} label={`${item.type === "trinket" ? "Trinket" : "Item"} ${item.id}`} fallback={item.id} emptyText="-" toneName={item.type === "trinket" ? "pink" : toneName} className="h-10 w-10" />)}</div> : <p className="mt-2 text-xs font-semibold text-slate-400">Aucun item final dans ce JSON.</p>}
    </div>
    {timeline.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5 border-t border-white/10 pt-2">
      {timeline.slice(0, 8).map((event, index) => <span key={`${participant?.id || participant?.riot_id || title}-buy-${index}-${event.timestamp}-${event.itemId}`} className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-black/24 px-2 py-1 text-[0.58rem] font-black text-slate-200"><span className="text-cyan-100">{event.time}</span>{event.label}</span>)}
    </div>}
  </div>;
}

function VersusDeltaStack({ rows }) {
  return <div className="grid min-w-0 gap-2 sm:grid-cols-3 xl:grid-cols-1">
    {rows.map(([label, value, toneName]) => <div key={label} className={cx("rounded-xl border px-3 py-2 text-center", tone(toneName))}>
      <p className="text-[0.56rem] font-black uppercase tracking-[0.14em] opacity-80">{label}</p>
      <p className="mt-1 text-sm font-black text-white">{value}</p>
    </div>)}
  </div>;
}

function ChampionLaneGameLine({ row: summaryRow, enemy: summaryEnemy, cs10, cs20, diff10, navigate, bootstrapRevision }) {
  const [expanded, setExpanded] = useState(false);
  const targetMatchId = summaryRow.match?.id || summaryRow.match?.game_id || "";
  const { detail, loading, error, retry } = useMatchDetails(summaryRow.match?.team_id, expanded ? targetMatchId : "", bootstrapRevision || "");
  const match = detail ? { ...summaryRow.match, ...detail } : summaryRow.match;
  const completeRow = (participant) => {
    if (!participant) return null;
    const replacement = detail?.participants?.find((candidate) => (participant.id && String(candidate.id) === String(participant.id)) || (rowParticipantId(participant) && rowParticipantId(candidate) === rowParticipantId(participant)));
    return { ...participant, ...replacement, match };
  };
  const row = completeRow(summaryRow);
  const enemy = completeRow(summaryEnemy);
  const finalItems = finalBuildItems(row);
  const timeline = itemBuildTimeline(row);
  const enemyRow = enemy ? { ...enemy, match: row.match } : null;
  const allyRows = teamRows(row.match, "ALLY");
  const enemyRows = teamRows(row.match, "ENEMY");
  const enemyCs20 = enemy ? csAtMinute({ ...enemy, match: row.match }, 20) : null;
  const diff20 = Number.isFinite(cs20) && Number.isFinite(enemyCs20) ? cs20 - enemyCs20 : null;
  const laneGoldDiff = enemy ? statValue(row, "gold") - statValue(enemy, "gold") : null;
  const laneDamageDiff = enemy ? statValue(row, "damage") - statValue(enemy, "damage") : null;
  const teamGoldDiff = allyRows.length || enemyRows.length ? sumRows(allyRows, "gold") - sumRows(enemyRows, "gold") : null;
  const teamDamageDiff = allyRows.length || enemyRows.length ? sumRows(allyRows, "damage") - sumRows(enemyRows, "damage") : null;
  const goldShare = allyRows.length ? Math.round(shareOfTeam(row, allyRows, "gold")) : 0;
  const damageShare = allyRows.length ? Math.round(shareOfTeam(row, allyRows, "damage")) : 0;
  const matchDate = profileHistoryDateLabel(row);
  const performanceStats = [
    ["KDA", `${row.kills || 0}/${row.deaths || 0}/${row.assists || 0}`, "cyan"],
    ["KP", `${Math.round(parsePercent(row.kill_participation || row.kp || 0))}%`, "purple"],
    ["DMG", formatPoints(row.damage), "purple"],
    ["Vision", Math.round(Number(row.vision || 0)), "cyan"],
    ["Gold", formatPoints(row.gold), "yellow"],
    ["CS", creepScore(row) || "-", "cyan"],
    ["Tours", formatPoints(towerDamage(row)), "slate"],
    ["Ressources", goldShare ? `${goldShare}% or` : "-", "yellow"],
  ];
  const laneStats = [
    ["Gold", laneGoldDiff === null ? "-" : formatGoldDiff(laneGoldDiff), laneGoldDiff === null ? "slate" : laneGoldDiff >= 0 ? "green" : "red"],
    ["Degats", laneDamageDiff === null ? "-" : `${laneDamageDiff >= 0 ? "+" : ""}${formatPoints(laneDamageDiff)}`, laneDamageDiff === null ? "slate" : laneDamageDiff >= 0 ? "green" : "red"],
    ["CS10", diff10 === null ? "-" : `${diff10 >= 0 ? "+" : ""}${diff10}`, diff10 === null ? "slate" : diff10 >= 0 ? "green" : "red"],
    ["CS20", diff20 === null ? "-" : `${diff20 >= 0 ? "+" : ""}${diff20}`, diff20 === null ? "slate" : diff20 >= 0 ? "green" : "red"],
  ];
  const teamStats = [
    ["Gold equipe", teamGoldDiff === null ? "-" : formatGoldDiff(teamGoldDiff), teamGoldDiff === null ? "slate" : teamGoldDiff >= 0 ? "green" : "red"],
    ["Dmg equipe", teamDamageDiff === null ? "-" : `${teamDamageDiff >= 0 ? "+" : ""}${formatPoints(teamDamageDiff)}`, teamDamageDiff === null ? "slate" : teamDamageDiff >= 0 ? "green" : "red"],
    ["Part degats", damageShare ? `${damageShare}%` : "-", "purple"],
    ["Part or", goldShare ? `${goldShare}%` : "-", "yellow"],
  ];
  const versusDeltas = [
    ["Gold", laneGoldDiff === null ? "-" : formatGoldDiff(laneGoldDiff), laneGoldDiff === null ? "slate" : laneGoldDiff >= 0 ? "green" : "red"],
    ["DMG", laneDamageDiff === null ? "-" : `${laneDamageDiff >= 0 ? "+" : ""}${formatPoints(laneDamageDiff)}`, laneDamageDiff === null ? "slate" : laneDamageDiff >= 0 ? "green" : "red"],
    ["CS20", diff20 === null ? "-" : `${diff20 >= 0 ? "+" : ""}${diff20}`, diff20 === null ? "slate" : diff20 >= 0 ? "green" : "red"],
  ];
  const openMatch = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (targetMatchId) navigate?.(`/statistiques?match=${encodeURIComponent(targetMatchId)}`);
  };
  return <details className="group" open={expanded} onToggle={(event) => setExpanded(event.currentTarget.open)}>
    <summary className="grid cursor-pointer list-none gap-3 py-3 transition hover:bg-white/[0.025] 2xl:grid-cols-[minmax(0,1fr)_repeat(4,minmax(70px,.16fr))_auto] 2xl:items-center [&::-webkit-details-marker]:hidden">
      <div className="flex min-w-0 items-center gap-3">
        {enemy?.champion ? <ChampionPortrait champion={enemy.champion} alt={enemy.champion} className="h-10 w-10 shrink-0 rounded-xl object-cover" /> : <div className="h-10 w-10 shrink-0 rounded-xl bg-white/[0.05]" />}
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-black text-white">vs {enemy?.champion ? championDisplayName(enemy.champion) : "Matchup inconnu"}</p><p className="truncate text-xs font-semibold text-slate-400">{matchDisplayName(row.match, "Game")} - {row.match?.result || "Resultat ?"}</p></div>
        {targetMatchId && <button type="button" onClick={openMatch} title="Ouvrir cette game" aria-label="Ouvrir cette game" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-cyan-200/25 bg-cyan-300/[0.08] text-cyan-50 transition hover:border-cyan-100/60 hover:bg-cyan-200/18 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-200/35">
          <ArrowRight className="h-4 w-4" />
        </button>}
      </div>
      <ChampionMiniStat label="CS10" value={Number.isFinite(cs10) ? cs10 : "-"} />
      <ChampionMiniStat label="CS20" value={Number.isFinite(cs20) ? cs20 : "-"} />
      <ChampionMiniStat label="Diff10" value={diff10 === null ? "-" : `${diff10 >= 0 ? "+" : ""}${diff10}`} toneName={diff10 === null ? "slate" : diff10 >= 0 ? "green" : "red"} />
      <ChampionMiniStat label="Diff20" value={diff20 === null ? "-" : `${diff20 >= 0 ? "+" : ""}${diff20}`} toneName={diff20 === null ? "slate" : diff20 >= 0 ? "green" : "red"} />
      <div className="flex min-w-0 items-center justify-between gap-2 2xl:justify-end"><Badge tone={finalItems.length ? "cyan" : "slate"}>{finalItems.length ? "Build" : "Sans build"}</Badge><ChevronDown className="h-4 w-4 shrink-0 text-cyan-100 transition group-open:rotate-180" /></div>
    </summary>
    <div className="border-t border-white/10 bg-white/[0.025] py-3">
      {loading && <p role="status" className="mb-3 text-sm font-semibold text-slate-300">Chargement de la timeline d’achats…</p>}
      {error && <div role="alert" className="mb-3 flex items-center gap-3 text-sm text-rose-200"><p>{error}</p><Button onClick={retry}>Réessayer</Button></div>}
      <div className="rounded-2xl border border-cyan-300/12 bg-black/24 p-3">
        <div className="grid gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={row.match?.result === "Victoire" ? "green" : row.match?.result === "Défaite" ? "red" : "slate"}>{row.match?.result || "Game"}</Badge>
              <Badge tone="blue">{row.match?.side || "Side ?"}</Badge>
              <Badge tone="slate">{row.match?.duration || "--:--"}</Badge>
              {row.match?.patch && <Badge tone="purple">{row.match.patch}</Badge>}
            </div>
            <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)] lg:items-center">
              <div className="min-w-0">
                <p className="truncate text-lg font-black text-white">{matchDisplayName(row.match, "Game")}</p>
                <p className="mt-1 truncate text-xs font-semibold text-slate-300">{row.match?.game_id || "Game ID ?"}{matchDate ? ` - ${matchDate}` : ""}</p>
              </div>
            </div>
          </div>
          <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(9rem,.22fr)_minmax(0,1fr)] xl:items-stretch">
            <ParticipantCompareCard title="Mon stuff" row={row} match={row.match} toneName="cyan" />
            <div className="flex min-w-0 flex-col justify-center gap-2 rounded-2xl border border-white/10 bg-black/20 p-3">
              <p className="text-center text-[0.58rem] font-black uppercase tracking-[0.18em] text-slate-300">VS</p>
              <VersusDeltaStack rows={versusDeltas} />
            </div>
            <ParticipantCompareCard title="Son stuff" row={enemyRow} match={row.match} toneName="red" />
          </div>
        </div>

        <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,.82fr)_minmax(0,.82fr)]">
          <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-cyan-100">Performance</p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-4">
              {performanceStats.map(([label, value, toneName]) => <ProfileChampionMini key={label} label={label} value={value} toneName={toneName} />)}
            </div>
          </div>
          <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-cyan-100">Lane vs matchup</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {laneStats.map(([label, value, toneName]) => <ProfileChampionMini key={label} label={label} value={value} toneName={toneName} />)}
            </div>
          </div>
          <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-cyan-100">Impact equipe</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {teamStats.map(([label, value, toneName]) => <ProfileChampionMini key={label} label={label} value={value} toneName={toneName} />)}
            </div>
          </div>
        </div>

        {timeline.length > 0 && <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <div className="flex items-center justify-between gap-3"><p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-fuchsia-100">Timeline achats</p><Badge tone="purple">{timeline.length}</Badge></div>
          <div className="mt-3 grid max-h-56 gap-2 overflow-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">{timeline.map((event, eventIndex) => <div key={`${row.id || row.match?.id}-lane-item-event-${eventIndex}-${event.timestamp}-${event.itemId}`} className="flex min-w-0 items-center gap-2 rounded-xl border border-white/10 bg-black/25 p-2">
            <span className="w-12 shrink-0 rounded-lg border border-cyan-200/15 bg-cyan-400/10 px-2 py-1 text-center text-[0.62rem] font-black text-cyan-50">{event.time}</span>
            <HudIcon sources={itemIconSources(event.itemId)} label={`${event.label} ${itemDisplayName(event.itemId)}`} fallback={event.itemId} emptyText="?" toneName={event.toneName} className="h-9 w-9 shrink-0" />
            <div className="min-w-0"><p className="truncate text-xs font-black text-white">{event.label}</p><p className="truncate text-[0.62rem] font-semibold text-slate-300"><ItemNameText itemId={event.itemId} secondaryId={event.secondaryId} /></p></div>
          </div>)}</div>
        </div>}
      </div>
    </div>
  </details>;
}

function ChampionMiniStat({ label, value, toneName = "cyan" }) {
  return <div className="min-w-0">
    <p className="text-[0.58rem] font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
    <p className={cx("mt-1 truncate font-black", toneName === "green" ? "text-emerald-100" : toneName === "red" ? "text-rose-100" : toneName === "yellow" ? "text-amber-100" : toneName === "purple" ? "text-fuchsia-100" : toneName === "slate" ? "text-slate-200" : "text-white")}>{value}</p>
  </div>;
}

function profileHistorySortKey(row) {
  const raw = row?.match?.created_at || row?.match?.game_date || row?.match?.date || row?.match?.raw?.info?.gameCreation || row?.match?.game_id || "";
  const numeric = Number(raw || 0);
  if (Number.isFinite(numeric) && numeric > 1000000000) return numeric;
  const parsed = Date.parse(String(raw || ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function profileHistoryDateLabel(row) {
  const value = row?.match?.created_at || row?.match?.game_date || row?.match?.date || "";
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" }).format(date);
}

function ProfileHistoryView({ rows = [], selectedCategoryId, navigate }) {
  const [championFilter, setChampionFilter] = useState("");
  const [resultFilter, setResultFilter] = useState("all");
  const orderedRows = rows.slice().sort((a, b) => profileHistorySortKey(b) - profileHistorySortKey(a) || String(b.match?.game_id || "").localeCompare(String(a.match?.game_id || "")));
  const championOptions = Array.from(new Set(orderedRows.map((row) => row.champion).filter(Boolean))).sort((a, b) => championDisplayName(a).localeCompare(championDisplayName(b)));
  const filteredRows = orderedRows.filter((row) => {
    const result = row.match?.result || "";
    return (!championFilter || row.champion === championFilter)
      && (resultFilter === "all" || (resultFilter === "win" ? result === "Victoire" : result === "Défaite"));
  });
  const wins = filteredRows.filter((row) => row.match?.result === "Victoire").length;
  const totalDamage = filteredRows.reduce((sum, row) => sum + Number(row.damage || 0), 0);
  const avgKp = Math.round(filteredRows.reduce((sum, row) => sum + parsePercent(row.kill_participation || row.kp || 0), 0) / Math.max(1, filteredRows.length));
  const resultOptions = [["all", "Toutes"], ["win", "Victoires"], ["loss", "Défaites"]];
  return <ProfileFold title="Historique importé" badge="Games" icon={FileText} toneName="purple">
    <div className="grid gap-3 xl:grid-cols-[minmax(220px,.34fr)_minmax(0,1fr)] xl:items-end">
      <SelectInput label="Champion" value={championFilter} onChange={setChampionFilter}>
        <option value="">Tous les champions</option>
        {championOptions.map((champion) => <option key={champion} value={champion}>{championDisplayName(champion)}</option>)}
      </SelectInput>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="rounded-xl border border-white/10 bg-black/20 p-1">
          <div className="grid gap-1 sm:grid-cols-3">{resultOptions.map(([id, label]) => <button key={id} type="button" onClick={() => setResultFilter(id)} className={cx("rounded-lg px-3 py-2 text-xs font-black uppercase tracking-[0.12em] transition", resultFilter === id ? "bg-cyan-300 text-slate-950 shadow-[0_0_16px_rgba(34,211,238,.22)]" : "text-slate-300 hover:bg-white/[0.055] hover:text-white")}>{label}</button>)}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone={filteredRows.length ? "cyan" : "slate"}>{filteredRows.length}/{rows.length} games</Badge>
          <Badge tone={wins >= filteredRows.length - wins ? "green" : "red"}>{filteredRows.length ? Math.round((wins / Math.max(1, filteredRows.length)) * 100) : 0}% WR</Badge>
          <Badge tone="purple">{formatPoints(totalDamage)} dmg</Badge>
          <Badge tone="yellow">KP {avgKp}%</Badge>
        </div>
      </div>
    </div>
    <div className="mt-4 grid gap-2 xl:grid-cols-2 2xl:grid-cols-3">
      {filteredRows.length ? filteredRows.map((row, index) => {
        const cs10 = csAtMinute(row, 10);
        const cs20 = csAtMinute(row, 20);
        const targetMatchId = row.match?.id || "";
        const enemy = opponentRoleRow(row.match, row.role, row.raw?.participantId || row.participantId);
        const kp = Math.round(parsePercent(row.kill_participation || row.kp || 0));
        return <button key={(row.match?.id || row.match?.game_id || index) + row.champion} type="button" disabled={!targetMatchId} onClick={() => targetMatchId && navigate?.(`/statistiques?match=${encodeURIComponent(targetMatchId)}`)} className={cx("group min-w-0 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left transition hover:border-cyan-300/22 hover:bg-white/[0.055]", targetMatchId ? "cursor-pointer" : "cursor-default opacity-75")}>
          <div className="flex min-w-0 gap-3">
            <ChampionPortrait row={row} champion={row.champion} alt={row.champion} className="h-14 w-14 shrink-0 rounded-xl border border-white/10 object-cover" />
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-wrap items-center gap-2"><Badge tone={row.match?.result === "Victoire" ? "green" : "red"}>{row.match?.result || "Game"}</Badge><Badge tone={row.match?.side === "Blue" ? "blue" : "red"}>{row.match?.side || "Side ?"}</Badge>{row.match?.patch && <Badge tone="slate">{row.match.patch}</Badge>}</div>
              <div className="mt-2 flex min-w-0 items-center gap-2"><p className="truncate text-base font-black text-white">{championDisplayName(row.champion)}</p><span className="ml-auto shrink-0 text-sm font-black text-cyan-100">{row.kills || 0}/{row.deaths || 0}/{row.assists || 0}</span></div>
              <p className="mt-1 truncate text-xs font-semibold text-slate-300">{matchDisplayName(row.match)}{profileHistoryDateLabel(row) ? ` · ${profileHistoryDateLabel(row)}` : ""} · {row.match?.duration || "--:--"}</p>
            </div>
            <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-cyan-100 opacity-70 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
            <ProfileChampionMini label="Dmg" value={formatPoints(row.damage)} toneName="cyan" />
            <ProfileChampionMini label="Gold" value={formatPoints(row.gold)} toneName="yellow" />
            <ProfileChampionMini label="Vision" value={Math.round(Number(row.vision || 0))} toneName="purple" />
            <ProfileChampionMini label="KP" value={`${kp}%`} toneName={kp >= 60 ? "green" : "orange"} />
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {enemy?.champion && <Badge tone="slate">vs {championDisplayName(enemy.champion)}</Badge>}
            <Badge tone="cyan">CS10 {Number.isFinite(cs10) ? cs10 : "-"}</Badge>
            <Badge tone="blue">CS20 {Number.isFinite(cs20) ? cs20 : "-"}</Badge>
            <Badge tone="yellow">Total {row.cs || 0}</Badge>
          </div>
        </button>;
      }) : <EmptyState icon={BarChart3} title="Aucune game" text={rows.length ? "Aucune game ne correspond aux filtres." : selectedCategoryId ? "Aucune game de cette catégorie n’est encore reliée à ce profil." : "Aucune game importée n’est encore reliée à ce profil."} />}
    </div>
  </ProfileFold>;
}

function ProfileFold({ title, badge, icon: Icon = Activity, toneName = "cyan", children }) {
  const [open, setOpen] = useState(true);
  return <Surface glow={open} className="min-w-0 p-4"><button type="button" onClick={() => setOpen((value) => !value)} className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-left transition hover:border-cyan-300/25 hover:bg-white/[0.045]"><div className="flex min-w-0 items-center gap-3"><div className={cx("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border", tone(toneName))}><Icon className="h-4 w-4" /></div><div className="min-w-0"><Badge tone={toneName}>{badge}</Badge><h3 className="mt-2 truncate text-2xl font-black text-white">{title}</h3></div></div><ChevronDown className={cx("h-5 w-5 shrink-0 text-cyan-100 transition", !open && "-rotate-90")} /></button><React.Fragment>{open && <div className="nxt5-enter-fast overflow-hidden"><div className="pt-4">{children}</div></div>}</React.Fragment></Surface>;
}

function ProfileHudMetric({ icon: Icon, label, value, detail, tone: t = "cyan" }) {
  return <div className="min-w-0 rounded-2xl border border-white/10 bg-black/25 p-3 shadow-inner shadow-black/25">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-[0.62rem] font-black uppercase tracking-[0.16em] text-slate-300">{label}</p>
        <p className="mt-2 truncate text-2xl font-black text-white">{value}</p>
      </div>
      {Icon && <div className={cx("shrink-0 rounded-xl border p-2", tone(t))}><Icon className="h-4 w-4" /></div>}
    </div>
    {detail && <p className="mt-2 truncate text-xs font-bold text-slate-300">{detail}</p>}
  </div>;
}

const ITEM_NAME_OVERRIDES = {
  1001: "Bottes",
  1018: "Cape d'agilit\u00e9",
  1036: "\u00c9p\u00e9e longue",
  1037: "Pioche",
  1083: "Abatteur",
  1086: "Arc de Doran",
  2003: "Potion de soin",
};

const ITEM_NAME_CACHE = new Map(Object.entries(ITEM_NAME_OVERRIDES).map(([id, name]) => [Number(id), name]));

let itemNamesPromise = null;

function itemDisplayName(itemId) {
  const id = Number(itemId || 0);
  if (!id) return "";
  return ITEM_NAME_CACHE.get(id) || `Item ${id}`;
}

function loadItemNames() {
  if (itemNamesPromise) return itemNamesPromise;
  const versions = [...new Set([DDRAGON_VERSION, ...DDRAGON_FALLBACK_VERSIONS])];
  itemNamesPromise = (async () => {
    for (const version of versions) {
      try {
        const response = await fetch(assetProxyUrl(`https://ddragon.leagueoflegends.com/cdn/${version}/data/fr_FR/item.json`));
        if (!response.ok) continue;
        const payload = await response.json();
        Object.entries(payload?.data || {}).forEach(([id, item]) => {
          if (item?.name) ITEM_NAME_CACHE.set(Number(id), item.name);
        });
        return ITEM_NAME_CACHE;
      } catch {}
    }
    return ITEM_NAME_CACHE;
  })();
  return itemNamesPromise;
}

function ItemNameText({ itemId, secondaryId = 0 }) {
  const [, setVersion] = useState(0);

  useEffect(() => {
    let mounted = true;
    loadItemNames().then(() => {
      if (mounted) setVersion((value) => value + 1);
    });
    return () => {
      mounted = false;
    };
  }, [itemId, secondaryId]);

  const secondaryName = secondaryId ? itemDisplayName(secondaryId) : "";
  return <>{itemDisplayName(itemId)}{secondaryName ? ` \u2192 ${secondaryName}` : ""}</>;
}

function finalBuildItems(row) {
  const trinket = trinketItemId(row);
  return [
    ...itemSlots(row).filter(Boolean).map((id) => ({ id, type: "item" })),
    ...(trinket ? [{ id: trinket, type: "trinket" }] : []),
  ];
}

function itemEventMeta(type) {
  const normalized = String(type || "").toUpperCase();
  if (normalized === "ITEM_PURCHASED") return { label: "Achat", toneName: "cyan" };
  if (normalized === "ITEM_SOLD") return { label: "Vente", toneName: "orange" };
  if (normalized === "ITEM_DESTROYED") return { label: "Consommé", toneName: "purple" };
  if (normalized === "ITEM_UNDO") return { label: "Annulé", toneName: "pink" };
  return { label: "Item", toneName: "cyan" };
}

function itemBuildTimeline(row) {
  const participantId = rowParticipantId(row);
  if (!participantId) return [];
  return matchTimelineFrames(row?.match).flatMap((frame) => (frame.events || [])
    .filter((event) => ["ITEM_PURCHASED", "ITEM_SOLD", "ITEM_DESTROYED", "ITEM_UNDO"].includes(String(event.type || "").toUpperCase()))
    .filter((event) => Number(event.participantId || event.creatorId || 0) === participantId)
    .map((event) => {
      const meta = itemEventMeta(event.type);
      const itemId = Number(event.itemId || event.beforeId || event.afterId || 0);
      if (!itemId) return null;
      const timestamp = Number(event.timestamp || frame.timestamp || 0);
      const secondaryId = Number(event.type === "ITEM_UNDO" ? event.afterId || 0 : 0);
      return {
        ...meta,
        itemId,
        secondaryId: secondaryId && secondaryId !== itemId ? secondaryId : 0,
        timestamp,
        time: formatCountdown(Math.floor(timestamp / 1000)),
      };
    })
    .filter(Boolean)).sort((a, b) => a.timestamp - b.timestamp);
}

function csMilestoneSummary(rows = []) {
  const valuesAt = (minute) => rows.map((row) => csAtMinute(row, minute)).filter((value) => Number.isFinite(value));
  const average = (values) => values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
  const at10 = valuesAt(10);
  const at20 = valuesAt(20);
  return { at10: average(at10), at20: average(at20), samples: Math.max(at10.length, at20.length) };
}

export { PlayerUltimateProfile, PlayerGoalsPanel, profileLinkAuditRows, ProfileLinkAuditPanel, CoachDiagnosticPanel, CoachReferenceMetric, ProfileChampionsView, ProfileChampionSignal, ProfileChampionAction, ProfileChampionCommandCard, profileChampionStatusMeta, ProfileChampionMini, ProfileChampionDecisionCard, ChampionProfileDetail, ChampionStylePill, ChampionVisualMetric, ChampionReferenceLine, ChampionLanePanel, ChampionLaneGameLine, towerDamage, ParticipantCompareCard, finalBuildItems, itemBuildTimeline, itemEventMeta, VersusDeltaStack, ChampionMiniStat, profileHistoryDateLabel, itemDisplayName, ITEM_NAME_CACHE, ITEM_NAME_OVERRIDES, ItemNameText, loadItemNames, DDRAGON_VERSION, itemNamesPromise, csMilestoneSummary, ProfileChampionPoolView, ProfilePoolReadLine, ProfilePoolChampionRow, ProfileHudMetric, ProfileHistoryView, profileHistorySortKey, ProfileFold };
