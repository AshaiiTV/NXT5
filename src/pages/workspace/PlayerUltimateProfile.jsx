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

import { ProfileNavigation, PROFILE_SECTIONS } from "./ProfileNavigation.jsx";
import "./profile-page.css";
import "./profile-champions.css";

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
  if (complete) return <p className="profile-link-status"><Check aria-hidden="true" className="h-4 w-4" /> {linkedGames} games de l’équipe reliées à ce joueur.</p>;
  return <section className={cx("mt-4 overflow-hidden border-y", complete ? "border-emerald-300/18 bg-emerald-400/[0.045]" : "border-amber-300/20 bg-amber-400/[0.055]")}>
    <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span className={cx("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border", complete ? "border-emerald-300/24 bg-emerald-400/10 text-emerald-100" : "border-amber-300/24 bg-amber-400/10 text-amber-100")}>
          {complete ? <Check className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-black text-white">{complete ? "Toutes les games sont reliées" : `${issues.length} game${issues.length > 1 ? "s" : ""} non reliée${issues.length > 1 ? "s" : ""} à ce joueur`}</p>
          <p className="mt-0.5 text-xs font-semibold text-slate-300">{linkedGames} games reliées sur {matches.length} games équipe. Les autres peuvent concerner un remplaçant.</p>
        </div>
      </div>
      {!complete && <Button type="button" variant="ghost" icon={open ? ChevronDown : ChevronRight} onClick={onToggle} aria-expanded={open}>{open ? "Masquer" : "Voir les games"}</Button>}
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
            <Button type="button" variant="ghost" icon={ArrowRight} onClick={() => openAppPath(`/games?match=${encodeURIComponent(item.match.id)}`)}>Ouvrir</Button>
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

  const linkedPlayer = players.find((player) => player.user_id === user?.id);
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [profileView, setProfileView] = useState(() => profileViewFromPath(route?.path || window.location.pathname));
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedProfileChampion, setSelectedProfileChampion] = useState("");
  const [coachingContent, setCoachingContent] = useState("");
  const [savingCoaching, setSavingCoaching] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState("");
  const [profileLinkAuditOpen, setProfileLinkAuditOpen] = useState(false);
  const [repairingProfileLinkId, setRepairingProfileLinkId] = useState("");
  useEffect(() => {
    const requestedPlayerId = new URLSearchParams(route?.search || window.location.search || "").get("player") || "";
    const requestedPlayer = players.find((player) => String(player.id || "") === String(requestedPlayerId));
    const fallback = requestedPlayer?.id || linkedPlayer?.id || players[0]?.id;
    setSelectedPlayerId((current) => requestedPlayer?.id || (players.some((player) => player.id === current) ? current : fallback || ""));
  }, [linkedPlayer?.id, players.map((player) => player.id).join("|"), route?.search]);
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
    if (viewId === profileView) return;
    const nextView = viewId;
    setProfileView(nextView);
    navigate?.(`${profilePathFromView(nextView)}${route?.search || window.location.search || ""}`);
  }
  function selectProfile(playerId) {
    setSelectedPlayerId(playerId);
    const params = new URLSearchParams(route?.search || window.location.search || "");
    params.set("player", playerId);
    navigate?.(`${profilePathFromView(profileView)}?${params.toString()}`, { replace: true });
  }
  const selectedPlayer = players.find((player) => player.id === selectedPlayerId) || linkedPlayer || players[0];
  const coachingNote = (data.profileCoachingNotes || []).find((note) => note.team_id === selectedTeamId && note.player_id === selectedPlayer?.id);
  const canEditCoaching = (data.teams || []).some((team) => team.id === selectedTeamId && team.owner_id === user?.id) || canStaffManage(currentMember?.role);
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
  const losses = rows.filter((row) => row.match?.result === "Défaite").length;
  const knownResults = wins + losses;
  const metricRows = (field) => rows.filter((row) => profileChampionValue(row, field) !== null);
  const meanMetric = (field, decimals = 1) => profileChampionAverage(rows, (row) => profileChampionValue(row, field), decimals).value;
  const avg = meanMetric;
  const kda = profileChampionNumber(profileChampionKda(rows).ratio, 2);
  const kpRows = rows.filter((row) => (row.kill_participation ?? row.kp) != null && (row.kill_participation ?? row.kp) !== "" && Number.isFinite(parsePercent(row.kill_participation ?? row.kp)));
  const avgKp = kpRows.length ? kpRows.reduce((total, row) => total + parsePercent(row.kill_participation ?? row.kp), 0) / kpRows.length : null;
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
  }, new Map()).values()).map((stat) => ({ ...stat, winrate: profileChampionResults(stat.rows).rate, kda: profileChampionNumber(profileChampionKda(stat.rows).ratio, 2) })).sort((a, b) => b.games - a.games || b.winrate - a.winrate);
  const activeProfileChampion = selectedProfileChampion || championStats[0]?.champion || "";

  const deathRows = metricRows("deaths");
  const avgDeaths = deathRows.length ? deathRows.reduce((total, row) => total + profileChampionValue(row, "deaths"), 0) / deathRows.length : null;

  const topChampion = championStats[0];
  const topChampionShare = topChampion ? Math.round((topChampion.games / Math.max(1, games)) * 100) : 0;
  const sortedProfileRows = rows.slice().sort((a, b) => profileHistorySortKey(b) - profileHistorySortKey(a));

	  const globalCs = csMilestoneSummary(rows);

	  const cs20Values = rows.map((row) => csAtMinute(row, 20)).filter((value) => Number.isFinite(value));

	  const cs10Target = { TOP: 70, MID: 72, ADC: 74, JGL: 56, SUP: null }[normalizeProfileRole(selectedPlayer?.role)] ?? null;
	  const cs10Values = rows.map((row) => csAtMinute(row, 10)).filter((value) => Number.isFinite(value));

	  const highDeathRows = deathRows.filter((row) => profileChampionValue(row, "deaths") >= Math.max(4, Math.ceil(avgDeaths + 1)));
	  const lowKpRows = kpRows.filter((row) => parsePercent(row.kill_participation ?? row.kp) < 50);
	  const lowCsRows = cs10Target ? rows.filter((row) => { const value = csAtMinute(row, 10); return Number.isFinite(value) && value < cs10Target - 8; }) : [];

  const coachSignals = games ? [
    cs10Target && globalCs.at10 !== null && globalCs.at10 < cs10Target - 8 && { kind: "issue", priority: 94, title: "Vérifier le farm en début de game", text: `${globalCs.at10} CS à 10 min en moyenne sur ${cs10Values.length} games renseignées. Le repère proposé pour le poste est de ${cs10Target} CS ; il reste à adapter au matchup.`, action: "Revoir les premières waves et le premier retour à la base, puis comparer le farm à 10 minutes sur les prochaines games.", toneName: "cyan", icon: Target, rows: lowCsRows },
    highDeathRows.length > 0 && { kind: "issue", priority: 88, title: "Revoir les games avec le plus de morts", text: `${highDeathRows.length} games atteignent au moins ${Math.max(4, Math.ceil(avgDeaths + 1))} morts, pour ${avgDeaths.toFixed(1)} en moyenne sur la sélection. Le score seul ne dit pas si ces morts étaient évitables.`, action: "Classer les morts par contexte : wave, vision ou fight. Choisir ensuite une situation à mieux préparer.", toneName: "cyan", icon: Shield, rows: highDeathRows },
    lowKpRows.length > 0 && { kind: "issue", priority: 84, title: "Vérifier la participation aux kills", text: `${lowKpRows.length} games sont sous 50 % de participation aux kills de l’équipe. Une stratégie de splitpush peut expliquer cet écart.`, action: "Revoir le placement et les déplacements avant les objectifs. Vérifier si le joueur devait rejoindre son équipe ou maintenir la pression sur une lane.", toneName: "cyan", icon: Swords, rows: lowKpRows },
    topChampionShare >= 65 && { kind: "issue", priority: 68, title: "Préparer une alternative au champion le plus joué", text: `${championDisplayName(topChampion.champion)} représente ${topChampionShare} % des ${games} games analysées. Ce volume décrit les habitudes de draft, pas la qualité du pool.`, action: `Vérifier dans le pool déclaré quelle alternative jouer si ${championDisplayName(topChampion.champion)} est indisponible.`, toneName: "cyan", icon: Crown, rows: topChampion.rows },
    { kind: "strength", priority: 1, title: "Choisir un point à confirmer en review", text: "Ces résultats donnent des repères. Ils ne suffisent pas à déterminer, seuls, une priorité de progression.", action: "Ouvrir une game récente, choisir un comportement observable et le suivre sur le prochain bloc.", toneName: "cyan", icon: Target, rows: sortedProfileRows.slice(0, 3) },
  ].filter(Boolean).sort((a, b) => b.priority - a.priority) : [];

	  const coachIssues = coachSignals.filter((item) => item.kind === "issue").slice(0, 4);
	  const coachStrengths = coachSignals.filter((item) => item.kind === "strength").slice(0, 3);
  const coachDecisions = [
    { label: "Prochaine étape à tester", text: coachIssues[0]?.action || coachStrengths[0]?.action || "Importer des games pour préparer la review.", toneName: "cyan" },
    { label: "Périmètre", text: `${games} games · ${activeProfileCategory?.name || "Tous les contextes"}`, toneName: "cyan" },
  ];

  const coachVerdict = coachIssues[0]?.title || coachStrengths[0]?.title || "Aucune game analysée";
  const coachSummary = coachIssues.length ? coachIssues[0].text : coachStrengths[0]?.text || "Importe quelques games supplémentaires pour obtenir un bilan.";

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
      meta: `${games} games · ${activeProfileCategory?.name || "Tous les contextes"}`,
    });
    const metrics = [
      ["Games", String(games), `${wins} victoires · ${losses} défaites`, "cyan"],
      ["Victoires", knownResults ? `${Math.round(wins / knownResults * 100)}%` : "—", `${knownResults} résultats connus`, wins >= losses ? "green" : "orange"],
      ["KDA", kda, `${avg("kills")}/${avg("deaths")}/${avg("assists")} moy.`, "cyan"],
      ["Participation", avgKp === null ? "—" : `${Math.round(avgKp)}%`, "Participation aux kills", avgKp >= 60 ? "green" : "yellow"],
      ["Dégâts", meanMetric("damage", 0), "Moyenne / game", "purple"],
      ["Vision", meanMetric("vision", 0), "Moyenne / game", "orange"],
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
      fit(stat.winrate === null ? "—" : `${Math.round(stat.winrate)}%`, winrateX, y + 31, 100, { font: "600 18px Inter, Arial, sans-serif", color: stat.winrate >= 50 ? PNG_THEME.green : PNG_THEME.red, align: "right" });
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

  async function downloadProfile() {
    if (exporting) return;
    setExporting(true); setExportStatus("");
    try { await exportProfilePng(); setExportStatus("Le résumé PNG a été téléchargé."); }
    catch (error) { setExportStatus("Le téléchargement a échoué. Réessaie dans un instant."); pushToast?.({ type: "red", title: "Export impossible", text: error.message }); }
    finally { setExporting(false); }
  }
  const metrics = [
    { label: "Victoires", value: knownResults ? `${Math.round(wins / knownResults * 100)} %` : "—", detail: `${wins} victoires · ${losses} défaites${knownResults < games ? ` · ${games - knownResults} résultats inconnus` : ""}`, toneName: "cyan" },
    { label: "Participation aux kills", value: kpRows.length ? `${Math.round(kpRows.reduce((total, row) => total + parsePercent(row.kill_participation ?? row.kp), 0) / kpRows.length)} %` : "—", detail: `Moyenne · ${kpRows.length} games renseignées` },
    { label: "Morts par game", value: meanMetric("deaths"), detail: `Moyenne · ${metricRows("deaths").length} games renseignées` },
    { label: "Farm à 10 min", value: globalCs.at10 === null ? "—" : `${globalCs.at10} CS`, detail: `Moyenne · ${cs10Values.length} games renseignées` },
  ];
  if (!selectedPlayer) return <div className="nxt5-profile-page"><PageHeader eyebrow="Équipe" title="Profils joueurs" subtitle="Les résultats, les champions et le suivi de chaque joueur." /><Surface><EmptyState icon={Activity} title="Aucun profil joueur" text="Ajoute un joueur dans la gestion de l’équipe pour consulter son profil." /><Button type="button" variant="ghost" onClick={() => openAppPath("/equipes")}>Gérer les joueurs</Button></Surface></div>;
  return <div className="nxt5-data-dense nxt5-profile-page">
    <PageHeader eyebrow="Profil joueur" title={selectedPlayer.name} subtitle={`${roleLabel(selectedPlayer.role)} · ${selectedPlayer.riot_id || "Riot ID non renseigné"}${selectedPlayer.user_id === user?.id ? " · Ton profil" : ""}`}>
      <Button type="button" variant="ghost" icon={exporting ? Loader2 : Download} onClick={downloadProfile} disabled={exporting || !games}>{exporting ? "Export en cours…" : "Exporter le résumé"}</Button>
    </PageHeader>
    {exportStatus && <p role="status" className="profile-notice">{exportStatus}</p>}
    <div className="profile-context">
      <div className="profile-filters">
        <SelectInput label="Joueur" value={selectedPlayer.id} onChange={selectProfile}>{players.map((player) => <option key={player.id} value={player.id}>{roleLabel(player.role)} · {player.name}</option>)}</SelectInput>
        <SelectInput label="Contexte des games" value={selectedCategoryId} onChange={setSelectedCategoryId}><option value="">Toutes les games</option>{matchCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</SelectInput>
      </div>
      <div className="profile-scope"><p><strong>{games} games analysées</strong> · {activeProfileCategory?.name || "Tous les contextes"}{rows.length ? ` · ${profileHistoryDateLabel(sortedProfileRows[sortedProfileRows.length - 1]) || "date inconnue"} au ${profileHistoryDateLabel(sortedProfileRows[0]) || "date inconnue"}` : ""}</p>{selectedCategoryId && <button type="button" className="profile-text-action" onClick={() => setSelectedCategoryId("")}>Réinitialiser le contexte</button>}</div>
    </div>
    <ProfileNavigation activeId={profileView} onChange={openProfileView} />
    <section id="profile-panel" role="tabpanel" aria-label={PROFILE_SECTIONS.find((section) => section.id === profileView)?.label} tabIndex={0} className="profile-content" key={`${selectedPlayer.id}-${selectedCategoryId}-${profileView}`}>
      {profileView === "overview" && <>
        {games > 0 ? <>
          <Surface><div className="profile-section-heading"><h3>Le joueur en un regard</h3><span>Sur la sélection ci-dessus</span></div><dl className="profile-metrics">{metrics.map((metric) => <div key={metric.label}><dt>{metric.label}</dt><dd>{metric.value}</dd><p>{metric.detail}</p></div>)}</dl>{games < 5 && <p className="profile-sample-note">Échantillon limité : {games} games. Confirme les observations sur les prochaines sessions.</p>}</Surface>
          <CoachDiagnosticPanel player={selectedPlayer} games={games} issues={coachIssues} strengths={coachStrengths} onFollowUp={() => { openProfileView("coaching"); requestAnimationFrame(() => document.getElementById("profile-panel")?.focus()); }} />
          <details className="profile-disclosure"><summary>Autres statistiques et aide à la lecture</summary><dl className="profile-secondary-stats"><div><dt>Ratio KDA</dt><dd>{kda}</dd><p>(Kills + assists) ÷ morts, avec un minimum de 1 mort au dénominateur.</p></div><div><dt>Dégâts aux champions</dt><dd>{meanMetric("damage", 0)}</dd><p>Moyenne par game renseignée.</p></div><div><dt>Score de vision</dt><dd>{meanMetric("vision")}</dd><p>Moyenne par game renseignée.</p></div><div><dt>Farm à 20 min</dt><dd>{globalCs.at20 === null ? "—" : `${globalCs.at20} CS`}</dd><p>{cs20Values.length} games renseignées.</p></div></dl><p>La participation aux kills mesure les kills et assists du joueur rapportés aux kills de son équipe. Les CS comptent les sbires et monstres tués. « — » indique une donnée indisponible. Ces statistiques décrivent un résultat ; elles ne démontrent pas sa cause.</p></details>
        </> : <Surface><EmptyState icon={Activity} title="Aucune game dans cette sélection" text={selectedCategoryId ? "Change le contexte pour retrouver les résultats de ce joueur." : "Les résultats apparaîtront dès qu’une game importée sera reliée à ce joueur."} /><Button type="button" variant="ghost" onClick={() => selectedCategoryId ? setSelectedCategoryId("") : openAppPath("/games?import=1")}>{selectedCategoryId ? "Voir tous les contextes" : "Importer des games"}</Button></Surface>}
        <ProfileLinkAuditPanel player={selectedPlayer} matches={filteredMatches} issues={profileLinkIssues} open={profileLinkAuditOpen} canRepair={canRepairProfileLinks} repairingId={repairingProfileLinkId} onToggle={() => setProfileLinkAuditOpen((value) => !value)} onRepair={repairProfileLink} />
      </>}
      {profileView === "champions" && <ProfileChampionsView championStats={championStats} selectedChampion={activeProfileChampion} onSelectChampion={setSelectedProfileChampion} selectedPlayer={selectedPlayer} selectedCategoryId={selectedCategoryId} navigate={navigate} bootstrapRevision={data.bootstrapRevision} />}
      {profileView === "pool" && <ProfileChampionPoolView championPool={championPool} championStats={championStats} selectedPlayer={selectedPlayer} pushToast={pushToast} />}
      {profileView === "history" && <ProfileHistoryView rows={rows} selectedCategoryId={selectedCategoryId} navigate={navigate} />}
      {profileView === "coaching" && <>
        <div className="profile-followup-intro"><h3>Objectifs et notes</h3><p>Les objectifs suivent les games du contexte sélectionné. Les notes restent communes à tous les contextes du joueur.</p></div>
        <div className="profile-goals"><React.Suspense fallback={<p role="status" className="profile-notice">Chargement des objectifs…</p>}><PlayerGoalsPanel goals={data.playerGoals || []} rows={rows} player={selectedPlayer} selectedTeamId={selectedTeamId} canManage={canRepairProfileLinks} refreshAll={refreshAll} pushToast={pushToast} /></React.Suspense></div>
        <Surface><div className="profile-section-heading"><h3>Notes de suivi</h3><span>{coachingNote?.updated_at ? `Mise à jour le ${new Date(coachingNote.updated_at).toLocaleString("fr-FR")}` : "Aucune note enregistrée"}{coachingNote?.updated_by_name ? ` · ${coachingNote.updated_by_name}` : ""}</span></div>
          <label className="profile-notes"><span>Bilan du joueur et prochaine étape</span><textarea value={coachingContent} onChange={(event) => setCoachingContent(event.target.value.slice(0, 4000))} readOnly={!canEditCoaching} rows={8} maxLength={4000} placeholder="Ce qui progresse, le point à travailler, la prochaine étape…" /></label>
          <div className="profile-scope"><p>{coachingContent.length} / 4 000 caractères{coachingContent !== (coachingNote?.content || "") ? " · Modifications non enregistrées" : ""}</p>{canEditCoaching && <Button type="button" icon={savingCoaching ? Loader2 : Check} disabled={savingCoaching || coachingContent === (coachingNote?.content || "")} onClick={saveCoachingNote}>{savingCoaching ? "Enregistrement…" : "Enregistrer les notes"}</Button>}</div>
        </Surface>
      </>}
    </section>
  </div>;
}

function CoachDiagnosticPanel({ player, games, issues = [], strengths = [], onFollowUp }) {
  if (!games) return null;
  const priority = issues[0] || strengths[0];
  if (!priority) return null;
  const otherSignals = issues.slice(1);
  return <Surface className="profile-review">
    <p className="profile-eyebrow">Piste de review · à confirmer</p>
    <h3>{priority.title}</h3>
    <p className="profile-copy">{priority.text}</p>
    <div className="profile-next-step"><h4>Au prochain bloc</h4><p>{priority.action}</p>{onFollowUp && <button type="button" onClick={onFollowUp} className="profile-text-action">Ouvrir les objectifs et les notes <ArrowRight aria-hidden="true" /></button>}</div>
    <details className="profile-disclosure"><summary>Voir les games à l’origine de cette piste <span>{priority.rows?.length || 0} games</span></summary><div className="profile-evidence">{(priority.rows || []).slice(0, 5).map((row, index) => <a key={row.match?.id || index} href={`/games?match=${encodeURIComponent(row.match?.id || "")}`} onClick={(event) => { event.preventDefault(); openAppPath(`/games?match=${encodeURIComponent(row.match?.id || "")}`); }}><span><strong>{matchDisplayName(row.match)}</strong><small>{championDisplayName(row.champion)} · {profileHistoryDateLabel(row)} · {row.kills ?? "—"} / {row.deaths ?? "—"} / {row.assists ?? "—"} kills / morts / assists</small></span><ArrowRight aria-hidden="true" /></a>)}</div>{priority.rows?.length > 5 && <p>Les 5 premières games sont affichées. Retrouve toutes les sources dans l’historique.</p>}</details>
    {otherSignals.length > 0 && <details className="profile-disclosure"><summary>Autres pistes à vérifier <span>{otherSignals.length}</span></summary>{otherSignals.map((item) => <article className="profile-other-signal" key={item.title}><h4>{item.title}</h4><p>{item.text}</p><p>{item.action}</p></article>)}</details>}
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

function ProfileChampionsView({ championStats = [], selectedChampion, onSelectChampion, selectedPlayer, selectedCategoryId, navigate, bootstrapRevision }) {
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState("volume");
  const [openedChampion, setOpenedChampion] = useState("");
  const rootRef = React.useRef(null);
  const focusTarget = React.useRef("");
  const totalGames = championStats.reduce((total, stat) => total + Number(stat.games || 0), 0);
  const activeStat = championStats.find((stat) => stat.champion === openedChampion) || null;
  const sortedStats = championStats.filter((stat) => championDisplayName(stat.champion).toLocaleLowerCase("fr").includes(query.trim().toLocaleLowerCase("fr"))).slice().sort((a, b) => {
    if (sortMode === "wr") return (profileChampionResults(b.rows).rate ?? -1) - (profileChampionResults(a.rows).rate ?? -1) || b.games - a.games;
    if (sortMode === "kda") return (profileChampionKda(b.rows).ratio ?? -1) - (profileChampionKda(a.rows).ratio ?? -1) || b.games - a.games;
    if (sortMode === "name") return championDisplayName(a.champion).localeCompare(championDisplayName(b.champion), "fr");
    return b.games - a.games || championDisplayName(a.champion).localeCompare(championDisplayName(b.champion), "fr");
  });
  useEffect(() => {
    setOpenedChampion("");
    setQuery("");
    focusTarget.current = "";
  }, [selectedPlayer?.id, selectedCategoryId]);
  useEffect(() => {
    if (!focusTarget.current) return;
    const target = focusTarget.current;
    focusTarget.current = "";
    if (target === "detail") rootRef.current?.querySelector("h3")?.focus();
    else {
      const trigger = Array.from(rootRef.current?.querySelectorAll("[data-champion]") || []).find((node) => node.dataset.champion === target);
      (trigger || rootRef.current?.querySelector("h3"))?.focus();
    }
  }, [openedChampion]);
  const openChampion = (champion) => {
    focusTarget.current = "detail";
    setOpenedChampion(champion);
    onSelectChampion?.(champion);
  };
  const backToList = () => {
    focusTarget.current = openedChampion;
    setOpenedChampion("");
  };
  if (!championStats.length) return <Surface><EmptyState icon={Crown} title="Aucun champion joué" text={selectedCategoryId ? "Aucune game dans ce contexte pour ce profil." : "Importe une game pour retrouver les champions joués."} /></Surface>;
  return <div className="profile-champions" ref={rootRef}>
    {activeStat ? <>
      <Button type="button" variant="ghost" onClick={backToList} className="profile-champions-back"><ArrowRight aria-hidden="true" className="h-4 w-4 rotate-180" />Retour aux champions</Button>
      <Surface><ChampionProfileDetail key={activeStat.champion} stat={activeStat} rows={activeStat.rows || []} navigate={navigate} bootstrapRevision={bootstrapRevision} /></Surface>
    </> : <Surface>
      <header className="profile-champions-heading">
        <div><h3 tabIndex={-1}>Champions joués</h3><p>{championStats.length} champion{championStats.length > 1 ? "s" : ""} sur {totalGames} game{totalGames > 1 ? "s" : ""} dans le périmètre sélectionné.</p></div>
        <p>Choisis un champion pour voir ses résultats, ses adversaires et ses équipements.</p>
      </header>
      <div className="profile-champions-toolbar">
        <label className="profile-champions-search"><span>Rechercher un champion</span><div><Search aria-hidden="true" className="h-4 w-4" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nom du champion" /></div></label>
        <SelectInput label="Trier les champions" value={sortMode} onChange={setSortMode}><option value="volume">Nombre de games</option><option value="wr">Taux de victoire</option><option value="kda">Ratio KDA</option><option value="name">Nom du champion</option></SelectInput>
      </div>
      <p className="profile-champions-meta" role="status">{sortedStats.length} champion{sortedStats.length > 1 ? "s" : ""} affiché{sortedStats.length > 1 ? "s" : ""}</p>
      <div className="profile-champions-list">
        {sortedStats.length ? sortedStats.map((stat) => <ProfileChampionCommandCard key={stat.champion} stat={stat} onClick={() => openChampion(stat.champion)} active={selectedChampion === stat.champion} />) : <p className="profile-champions-empty">Aucun champion ne correspond à « {query} ».</p>}
      </div>
      <details className="profile-champions-help"><summary>Comment lire ces résultats ?</summary><p>Le taux de victoire porte sur les games dont le résultat est connu. Le ratio KDA vaut (kills + assists) ÷ morts, avec un diviseur de 1 si le total des morts est nul. Les résultats décrivent les games importées ; quelques games ne suffisent pas à établir la maîtrise d’un champion ni à décider d’un pick.</p></details>
    </Surface>}
  </div>;
}

function profileChampionNumber(value, decimals = 0) {
  return value === null || value === undefined || value === "" || !Number.isFinite(Number(value)) ? "—" : Number(value).toLocaleString("fr-FR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function profileChampionResults(rows = []) {
  const known = rows.filter((row) => ["Victoire", "Défaite"].includes(row.match?.result));
  const wins = known.filter((row) => row.match?.result === "Victoire").length;
  return { count: known.length, wins, losses: known.length - wins, rate: known.length ? wins / known.length * 100 : null };
}

function profileChampionValue(row, field) {
  const aliases = { damage: ["damage", "totalDamageDealtToChampions"], gold: ["gold", "goldEarned"], vision: ["vision", "visionScore"], cs_per_min: ["cs_per_min"], damage_to_turrets: ["damage_to_turrets", "damageToTurrets", "damageDealtToTurrets"] };
  for (const source of [row, row?.raw, row?.raw?.stats]) {
    for (const key of aliases[field] || [field]) {
      const value = source?.[key];
      if (value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value))) return Number(value);
    }
  }
  return null;
}

function profileChampionAverage(rows, getter, decimals = 1, unit = "") {
  const values = rows.map(getter).filter((value) => value !== null && value !== undefined && Number.isFinite(value));
  return { value: values.length ? `${profileChampionNumber(values.reduce((sum, value) => sum + value, 0) / values.length, decimals)}${unit}` : "—", detail: `${values.length}/${rows.length} games renseignées` };
}

function profileChampionKda(rows = []) {
  const known = rows.filter((row) => ["kills", "deaths", "assists"].every((field) => profileChampionValue(row, field) !== null));
  const sum = (field) => known.reduce((total, row) => total + profileChampionValue(row, field), 0);
  return { ratio: known.length ? (sum("kills") + sum("assists")) / Math.max(1, sum("deaths")) : null, count: known.length, kills: sum("kills"), deaths: sum("deaths"), assists: sum("assists") };
}

function ProfileChampionSignal({ label, value, detail }) {
  return <ChampionVisualMetric label={label} value={value} detail={detail} />;
}

function ProfileChampionAction({ item, onSelect }) {
  const content = <><span><strong>{item.title}</strong><span>{item.text}</span></span>{onSelect && <ArrowRight aria-hidden="true" className="h-4 w-4" />}</>;
  return onSelect ? <button type="button" onClick={onSelect} className="profile-champions-action">{content}</button> : <div className="profile-champions-action">{content}</div>;
}

function profileChampionStatusMeta() {
  return { label: "Résultats observés", toneName: "cyan", text: "À interpréter selon le nombre de games" };
}

function ProfileChampionCommandCard({ stat, onClick }) {
  const results = profileChampionResults(stat.rows);
  return <button type="button" onClick={onClick} data-champion={stat.champion} className="profile-champion-row" aria-label={`Voir ${championDisplayName(stat.champion)}, ${stat.games} games`}>
    <span className="profile-champion-identity"><ChampionPortrait champion={stat.champion} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" /><span><strong>{championDisplayName(stat.champion)}</strong><span className="profile-champions-meta">{stat.games < 5 ? "Peu de games : à confirmer" : `${results.wins} victoire${results.wins > 1 ? "s" : ""} · ${results.losses} défaite${results.losses > 1 ? "s" : ""}`}</span></span></span>
    <span className="profile-champion-row-metrics"><ProfileChampionMini label="Games" value={stat.games} /><ProfileChampionMini label="Victoires" value={results.rate === null ? "—" : `${profileChampionNumber(results.rate)} %`} /><ProfileChampionMini label="Ratio KDA" value={profileChampionNumber(profileChampionKda(stat.rows).ratio, 2)} /></span>
    <span className="profile-champion-row-action">Voir le détail<ArrowRight aria-hidden="true" className="h-4 w-4" /></span>
  </button>;
}

function ProfileChampionMini({ label, value, toneName = "cyan" }) {
  return <span className={`profile-champion-mini profile-champion-tone-${toneName}`}><span>{label}</span><strong>{value}</strong></span>;
}

function ProfileChampionDecisionCard({ stat }) {
  if (!stat) return null;
  return <p className="profile-champions-note">Ces résultats portent sur {stat.games} game{stat.games > 1 ? "s" : ""}. Ils donnent des points à vérifier en review, sans prédire la réussite du prochain pick.</p>;
}

function ProfileChampionPoolView({ championPool = [], championStats = [], selectedPlayer, pushToast }) {
  const [exporting, setExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState("");
  const statsByChampion = new Map(championStats.map((stat) => [championAssetId(stat.champion), stat]));
  const rowsByTier = Object.fromEntries(CHAMPION_TIERS.map((tier) => [tier.id, championPool.filter((row) => championPoolStatus(row) === tier.id).sort((a, b) => championDisplayName(a.champion).localeCompare(championDisplayName(b.champion)))]));
  async function downloadPool() {
    setExporting(true); setExportStatus("");
    try { await exportChampionTierListPng({ player: selectedPlayer, rowsByTier, pushToast }); setExportStatus("La tier list PNG a été téléchargée."); }
    catch (error) { setExportStatus("L’export a échoué. Réessaie dans un instant."); }
    finally { setExporting(false); }
  }
  return <Surface>
    <div className="profile-section-heading"><div><h3>Pool déclaré</h3><p>Les champions et leur statut renseignés pour {selectedPlayer?.name}. Les résultats affichés utilisent le contexte sélectionné.</p></div><Button type="button" variant="ghost" icon={exporting ? Loader2 : Download} disabled={!championPool.length || exporting} onClick={downloadPool}>{exporting ? "Export en cours…" : "Exporter la tier list"}</Button></div>
    {exportStatus && <p role="status" className="profile-notice">{exportStatus}</p>}
    {championPool.length ? <div className="profile-pool-list">{CHAMPION_TIERS.map((tier) => <section key={tier.id} className="profile-pool-tier"><header><div><h4>{tier.id === "danger" ? "En entraînement" : tier.title}</h4><p>{tier.hint}</p></div><span>{rowsByTier[tier.id].length} champions</span></header>{rowsByTier[tier.id].length ? rowsByTier[tier.id].map((row, index) => <ProfilePoolChampionRow key={row.id || `${row.champion}-${index}`} row={row} stat={statsByChampion.get(championAssetId(row.champion))} selectedPlayer={selectedPlayer} />) : <p className="profile-empty-tier">Aucun champion dans cette catégorie.</p>}</section>)}</div> : <EmptyState icon={Shield} title="Aucun champion déclaré" text="Renseigne le pool du joueur dans l’espace Draft pour préparer ses options." />}
    <div className="profile-pool-footer"><p>Les statuts sont déclarés par l’équipe. Ils ne sont pas calculés à partir du taux de victoire.</p><Button type="button" variant="ghost" onClick={() => openAppPath("/draft/pool")}>Gérer les pools dans Draft <ArrowRight aria-hidden="true" className="h-4 w-4" /></Button></div>
  </Surface>;
}

function ProfilePoolReadLine({ label, value, detail, toneName = "cyan" }) {
  return <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(70px,.35fr)] items-center gap-3 py-3">
    <div className="min-w-0"><p className="truncate text-xs font-black uppercase tracking-[0.14em] text-slate-400">{label}</p><p className="mt-1 truncate text-xs font-semibold text-slate-300">{detail}</p></div>
    <p className={cx("truncate text-right text-sm font-black", toneName === "green" ? "text-emerald-100" : toneName === "yellow" ? "text-amber-100" : toneName === "red" ? "text-rose-100" : "text-cyan-100")}>{value}</p>
  </div>;
}

function ProfilePoolChampionRow({ row, stat }) {
  return <div className="profile-pool-champion"><div className="profile-champion-name"><ChampionPortrait row={row} champion={row.champion} alt="" className="h-11 w-11 rounded-lg object-cover" /><strong>{championDisplayName(row.champion)}</strong></div><div className="profile-pool-result">{stat ? <><span><b>{stat.games}</b> games analysées</span><span><b>{stat.winrate === null ? "—" : `${Math.round(stat.winrate)} %`}</b> de victoires</span><span><b>{stat.kda}</b> KDA</span></> : <span>Aucune game analysée dans ce contexte</span>}</div></div>;
}

function ChampionProfileDetail({ stat, rows = [], navigate, bootstrapRevision }) {
  const sortedRows = rows.slice().sort((a, b) => profileHistorySortKey(b) - profileHistorySortKey(a));
  const results = profileChampionResults(rows);
  const kda = profileChampionKda(rows);
  const csPerMin = profileChampionAverage(rows, (row) => profileChampionValue(row, "cs_per_min"), 1, " / min");
  const participation = profileChampionAverage(rows, profileChampionParticipation, 0, " %");
  const references = [
    { label: "Dégâts aux champions", ...profileChampionAverage(rows, (row) => profileChampionValue(row, "damage"), 0, " dégâts / game") },
    { label: "Or gagné", ...profileChampionAverage(rows, (row) => profileChampionValue(row, "gold"), 0, " or / game") },
    { label: "Score de vision", ...profileChampionAverage(rows, (row) => profileChampionValue(row, "vision"), 1, " / game") },
    { label: "Sbires à 10 minutes", ...profileChampionAverage(rows, (row) => csAtMinute(row, 10), 0, " CS") },
    { label: "Sbires à 20 minutes", ...profileChampionAverage(rows, (row) => csAtMinute(row, 20), 0, " CS") },
  ];
  const matchups = Array.from(rows.reduce((map, row) => {
    const enemy = opponentRoleRow(row.match, row.role, rowParticipantId(row));
    if (!enemy?.champion) return map;
    const current = map.get(enemy.champion) || { champion: enemy.champion, rows: [] };
    current.rows.push(row);
    map.set(enemy.champion, current);
    return map;
  }, new Map()).values()).sort((a, b) => b.rows.length - a.rows.length || championDisplayName(a.champion).localeCompare(championDisplayName(b.champion), "fr"));
  return <div className="profile-champions profile-champion-detail">
    <header className="profile-champion-detail-heading">
      <ChampionPortrait champion={stat.champion} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
      <div><h3 tabIndex={-1}>{championDisplayName(stat.champion)}</h3><p>{rows.length} game{rows.length > 1 ? "s" : ""} · {results.wins} victoire{results.wins > 1 ? "s" : ""} · {results.losses} défaite{results.losses > 1 ? "s" : ""}{results.count < rows.length ? ` · ${rows.length - results.count} résultat(s) inconnu(s)` : ""}</p></div>
    </header>
    {rows.length < 5 && <p className="profile-champions-note">Peu de games : lis ces résultats comme des observations à confirmer en review.</p>}
    <div className="profile-champion-metrics">
      <ChampionVisualMetric label="Taux de victoire" value={results.rate === null ? "—" : `${profileChampionNumber(results.rate)} %`} detail={`${results.count}/${rows.length} résultats connus`} />
      <ChampionVisualMetric label="Ratio KDA" value={profileChampionNumber(kda.ratio, 2)} detail={`${kda.count}/${rows.length} games renseignées${kda.count ? ` · ${kda.kills} kills / ${kda.deaths} morts / ${kda.assists} assists au total` : ""}`} />
      <ChampionVisualMetric label="Participation aux kills" value={participation.value} detail={participation.detail} />
      <ChampionVisualMetric label="Sbires par minute" value={csPerMin.value} detail={csPerMin.detail} />
    </div>
    <ChampionLanePanel rows={sortedRows} navigate={navigate} bootstrapRevision={bootstrapRevision} />
    <details className="profile-champions-fold"><summary>Statistiques moyennes et adversaires <span>{matchups.length} adversaire{matchups.length > 1 ? "s" : ""} reconnu{matchups.length > 1 ? "s" : ""}</span></summary>
      <div className="profile-champion-reference-grid">{references.map((item) => <ChampionReferenceLine key={item.label} {...item} />)}</div>
      <h4>Résultats par adversaire de même rôle</h4><p className="profile-champions-meta">Le résultat est celui de la game entière ; il ne mesure pas à lui seul le duel de lane.</p>
      <div className="profile-champion-matchups">{matchups.length ? matchups.map((item) => {
        const outcome = profileChampionResults(item.rows);
        return <div className="profile-champion-matchup" key={item.champion}><span className="profile-champion-identity"><ChampionPortrait champion={item.champion} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" /><strong>{championDisplayName(item.champion)}</strong></span><span>{item.rows.length} game{item.rows.length > 1 ? "s" : ""}</span><span>{outcome.rate === null ? "Résultat indisponible" : `${profileChampionNumber(outcome.rate)} % de victoires`}<small>{outcome.count} résultat{outcome.count > 1 ? "s" : ""} connu{outcome.count > 1 ? "s" : ""}</small></span></div>;
      }) : <p>Aucun adversaire de même rôle identifié.</p>}</div>
    </details>
    <details className="profile-champions-help"><summary>Comment lire les statistiques de ce champion ?</summary><p>Le ratio KDA vaut (kills + assists) ÷ morts, avec un diviseur de 1 si le total des morts est nul. La participation aux kills est la part des kills de l’équipe auxquels le joueur a participé. Les CS comptent les sbires et monstres tués. Les moyennes utilisent uniquement les games où la donnée est renseignée ; « — » signifie indisponible.</p><p>Ouvre une game ci-dessus pour comparer les deux joueurs, retrouver leur inventaire final et leurs achats. Les écarts d’or et de dégâts sont mesurés en fin de game ; les écarts de CS indiquent leur minute de mesure.</p></details>
  </div>;
}

function ChampionStylePill({ tag }) {
  return <span className="profile-champions-meta">{tagLabel(tag)}</span>;
}

function ChampionVisualMetric({ label, value, detail }) {
  return <div className="profile-champion-metric"><p>{label}</p><strong>{value}</strong>{detail && <p className="profile-champions-meta">{detail}</p>}</div>;
}

function ChampionReferenceLine({ label, value, detail }) {
  return <div className="profile-champion-reference"><span>{label}</span><strong>{value}</strong><span className="profile-champions-meta">{detail}</span></div>;
}

function ChampionLanePanel({ rows = [], navigate, bootstrapRevision }) {
  return <section className="profile-champions profile-champion-games">
    <header className="profile-champions-heading"><div><h4>Games et adversaires</h4><p>Ouvre une ligne pour lire les stats, l’inventaire final et les achats de cette game.</p></div><p className="profile-champions-meta">{rows.length} game{rows.length > 1 ? "s" : ""} · de la plus récente à la plus ancienne</p></header>
    <div className="profile-champion-games-list">{rows.length ? rows.map((row, index) => {
      const enemy = opponentRoleRow(row.match, row.role, rowParticipantId(row));
      const cs10 = csAtMinute(row, 10);
      const cs20 = csAtMinute(row, 20);
      const enemyCs10 = enemy ? csAtMinute({ ...enemy, match: row.match }, 10) : null;
      const diff10 = Number.isFinite(cs10) && Number.isFinite(enemyCs10) ? cs10 - enemyCs10 : null;
      return <ChampionLaneGameLine key={`${row.match?.id || row.match?.game_id || index}-lane`} row={row} enemy={enemy} cs10={cs10} cs20={cs20} diff10={diff10} navigate={navigate} bootstrapRevision={bootstrapRevision} />;
    }) : <p className="profile-champions-empty">Aucune game disponible pour ce champion.</p>}</div>
  </section>;
}

function profileChampionParticipation(row) {
  const value = row?.kill_participation ?? row?.kp ?? row?.raw?.kill_participation ?? row?.raw?.kp;
  return value === undefined || value === null || value === "" ? null : parsePercent(value);
}

function profileChampionCs(row) {
  for (const field of ["cs", "creep_score", "total_cs"]) {
    const value = profileChampionValue(row, field);
    if (value !== null) return value;
  }
  const minions = profileChampionValue(row, "totalMinionsKilled");
  const monsters = profileChampionValue(row, "neutralMinionsKilled");
  return minions === null && monsters === null ? null : (minions || 0) + (monsters || 0);
}

function ParticipantCompareCard({ title, row, match, toneName = "cyan" }) {
  const participant = row ? { ...row, match: row.match || match } : null;
  const items = participant ? finalBuildItems(participant) : [];
  const spells = participant ? summonerSpellIds(participant) : [];
  const timeline = participant ? itemBuildTimeline(participant) : [];
  const champion = participant?.champion || "";
  const stats = [
    ["Kills / morts / assists", participant ? ["kills", "deaths", "assists"].map((field) => profileChampionNumber(profileChampionValue(participant, field))).join(" / ") : "—"],
    ["Sbires et monstres", profileChampionNumber(profileChampionCs(participant))],
    ["Or gagné", profileChampionNumber(profileChampionValue(participant, "gold"))],
    ["Dégâts aux champions", profileChampionNumber(profileChampionValue(participant, "damage"))],
    ["Score de vision", profileChampionNumber(profileChampionValue(participant, "vision"))],
  ];
  return <section className="profile-champion-participant">
    <h5>{title}</h5>
    <div className="profile-champion-participant-heading"><div className="profile-champion-identity">{champion && <ChampionPortrait champion={champion} row={participant} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />}<div><strong>{champion ? championDisplayName(champion) : "Champion inconnu"}</strong><p className="profile-champions-meta">{participant?.summoner_name || participant?.riot_id || "Joueur inconnu"} · {roleLabel(participant?.role)}</p></div></div>{spells.length > 0 && <div className="profile-champion-spells" aria-label="Sorts d’invocateur">{spells.map((spell, index) => <HudIcon key={`${title}-spell-${index}-${spell}`} sources={summonerSpellIconSources(spell)} label={`Sort d’invocateur ${spell}`} fallback={spell} emptyText="?" className="h-9 w-9 rounded-lg" />)}</div>}</div>
    <div className="profile-champion-participant-stats">{stats.map(([label, value]) => <ProfileChampionMini key={label} label={label} value={value} />)}</div>
    <h6>Inventaire final</h6>
    {items.length ? <ul className="profile-champion-inventory">{items.map((item, index) => <li key={`${title}-item-${index}-${item.id}`}><HudIcon sources={itemIconSources(item.id)} label={item.type === "trinket" ? `Relique ${item.id}` : `Objet ${item.id}`} fallback={item.id} emptyText="?" toneName={toneName} className="h-10 w-10 shrink-0" /><span><ItemNameText itemId={item.id} />{item.type === "trinket" && <small>Relique</small>}</span></li>)}</ul> : <p className="profile-champions-meta">Inventaire final non renseigné.</p>}
    {timeline.length > 0 && <details className="profile-champion-purchases"><summary>Chronologie des achats <span>· {timeline.length} événements</span></summary><p className="profile-champions-meta">Temps écoulé depuis le début de la game.</p><ol>{timeline.map((event, index) => <li key={`${title}-buy-${index}-${event.timestamp}-${event.itemId}`}><span className="profile-champion-purchase-time">{event.time}</span><HudIcon sources={itemIconSources(event.itemId)} label={`${event.label} ${itemDisplayName(event.itemId)}`} fallback={event.itemId} emptyText="?" toneName={event.toneName} className="h-8 w-8 shrink-0" /><span><strong>{event.label}</strong><span><ItemNameText itemId={event.itemId} secondaryId={event.secondaryId} /></span></span></li>)}</ol></details>}
  </section>;
}

function VersusDeltaStack({ rows }) {
  return <div className="profile-champion-deltas">{rows.map(([label, value, toneName]) => <ProfileChampionMini key={label} label={label} value={value} toneName={toneName} />)}</div>;
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
  const enemy = completeRow(summaryEnemy) || opponentRoleRow(match, row.role, rowParticipantId(row));
  const enemyRow = enemy ? { ...enemy, match } : null;
  const currentCs10 = detail ? csAtMinute(row, 10) : cs10;
  const currentCs20 = detail ? csAtMinute(row, 20) : cs20;
  const enemyCs10 = enemyRow ? csAtMinute(enemyRow, 10) : null;
  const enemyCs20 = enemyRow ? csAtMinute(enemyRow, 20) : null;
  const currentDiff10 = Number.isFinite(currentCs10) && Number.isFinite(enemyCs10) ? currentCs10 - enemyCs10 : (detail ? null : diff10);
  const currentDiff20 = Number.isFinite(currentCs20) && Number.isFinite(enemyCs20) ? currentCs20 - enemyCs20 : null;
  const difference = (field) => {
    const own = profileChampionValue(row, field);
    const opposing = profileChampionValue(enemyRow, field);
    return own === null || opposing === null ? null : own - opposing;
  };
  const signed = (value, unit = "") => value === null || value === undefined ? "—" : `${value > 0 ? "+" : ""}${profileChampionNumber(value)}${unit}`;
  const allyRows = teamRows(match, "ALLY");
  const enemyRows = teamRows(match, "ENEMY");
  const teamTotal = (members, field) => members.length === 5 && members.every((member) => profileChampionValue(member, field) !== null) ? members.reduce((sum, member) => sum + profileChampionValue(member, field), 0) : null;
  const teamDiff = (field) => {
    const own = teamTotal(allyRows, field);
    const opposing = teamTotal(enemyRows, field);
    return own === null || opposing === null ? null : own - opposing;
  };
  const ownShare = (field) => {
    const total = teamTotal(allyRows, field);
    const value = profileChampionValue(row, field);
    return total > 0 && value !== null ? `${profileChampionNumber(value / total * 100)} %` : "—";
  };
  const laneStats = [
    ["Or en fin de game", difference("gold"), " or"],
    ["Dégâts en fin de game", difference("damage"), " dégâts"],
    ["CS à 10 minutes", currentDiff10, " CS"],
    ["CS à 20 minutes", currentDiff20, " CS"],
  ].map(([label, value, unit]) => [label, signed(value, unit), value === null ? "slate" : value > 0 ? "green" : value < 0 ? "red" : "cyan"]);
  const participation = profileChampionParticipation(row);
  return <details className="profile-champion-game" open={expanded} onToggle={(event) => setExpanded(event.currentTarget.open)}>
    <summary><span className="profile-champion-identity">{enemy?.champion && <ChampionPortrait champion={enemy.champion} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />}<span><strong>{enemy?.champion ? `Face à ${championDisplayName(enemy.champion)}` : "Adversaire non identifié"}</strong><span className="profile-champions-meta">{matchDisplayName(match, "Game")} · {profileHistoryDateLabel(row) || "Date inconnue"}</span></span></span><span className={cx("profile-champion-result", match?.result === "Victoire" ? "profile-champion-tone-green" : match?.result === "Défaite" ? "profile-champion-tone-red" : "")}>{match?.result || "Résultat inconnu"}</span><span className="profile-champion-game-toggle">{expanded ? "Refermer" : "Stats et équipements"}<ChevronDown aria-hidden="true" className="h-4 w-4" /></span></summary>
    {expanded && <div className="profile-champion-game-content">
      <div className="profile-champion-game-context"><div><h5>{matchDisplayName(match, "Game")}</h5><p className="profile-champions-meta">{[match?.duration ? `Durée ${match.duration}` : "Durée inconnue", match?.side ? `Côté ${{ Blue: "bleu", Red: "rouge", BLUE: "bleu", RED: "rouge" }[match.side] || match.side}` : "", match?.patch ? `Patch ${match.patch}` : ""].filter(Boolean).join(" · ")}</p><p className="profile-champions-meta">{match?.game_id || "Identifiant de game non renseigné"}</p></div>{targetMatchId && <Button type="button" variant="ghost" icon={ArrowRight} onClick={() => navigate?.(`/games?match=${encodeURIComponent(targetMatchId)}`)}>Ouvrir la game</Button>}</div>
      {loading && <p role="status" className="profile-champions-note">Chargement des statistiques et des achats…</p>}
      {error && <div role="alert" className="profile-champions-error"><p>{error}</p><Button type="button" onClick={retry}>Réessayer</Button></div>}
      <section className="profile-champion-comparison"><h5>Écarts avec l’adversaire de même rôle</h5><p className="profile-champions-meta">Valeur du joueur moins valeur de l’adversaire. « — » : comparaison indisponible.</p><VersusDeltaStack rows={laneStats} /></section>
      <div className="profile-champion-participants"><ParticipantCompareCard title="Joueur du profil" row={row} match={match} toneName="cyan" /><ParticipantCompareCard title="Adversaire de même rôle" row={enemyRow} match={match} toneName="red" /></div>
      {!loading && !error && !itemBuildTimeline(row).length && !itemBuildTimeline(enemyRow).length && <p className="profile-champions-note">Chronologie des achats non disponible pour cette game. Les inventaires finaux sont affichés lorsqu’ils sont renseignés.</p>}
      <details className="profile-champion-team-context"><summary>Contexte d’équipe et sbires à 10 / 20 minutes</summary><div className="profile-champion-deltas"><ChampionMiniStat label="Participation aux kills" value={participation === null ? "—" : `${profileChampionNumber(participation)} %`} /><ChampionMiniStat label="Part d’or de l’équipe" value={ownShare("gold")} /><ChampionMiniStat label="Part de dégâts de l’équipe" value={ownShare("damage")} /><ChampionMiniStat label="Écart d’or entre équipes" value={signed(teamDiff("gold"), " or")} /><ChampionMiniStat label="Écart de dégâts entre équipes" value={signed(teamDiff("damage"), " dégâts")} /><ChampionMiniStat label="Dégâts aux tours" value={profileChampionNumber(profileChampionValue(row, "damage_to_turrets"))} /><ChampionMiniStat label="Sbires à 10 minutes" value={currentCs10 === null || currentCs10 === undefined ? "—" : `${profileChampionNumber(currentCs10)} CS`} /><ChampionMiniStat label="Sbires à 20 minutes" value={currentCs20 === null || currentCs20 === undefined ? "—" : `${profileChampionNumber(currentCs20)} CS`} /></div><p className="profile-champions-meta">Les comparaisons d’équipe nécessitent les statistiques des cinq joueurs de chaque côté.</p></details>
    </div>}
  </details>;
}

function ChampionMiniStat({ label, value, toneName = "cyan" }) {
  return <ProfileChampionMini label={label} value={value} toneName={toneName} />;
}

function profileHistorySortKey(row) {
  const match = row?.match || {};
  for (const raw of [match.game_date, match.date, match.raw?.info?.gameCreation, match.created_at]) {
    if (!raw) continue;
    const numeric = Number(raw);
    if (Number.isFinite(numeric) && numeric > 1000000000) return numeric < 100000000000 ? numeric * 1000 : numeric;
    const parsed = Date.parse(String(raw));
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function profileHistoryDateLabel(row) {
  const time = profileHistorySortKey(row);
  return time ? new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" }).format(new Date(time)) : "";
}

function ProfileHistoryView({ rows = [], selectedCategoryId, navigate }) {
  const [championFilter, setChampionFilter] = useState("");
  const [resultFilter, setResultFilter] = useState("all");
  const [page, setPage] = useState(1);
  const orderedRows = rows.slice().sort((a, b) => profileHistorySortKey(b) - profileHistorySortKey(a));
  const championOptions = Array.from(new Set(orderedRows.map((row) => row.champion).filter(Boolean))).sort((a, b) => championDisplayName(a).localeCompare(championDisplayName(b)));
  const filteredRows = orderedRows.filter((row) => (!championFilter || row.champion === championFilter) && (resultFilter === "all" || row.match?.result === (resultFilter === "win" ? "Victoire" : "Défaite")));
  const pages = Math.max(1, Math.ceil(filteredRows.length / 10));
  const currentPage = Math.min(page, pages);
  const visibleRows = filteredRows.slice((currentPage - 1) * 10, currentPage * 10);
  return <Surface>
    <div className="profile-section-heading"><div><h3>Historique des games</h3><p>Les plus récentes en premier. Ouvre une game pour revoir le détail et la chronologie.</p></div></div>
    <div className="profile-history-filters profile-filters"><SelectInput label="Champion" value={championFilter} onChange={(value) => { setChampionFilter(value); setPage(1); }}><option value="">Tous les champions</option>{championOptions.map((champion) => <option key={champion} value={champion}>{championDisplayName(champion)}</option>)}</SelectInput><SelectInput label="Résultat" value={resultFilter} onChange={(value) => { setResultFilter(value); setPage(1); }}><option value="all">Tous les résultats</option><option value="win">Victoires</option><option value="loss">Défaites</option></SelectInput></div>
    <div className="profile-scope"><p role="status"><strong>{filteredRows.length} games trouvées</strong> sur {rows.length}</p>{(championFilter || resultFilter !== "all") && <button type="button" className="profile-text-action" onClick={() => { setChampionFilter(""); setResultFilter("all"); setPage(1); }}>Réinitialiser les filtres</button>}</div>
    <div className="profile-history-list">{visibleRows.length ? visibleRows.map((row, index) => {
      const cs10 = csAtMinute(row, 10);
      const cs20 = csAtMinute(row, 20);
      const enemy = opponentRoleRow(row.match, row.role, row.raw?.participantId || row.participantId);
      const knownResult = ["Victoire", "Défaite"].includes(row.match?.result);
      const kp = row.kill_participation ?? row.kp;
      return <article key={`${row.match?.id || index}-${row.champion}`} className="profile-history-row">
        <div className="profile-history-main"><div className="profile-history-identity"><ChampionPortrait row={row} champion={row.champion} alt="" className="h-12 w-12 rounded-lg object-cover" /><div><h4>{championDisplayName(row.champion)}{enemy?.champion && <span> contre {championDisplayName(enemy.champion)}</span>}</h4><p>{matchDisplayName(row.match)}</p><small>{profileHistoryDateLabel(row) || "Date inconnue"} · {row.match?.duration || "Durée inconnue"}</small></div></div><div className="profile-history-result"><span className={knownResult ? row.match.result === "Victoire" ? "profile-win" : "profile-loss" : ""}>{knownResult ? row.match.result : "Résultat inconnu"}</span><strong>{row.kills ?? "—"} / {row.deaths ?? "—"} / {row.assists ?? "—"}</strong><small>Kills / morts / assists</small></div><Button type="button" variant="ghost" disabled={!row.match?.id} onClick={() => (navigate || openAppPath)(`/games?match=${encodeURIComponent(row.match.id)}`)} aria-label={`Ouvrir ${matchDisplayName(row.match)}`}>Ouvrir la game <ArrowRight aria-hidden="true" className="h-4 w-4" /></Button></div>
        <details className="profile-history-details"><summary>Statistiques de la game</summary><dl>{[["Dégâts", row.damage == null ? "—" : formatPoints(row.damage)], ["Or", row.gold == null ? "—" : formatPoints(row.gold)], ["Vision", row.vision ?? "—"], ["Participation aux kills", kp == null || kp === "" ? "—" : `${Math.round(parsePercent(kp))} %`], ["Farm à 10 min", cs10 === null ? "—" : `${cs10} CS`], ["Farm à 20 min", cs20 === null ? "—" : `${cs20} CS`], ["Farm final", row.cs == null ? "—" : `${row.cs} CS`], ["Côté", row.match?.side || "—"], ["Patch", row.match?.patch || "—"]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></details>
      </article>;
    }) : <EmptyState icon={FileText} title="Aucune game" text={rows.length ? "Aucune game ne correspond aux filtres. Essaie un autre champion ou résultat." : selectedCategoryId ? "Aucune game de ce contexte n’est reliée au joueur." : "Aucune game importée n’est reliée au joueur."} />}</div>
    {pages > 1 && <nav className="profile-pagination" aria-label="Pages de l’historique"><Button type="button" variant="ghost" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Précédente</Button><span>Page {currentPage} sur {pages}</span><Button type="button" variant="ghost" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>Suivante</Button></nav>}
  </Surface>;
}

function ProfileFold({ title, badge, icon: Icon = Activity, toneName = "cyan", children }) {
  const [open, setOpen] = useState(true);
  return <Surface className="min-w-0 p-4">
    <h3><button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg py-2 text-left transition hover:bg-white/[0.035]">
      <span className="flex min-w-0 items-center gap-3">
        <Icon className={cx("h-5 w-5 shrink-0", toneName === "red" ? "text-rose-100" : toneName === "green" ? "text-emerald-100" : toneName === "purple" ? "text-violet-100" : "text-cyan-100")} aria-hidden="true" />
        <span className="min-w-0"><span className="text-xs font-semibold text-slate-300">{badge}</span><span className="mt-1 block break-words text-xl font-black text-white">{title}</span></span>
      </span>
      <ChevronDown className={cx("h-5 w-5 shrink-0 text-cyan-100 transition", !open && "-rotate-90")} aria-hidden="true" />
    </button></h3>
    {open && <div className="mt-3 min-w-0 border-t border-white/10 pt-4">{children}</div>}
  </Surface>;
}

function ProfileHudMetric({ icon: Icon, label, value, detail, tone: t = "cyan" }) {
  return <div className="min-w-0 border-l border-white/10 px-3 py-1 tabular-nums">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-[0.62rem] font-black uppercase tracking-[0.16em] text-slate-300">{label}</p>
        <p className="mt-2 truncate text-2xl font-black text-white">{value}</p>
      </div>
      {Icon && <Icon className={cx("h-4 w-4 shrink-0", t === "green" ? "text-emerald-100" : t === "red" ? "text-rose-100" : t === "purple" ? "text-violet-100" : t === "orange" ? "text-fuchsia-100" : "text-cyan-100")} aria-hidden="true" />}
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
