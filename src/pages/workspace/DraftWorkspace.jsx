import { Crown, Sparkles, Download, Search, Users, Trash2, BookOpen, Check, ChevronDown, Loader2, Plus, X, Clipboard, RefreshCw } from "lucide-react";
import { DRAFT_VIEW_ROUTES } from "../../app/constants.jsx";
import { draftPathFromView, draftViewFromPath } from "../../app/routing.js";
import { TabNav, Badge, Button, EmptyState, PageHeader, Surface, TextInput } from "../../components/ui/Core.jsx";
import React, { useEffect, useState } from "react";
import { apiFetch } from "../../api/client.js";
import { RoleIcon } from "../../components/brand/BrandAssets.jsx";
import { cx } from "../../app/helpers.js";
import { compositionSlots, emptyCompositionSlots, jsonList } from "../../utils/planning.js";
import { championKey, championAssetId, championDisplayName, championPoolRowsByTier, exportChampionTierListPng, canStaffManage, isGameplayRole, championPoolStatus, CHAMPION_TIERS, championTierColumnFrame, championTierColumnGlow, ChampionTierMark, championMatchesLane, ALL_CHAMPION_STYLE_TAGS, championPoolStatusLabel, ChampionPortrait, compositionIdentity, championStyleTone, tagLabel, COMP_ROLES, ChampionBackdrop, championPoolStatusTone, championStyleTags } from "./workspace-shared.jsx";
import { roleLabel } from "./shell-shared.jsx";

function championOptions() {
  return [...new Set(Object.keys(ALL_CHAMPION_STYLE_TAGS).map(championAssetId))].sort((a, b) => championDisplayName(a).localeCompare(championDisplayName(b)));
}

const CHAMPION_TAG_DEFINITIONS = [
  ["engage", "Ouvre les combats avec une initiation claire."],
  ["dive", "Entre rapidement sur les carries ou la backline adverse."],
  ["front-to-back", "Joue les fights dans l'ordre, frontline devant et carries protégés."],
  ["teamfight", "Fort quand les cinq joueurs combattent ensemble."],
  ["pick", "Cherche à isoler une cible avant un objectif ou une rotation."],
  ["poke", "Gratte les PV avant d'engager ou de contester une zone."],
  ["siege", "Met la pression sur les tours et les objectifs fixes."],
  ["side", "Crée de la pression sur une side lane."],
  ["duel", "Fort en 1v1 ou dans les escarmouches isolées."],
  ["scaling", "Devient plus puissant avec le temps, les niveaux ou les items."],
  ["early", "Très fort en début de partie pour prendre le tempo."],
  ["tempo", "Aide à accélérer la carte, les rotations ou les timings d'objectif."],
  ["snowball", "Prend beaucoup de valeur quand il obtient une avance tôt."],
  ["assassin", "Menace explosive sur les cibles fragiles."],
  ["burst", "Inflige beaucoup de dégâts sur une fenêtre courte."],
  ["control", "Contrôle les zones avec des sorts, de la portée ou du zoning."],
  ["frontline", "Peut tenir l'espace devant l'équipe."],
  ["peel", "Protège un carry contre les engages ou les dives."],
  ["utility", "Apporte de la vision, du contrôle, du buff ou de la valeur d'équipe."],
  ["objective", "Très utile pour sécuriser dragons, Nashor, Herald ou tours."],
  ["roam", "Peut quitter sa lane pour influencer les autres zones."],
  ["skirmish", "Fort dans les combats courts à 2v2 ou 3v3."],
  ["reset", "Peut enchaîner après un kill ou une exécution réussie."],
  ["disengage", "Permet de casser l'engage adverse et de reculer proprement."],
  ["lockdown", "Peut immobiliser une cible de manière fiable."],
  ["sustain", "Apporte du soin, de la régénération ou de la tenue en fight."],
  ["safe", "Peut jouer avec peu de ressources ou limiter les risques."],
  ["lane", "Fort dans la phase de lane ou pour créer une priorité locale."],
  ["farm", "A besoin de ressources et de tempo PvE pour atteindre son pic."],
  ["cover", "Protège une action alliée ou accompagne une prise de risque."],
  ["gank", "Facilite les actions sur les lanes."],
  ["disrupt", "Dérange le plan adverse et casse les formations."],
  ["anti-dive", "Répond bien aux compositions qui veulent rentrer dans l'équipe."],
  ["self-peel", "Dispose d'outils personnels pour survivre à une menace."],
  ["attach", "Se lie à un allié et amplifie son impact."],
  ["flank", "Menace forte quand il arrive sur le côté ou dans le dos."],
  ["simple", "Plan de jeu direct, facile à exécuter."],
  ["playmaker", "Peut créer une action décisive par mécanique ou timing."],
  ["standard", "Profil équilibré sans identité dominante détectée."],
];

const COUNTER_TAG_RULES = {
  engage: [["disengage", 20, "Disengage"], ["peel", 14, "Peel carry"], ["control", 10, "Contrôle zone"], ["poke", 8, "Punition avant go"]],
  dive: [["peel", 22, "Anti-dive"], ["disengage", 18, "Stop entrée"], ["lockdown", 12, "Lockdown cible"], ["frontline", 8, "Frontline solide"]],
  poke: [["engage", 18, "Engage rapide"], ["sustain", 16, "Sustain poke"], ["dive", 10, "Dive backline"], ["safe", 8, "Tenue longue distance"]],
  siege: [["engage", 16, "Force sous pression"], ["waveclear", 14, "Waveclear"], ["dive", 10, "Casse siège"], ["flank", 8, "Angle de flank"]],
  scaling: [["early", 18, "Punition early"], ["snowball", 14, "Snowball"], ["pick", 10, "Catch avant spikes"], ["objective", 8, "Objectifs rapides"]],
  "front-to-back": [["dive", 16, "Menace carry"], ["flank", 14, "Angle latéral"], ["assassin", 12, "Pression backline"], ["poke", 8, "Désorganise frontline"]],
  side: [["engage", 14, "Force mid"], ["duel", 12, "Réponse side"], ["pick", 10, "Punition rotation"], ["waveclear", 8, "Stabilise mid"]],
  pick: [["frontline", 12, "Absorbe pick"], ["disengage", 12, "Annule ouverture"], ["safe", 10, "Réduit catches"], ["vision", 8, "Contrôle vision"]],
  assassin: [["peel", 18, "Protège cible"], ["lockdown", 14, "Contrôle assassin"], ["frontline", 10, "Réduit accès"], ["exhaust", 8, "Réponse burst"]],
  early: [["safe", 12, "Stabilise early"], ["scaling", 8, "Survit puis dépasse"], ["waveclear", 8, "Limite tempo"], ["vision", 8, "Sécurise lanes"]],
  teamfight: [["split", 14, "Étire map"], ["poke", 12, "Affaiblit fight"], ["disengage", 10, "Refuse 5v5"], ["flank", 8, "Casse formation"]],
  control: [["dive", 14, "Traverse zone"], ["poke", 10, "Conteste distance"], ["flank", 10, "Hors angle"], ["tempo", 8, "Setup avant zone"]],
  frontline: [["poke", 12, "Use frontline"], ["scaling", 10, "Outscale tanks"], ["duel", 8, "Pression side"], ["dps", 8, "DPS continu"]],
  peel: [["poke", 12, "Force backline"], ["side", 10, "Évite front-to-back"], ["engage", 8, "Multi angles"], ["objective", 8, "Force déplacement"]],
  utility: [["pick", 12, "Punition rotations"], ["burst", 10, "Supprime value"], ["assassin", 8, "Menace enchanteur"], ["dive", 8, "Accès backline"]],
  objective: [["tempo", 14, "Setup avant"], ["pick", 12, "Isoler setup"], ["control", 8, "Bloque rivière"], ["poke", 8, "Conteste objectif"]],
  tempo: [["waveclear", 10, "Ralentit tempo"], ["scaling", 8, "Absorbe puis dépasse"], ["safe", 8, "Limite ouvertures"], ["control", 8, "Casse rotations"]],
  burst: [["frontline", 12, "Absorbe burst"], ["sustain", 10, "Récupère trade"], ["peel", 8, "Protège cible"], ["safe", 8, "Évite fenêtre"]],
  snowball: [["safe", 12, "Coupe accélération"], ["control", 10, "Stabilise zones"], ["scaling", 8, "Joue temps"], ["waveclear", 8, "Freine push"]],
  sustain: [["burst", 12, "Tue avant sustain"], ["pick", 10, "Cible isolée"], ["objective", 8, "Convertit fenêtres"], ["poke", 6, "Force ressources"]],
  roam: [["vision", 12, "Track roam"], ["waveclear", 10, "Punition wave"], ["tempo", 8, "Match rotations"]],
  skirmish: [["frontline", 10, "Stabilise skirmish"], ["control", 10, "Zone fight court"], ["scaling", 8, "Refuse trade tôt"]],
  reset: [["lockdown", 12, "Stop reset"], ["peel", 10, "Protège exécution"], ["burst", 8, "Tue avant reset"]],
  disengage: [["poke", 10, "Force reculs"], ["siege", 8, "Pression structures"], ["side", 8, "Déplace fight"]],
  lockdown: [["poke", 8, "Joue hors portée"], ["frontline", 8, "Absorbe CC"], ["utility", 6, "Nettoie fenêtre"]],
  lane: [["safe", 10, "Stabilise lane"], ["roam", 8, "Évite duel lane"], ["waveclear", 8, "Casse prio"]],
  farm: [["early", 10, "Punition PvE"], ["invade", 8, "Pression jungle"], ["tempo", 8, "Accélère carte"]],
};

const DIRECT_COUNTERS = {
  Aatrox: ["Fiora", "Irelia", "Malphite", "Poppy"],
  Ahri: ["Galio", "Lissandra", "Naafiri", "Vex"],
  Akali: ["Galio", "Lissandra", "Malzahar", "Vex"],
  Aphelios: ["Caitlyn", "Draven", "Nautilus", "Varus"],
  Ashe: ["Blitzcrank", "Draven", "Nautilus", "Samira"],
  Caitlyn: ["Jhin", "Sivir", "Varus", "Ziggs"],
  Darius: ["Gnar", "Jayce", "Quinn", "Vayne"],
  Draven: ["Ashe", "Caitlyn", "Nautilus", "Varus"],
  Ezreal: ["Caitlyn", "Draven", "Kalista", "Varus"],
  Fiora: ["Malphite", "Poppy", "Quinn", "Renekton"],
  Galio: ["Azir", "Cassiopeia", "Tristana", "Vladimir"],
  Gwen: ["Fiora", "Jax", "Renekton", "Tryndamere"],
  Hwei: ["Fizz", "Naafiri", "Talon", "Zed"],
  Jax: ["Gragas", "Kennen", "Malphite", "Poppy"],
  Jinx: ["Draven", "Nautilus", "Twitch", "Varus"],
  Kaisa: ["Caitlyn", "Draven", "Varus", "Xayah"],
  Kalista: ["Ashe", "Caitlyn", "Varus", "Vayne"],
  Karma: ["Blitzcrank", "Nautilus", "Pyke", "Rakan"],
  Leblanc: ["Galio", "Lissandra", "Malzahar", "Vex"],
  LeeSin: ["Ivern", "Poppy", "Rammus", "Sejuani"],
  Lissandra: ["Anivia", "Cassiopeia", "Orianna", "Viktor"],
  Locke: ["Galio", "Lissandra", "Malzahar", "Vex"],
  Lucian: ["Caitlyn", "Draven", "Varus", "Vayne"],
  Lux: ["Blitzcrank", "Nautilus", "Pyke", "Zyra"],
  Malphite: ["Gwen", "Mordekaiser", "Sylas", "Vladimir"],
  Milio: ["Blitzcrank", "Nautilus", "Pyke", "Rakan"],
  Nautilus: ["Janna", "Morgana", "Rakan", "Taric"],
  Nocturne: ["Ivern", "Lulu", "Poppy", "Rammus"],
  Orianna: ["Fizz", "Syndra", "Talon", "Zed"],
  Rakan: ["Janna", "Morgana", "Poppy", "Thresh"],
  Renekton: ["Gnar", "Kennen", "Quinn", "Vayne"],
  Sejuani: ["Ivern", "Lillia", "Olaf", "Trundle"],
  Seraphine: ["Blitzcrank", "Nautilus", "Pyke", "Zyra"],
  Tristana: ["Caitlyn", "Draven", "Syndra", "Varus"],
  Varus: ["Draven", "Nautilus", "Samira", "Sivir"],
  Viego: ["Ivern", "Poppy", "Rammus", "Sejuani"],
  Xayah: ["Caitlyn", "Jinx", "Seraphine", "Sivir"],
  Yunara: ["Caitlyn", "Draven", "Nautilus", "Varus"],
  Zeri: ["Caitlyn", "Draven", "Nautilus", "Varus"],
};

const COMPOSITION_TAG_DEFINITIONS = [
  ["blue side", "Tag de lecture pour les compos pensées côté bleu."],
  ["red side", "Tag de lecture pour les compos pensées côté rouge."],
  ["scrim", "Tag libre pour retrouver rapidement les compos travaillées en entraînement."],
  ["BO", "Tag libre pour les compos préparées dans une logique de série."],
];

function championTierByStatus(status) {
  return CHAMPION_TIERS.find((tier) => tier.id === status) || CHAMPION_TIERS.find((tier) => tier.id === "work") || CHAMPION_TIERS[0];
}

function ChampionMasteryPortrait({ row, champion, alt, className = "h-12 w-12 rounded-xl" }) {
  return <span className={cx("relative inline-flex shrink-0 overflow-visible", className)}>
    <ChampionPortrait row={row} champion={champion || row?.champion} alt={alt || champion || row?.champion} className="h-full w-full rounded-[inherit] object-cover" />
  </span>;
}

function ChampionTierCard({ row, canManage, saving, onDragStart, onDelete }) {
  const detail = championPoolStatusLabel(championPoolStatus(row));
  return <div draggable={canManage} onDragStart={(event) => onDragStart(event, row)} className={cx("group flex min-h-[52px] min-w-0 items-center gap-2 rounded-xl border border-white/10 bg-black/25 p-2 transition", canManage ?"cursor-grab active:cursor-grabbing hover:border-cyan-300/25 hover:bg-white/[0.05]" : "")}><ChampionMasteryPortrait row={row} alt={row.champion} className="h-10 w-10 rounded-xl" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-black text-white">{championDisplayName(row.champion)}</p><p className="truncate text-[0.68rem] font-semibold text-slate-300">{detail}</p></div>{canManage && <button type="button" onClick={() => onDelete(row)} disabled={saving} className="shrink-0 rounded-lg p-1.5 text-slate-300 transition hover:bg-rose-500/10 hover:text-rose-200"><Trash2 className="h-3.5 w-3.5" /></button>}</div>;
}

function ChampionSearchTile({ champion, active, existingRow, canManage, onDragStart, onQuickPick }) {
  const source = existingRow && ["manual", "riot_manual"].includes(String(existingRow.source || "")) ? existingRow : { champion };
  return <div draggable={canManage} onDragStart={(event) => onDragStart(event, source)} className={cx("group relative min-w-[150px] rounded-2xl border p-2 text-left transition", canManage && "cursor-grab active:cursor-grabbing", active ? "border-cyan-300/28 bg-cyan-400/10 shadow-[0_0_18px_rgba(34,211,238,.08)]" : "border-white/10 bg-white/[0.035] hover:border-cyan-300/25 hover:bg-cyan-400/10")}>
    <div className="flex min-w-0 items-center gap-2">
      <ChampionPortrait champion={champion} alt={champion} className="h-11 w-11 shrink-0 rounded-xl object-cover" />
      <span className="min-w-0 flex-1 truncate text-xs font-black text-white">{championDisplayName(champion)}</span>
      {active && <span className="shrink-0 rounded-full border border-cyan-200/18 bg-cyan-400/10 px-2 py-1 text-[0.55rem] font-black uppercase tracking-[0.12em] text-cyan-100">Pool</span>}
    </div>
    {canManage && <div className="mt-2 grid grid-cols-4 justify-items-center gap-1.5 opacity-80 transition group-hover:opacity-100">
      {CHAMPION_TIERS.map((tier) => {
        const selected = active && championPoolStatus(existingRow) === tier.id;
        return <button key={tier.id} type="button" onClick={(event) => { event.stopPropagation(); onQuickPick(champion, tier.id, source.id || null); }} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl p-0.5 transition hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-cyan-200/35" title={`Mettre en ${tier.title}`} aria-label={`Mettre ${championDisplayName(champion)} en ${tier.title}`}><ChampionTierMark tier={tier} active={selected} className="h-8 w-8" /></button>;
      })}
    </div>}
  </div>;
}

function Champions({ data, selectedTeamId, refreshAll, pushToast, currentMember, user }) {
  const activeTeamId = selectedTeamId || data.teams[0]?.id || null;
  const canManageTeamPool = canStaffManage(currentMember?.role);
  const players = (data.players || []).filter((player) => String(player.team_id || "") === String(activeTeamId || "") && isGameplayRole(player.role));
  const linkedPlayer = players.find((player) => String(player.user_id || "") === String(user?.id || ""));
  const laneOptions = ["ALL", "TOP", "JGL", "MID", "ADC", "SUP"];
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [query, setQuery] = useState("");
  const [laneFilter, setLaneFilter] = useState("ALL");
  const [saving, setSaving] = useState(false);
  const [localPool, setLocalPool] = useState(data.championPool || []);
  const selectedPlayer = players.find((player) => player.id === selectedPlayerId) || players[0];
  const canManageSelectedPool = canManageTeamPool || String(selectedPlayer?.user_id || "") === String(user?.id || "");
  const selectedPlayerRows = (localPool || [])
    .filter((row) => String(row.team_id || "") === String(activeTeamId || "") && selectedPlayer && (String(row.player_id || "") === String(selectedPlayer.id || "") || row.player_name === selectedPlayer.name))
    .filter((row) => ["manual", "riot_manual"].includes(String(row.source || "")))
    .map((row) => ({ ...row, role: row.role || selectedPlayer?.role || "UNK", status: championPoolStatus(row) }));
  const selectedRows = selectedPlayerRows
    .sort((a, b) => championDisplayName(a.champion).localeCompare(championDisplayName(b.champion)));
  const selectedChampionByKey = new Map();
  selectedPlayerRows.forEach((row) => {
    const key = championAssetId(row.champion) || championKey(row.champion);
    if (!key || selectedChampionByKey.has(key)) return;
    selectedChampionByKey.set(key, row);
  });
  selectedRows.forEach((row) => {
    const key = championAssetId(row.champion) || championKey(row.champion);
    if (key) selectedChampionByKey.set(key, row);
  });
  const pickedChampionKeys = new Set(selectedRows.map((row) => championAssetId(row.champion) || championKey(row.champion)));
  const visibleChampions = championOptions()
    .filter((champion) => championDisplayName(champion).toLowerCase().includes(query.toLowerCase()))
    .filter((champion) => championMatchesLane(champion, laneFilter));

  useEffect(() => {
    const fallbackPlayerId = !canManageTeamPool && linkedPlayer?.id ? linkedPlayer.id : players[0]?.id || "";
    if (!selectedPlayerId && fallbackPlayerId) setSelectedPlayerId(fallbackPlayerId);
    if (selectedPlayerId && !players.some((player) => player.id === selectedPlayerId)) setSelectedPlayerId(fallbackPlayerId);
  }, [activeTeamId, canManageTeamPool, linkedPlayer?.id, players.map((player) => player.id).join("|")]);

  useEffect(() => {
    if (selectedPlayer?.role && laneOptions.includes(selectedPlayer.role)) setLaneFilter(selectedPlayer.role);
  }, [selectedPlayer?.id]);

  useEffect(() => {
    setLocalPool(data.championPool || []);
  }, [data.championPool]);

  function rowsForTier(status) {
    return selectedRows.filter((row) => row.status === status);
  }

  function exportSelectedTierList() {
    exportChampionTierListPng({ player: selectedPlayer, rowsByTier: championPoolRowsByTier(selectedRows), pushToast });
  }

  function dragPayload(event) {
    try {
      return JSON.parse(event.dataTransfer.getData("application/json") || "{}");
    } catch {
      return {};
    }
  }

  function onDragStart(event, row) {
    if (!canManageSelectedPool) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.setData("application/json", JSON.stringify({ champion: row.champion, poolId: row.id || null }));
    event.dataTransfer.effectAllowed = "move";
  }

  async function saveChampion(champion, status, poolId = null) {
    if (!canManageSelectedPool || !selectedPlayer || !champion) return;
    const championName = championAssetId(champion) || championDisplayName(champion);
    const championId = championAssetId(champion);
    const existing = (localPool || []).find((row) => String(row.team_id || "") === String(activeTeamId || "") && ["manual", "riot_manual"].includes(String(row.source || "")) && (poolId ? String(row.id || "") === String(poolId) : (String(row.player_id || "") === String(selectedPlayer.id || "") || row.player_name === selectedPlayer.name) && championAssetId(row.champion) === championId));
    const keepStats = Boolean(existing);
    const optimistic = {
      ...(existing || {}),
      id: existing?.id || `optimistic-${selectedPlayer.id}-${championId}`,
      team_id: activeTeamId,
      player_id: selectedPlayer.id,
      player_name: selectedPlayer.name,
      role: selectedPlayer.role,
      champion: championName,
      status,
      source: existing?.source || "manual",
      games: keepStats ? existing?.games || 0 : 0,
      wins: keepStats ? existing?.wins || 0 : 0,
      losses: keepStats ? existing?.losses || 0 : 0,
      winrate: keepStats ? existing?.winrate || 0 : 0,
      kda: keepStats ? existing?.kda || 0 : 0,
      cs_per_min: keepStats ? existing?.cs_per_min || 0 : 0,
      impact_grade: existing?.impact_grade || "POOL",
    };
    setLocalPool((current) => existing
      ? current.map((row) => row.id === existing.id ? optimistic : row)
      : [...current, optimistic]);
    setSaving(true);
    try {
      const result = await apiFetch("champion-pool-manual", { method: "POST", body: JSON.stringify({ teamId: activeTeamId, playerId: selectedPlayer.id, champion: championName, status, poolId: existing && ["manual", "riot_manual"].includes(String(existing.source || "")) ? existing.id : null, notes: "" }) });
      if (result?.pick) setLocalPool((current) => current.map((row) => row.id === optimistic.id ? result.pick : row));
    } catch (err) {
      setLocalPool((current) => existing
        ? current.map((row) => row.id === existing.id ? existing : row)
        : current.filter((row) => row.id !== optimistic.id));
      pushToast({ type: "red", title: "Modification impossible", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function deletePick(row, options = {}) {
    if (!canManageSelectedPool || !row?.id) return;
    if (options.confirm !== false && !window.confirm("Retirer ce champion du Champion Pool ?")) return;
    if (String(row.id).startsWith("optimistic-")) {
      setLocalPool((current) => current.filter((item) => item.id !== row.id));
      return;
    }
    const previousPool = localPool;
    setLocalPool((current) => current.filter((item) => item.id !== row.id));
    setSaving(true);
    try {
      await apiFetch("champion-pool-manual", { method: "POST", body: JSON.stringify({ action: "delete", teamId: activeTeamId, poolId: row.id }) });
    } catch (err) {
      setLocalPool(previousPool);
      pushToast({ type: "red", title: "Suppression impossible", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  function dropOnTier(event, status) {
    event.preventDefault();
    const payload = dragPayload(event);
    if (payload.champion) saveChampion(payload.champion, status, payload.poolId);
  }

  function dropOnChampionBase(event) {
    event.preventDefault();
    const payload = dragPayload(event);
    if (!payload.poolId) return;
    const row = selectedRows.find((item) => String(item.id || "") === String(payload.poolId));
    if (row) deletePick(row, { confirm: false });
  }

  return (
    <div>
      <PageHeader eyebrow="Draft" title="Champion Pool par joueur" />
      {players.length ? (
        <>
          <Surface glow className="mb-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <h3 className="text-xl font-black text-white">Joueur actif</h3>
                <p className="mt-1 text-sm font-semibold text-slate-300">Le choix du joueur reste en haut pour laisser toute la largeur aux tableaux.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <ChampionPoolColorSummary />
                <Button type="button" variant="ghost" icon={Download} onClick={exportSelectedTierList} disabled={!selectedPlayer || !selectedRows.length}>Exporter PNG</Button>
              </div>
            </div>
            <div className="mt-5 flex gap-3 overflow-x-auto pb-2">
              {players.map((player) => {
                const selected = selectedPlayer?.id === player.id;
                return (
                  <button key={player.id} type="button" onClick={() => setSelectedPlayerId(player.id)} className={cx("min-w-[190px] rounded-2xl border p-4 text-left transition", selected ? "border-cyan-300/35 bg-cyan-400/10 shadow-lg shadow-cyan-950/20" : "border-white/10 bg-white/[0.035] hover:bg-white/[0.06]")}>
                    <div className="flex items-center gap-3">
                      <div className={cx("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border", selected ? "border-cyan-300/35 bg-cyan-400/10" : "border-white/10 bg-black/25")}>
                        <RoleIcon role={player.role} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-lg font-black text-white">{player.name}</p>
                        {player.riot_id && <p className="mt-1 truncate text-xs font-semibold text-slate-300">{player.riot_id}</p>}
                        {String(player.user_id || "") === String(user?.id || "") && <div className="mt-2"><Badge tone="orange">Mon profil</Badge></div>}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </Surface>

          {selectedPlayer && (
            <div className="grid gap-4 2xl:grid-cols-[minmax(360px,480px)_minmax(0,1fr)] 2xl:items-start">
              <Surface className="p-4 2xl:sticky 2xl:top-24">
                <div className="grid gap-4">
                  <div>
                    <TextInput label="Ajouter un champion" value={query} onChange={setQuery} placeholder="Cherche Ahri, Renekton, Kai'Sa..." icon={Search} />
                    <div className="mt-3 flex flex-wrap gap-2">
                      {laneOptions.map((lane) => (
                        <button key={lane} type="button" onClick={() => setLaneFilter(lane)} className={cx("rounded-2xl border px-3 py-2 text-xs font-black uppercase tracking-[0.12em] transition", laneFilter === lane ? "border-cyan-300/35 bg-cyan-400/10 text-cyan-100" : "border-white/10 bg-white/[0.035] text-slate-300 hover:text-white")}>{lane === "ALL" ? "Toutes lanes" : lane}</button>
                      ))}
                    </div>
                  </div>

                  <div onDragOver={(event) => canManageSelectedPool && event.preventDefault()} onDrop={(event) => canManageSelectedPool && dropOnChampionBase(event)}>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-xl font-black text-white">{selectedPlayer.name}</h3>
                        <p className="mt-1 text-sm font-semibold text-slate-300">{canManageSelectedPool ? `${visibleChampions.length} champions affichés · glisse ici un pick pour le retirer.` : "Lecture seule : seul le capitaine ou le joueur lié à ce profil peut modifier ce Champion Pool."}</p>
                      </div>
                      <Badge tone="orange">{selectedPlayer.role}</Badge>
                    </div>
                    <div className="grid max-h-[min(58vh,560px)] grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2 overflow-auto pr-1">
                      {visibleChampions.map((champion) => {
                        const championKeyValue = championAssetId(champion) || championKey(champion);
                        const active = pickedChampionKeys.has(championKeyValue);
                        return <ChampionSearchTile key={champion} champion={champion} active={active} existingRow={selectedChampionByKey.get(championKeyValue)} canManage={canManageSelectedPool} onDragStart={onDragStart} onQuickPick={saveChampion} />;
                      })}
                    </div>
                  </div>
                </div>
              </Surface>

              <div className="grid gap-3 xl:grid-cols-2">
                {CHAMPION_TIERS.map((tier) => {
                  const items = rowsForTier(tier.id);
                  return (
                    <Surface key={tier.id} className="p-3" delay={0}>
                      <div onDragOver={(event) => canManageSelectedPool && event.preventDefault()} onDrop={(event) => canManageSelectedPool && dropOnTier(event, tier.id)} className={cx("relative flex min-h-[230px] flex-col overflow-hidden rounded-[1.1rem] border p-3 backdrop-blur-2xl", championTierColumnFrame(tier))}>
                        <div className={cx("pointer-events-none absolute inset-0 bg-gradient-to-br opacity-90", championTierColumnGlow(tier))} />
                        <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent" />
                        <div className="relative z-10 mb-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <ChampionTierMark tier={tier} />
                              <h3 className="truncate text-lg font-black text-white">{tier.title}</h3>
                            </div>
                            <Badge tone={tier.tone}>{items.length}</Badge>
                          </div>
                        </div>
                        <div className="relative z-10 grid max-h-[210px] flex-1 content-start gap-2 overflow-auto pr-1 sm:grid-cols-2">
                          {items.length ? items.map((row) => <ChampionTierCard key={row.id} row={row} canManage={canManageSelectedPool} saving={saving} onDragStart={onDragStart} onDelete={deletePick} />) : <div className="col-span-full flex min-h-[150px] items-center justify-center rounded-xl border border-dashed border-white/10 p-4 text-center text-xs font-semibold leading-5 text-slate-300">{canManageSelectedPool ? "Glisse un champion ici." : "Lecture seule."}</div>}
                        </div>
                      </div>
                    </Surface>
                  );
                })}
              </div>
            </div>
          )}
        </>
      ) : (
        <Surface glow><EmptyState icon={Users} title="Aucun joueur" text="Ajoute le roster avant de construire les Champion Pools." /></Surface>
      )}
    </div>
  );
}

function compositionMastery(slots, rows) {
  const picked = Object.values(compositionSlots(slots)).map((slot) => rows.find((row) => row.id === slot.poolId)).filter(Boolean);
  if (!picked.length) return { label: "À remplir", tone: "slate" };
  const weights = { lock: 100, pocket: 78, work: 52, danger: 24 };
  const score = Math.round(picked.reduce((sum, row) => sum + (weights[championPoolStatus(row)] || 45), 0) / picked.length);
  return score >= 82 ? { label: "Très maîtrisée", tone: "green" } : score >= 65 ? { label: "Jouable", tone: "yellow" } : score >= 42 ? { label: "À valider", tone: "cyan" } : { label: "Trop fragile", tone: "red" };
}

function compositionPickList(slots, rows) {
  return COMP_ROLES.map((role) => {
    const pick = rows.find((row) => row.id === compositionSlots(slots)[role]?.poolId);
    return pick ? { ...pick, role } : null;
  }).filter(Boolean);
}

function directCounterReasons(candidate, picks) {
  const candidateId = championAssetId(candidate);
  return picks.flatMap((pick) => {
    const direct = DIRECT_COUNTERS[championAssetId(pick.champion)] || [];
    return direct.map(championAssetId).includes(candidateId) ? [`Counter direct de ${championDisplayName(pick.champion)}`] : [];
  });
}

function tagCounterReasons(candidate, picks) {
  const candidateTags = championStyleTags(candidate);
  const reasons = [];
  for (const pick of picks) {
    for (const tag of championStyleTags(pick.champion)) {
      for (const [counterTag, points, reason] of COUNTER_TAG_RULES[tag] || []) {
        if (candidateTags.includes(counterTag)) reasons.push({ points, reason });
      }
    }
  }
  return reasons;
}

function compositionCounterRecommendations(slots, rows, limitPerRole = 3) {
  const picks = compositionPickList(slots, rows);
  const pickedIds = new Set(picks.map((pick) => championAssetId(pick.champion)));
  if (!picks.length) return [];
  return COMP_ROLES.map((role) => {
    const candidates = championOptions()
      .filter((champion) => championMatchesLane(champion, role))
      .filter((champion) => !pickedIds.has(championAssetId(champion)))
      .map((champion) => {
        const directReasons = directCounterReasons(champion, picks);
        const tagReasons = tagCounterReasons(champion, picks);
        const score = directReasons.length * 38 + tagReasons.reduce((sum, item) => sum + item.points, 0);
        const reasons = [...directReasons, ...tagReasons.sort((a, b) => b.points - a.points).map((item) => item.reason)];
        return { role, champion, score, reasons: [...new Set(reasons)].slice(0, 3) };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || championDisplayName(a.champion).localeCompare(championDisplayName(b.champion)))
      .slice(0, limitPerRole);
    return { role, counters: candidates };
  });
}

function CompositionChampionTile({ row, active, onPick, onDragStart }) {
  const status = championPoolStatus(row);
  const tier = championTierByStatus(status);
  return <button type="button" draggable onDragStart={(event) => onDragStart(event, row)} onClick={() => onPick(row)} title={`${championDisplayName(row.champion)} · ${championPoolStatusLabel(status)}`} className={cx("group relative aspect-square min-w-0 rounded-[1.15rem] border p-1 text-left transition duration-200", active ? "border-cyan-200/75 bg-cyan-400/16 shadow-[0_0_28px_rgba(34,211,238,.22)]" : "border-white/10 bg-black/28 hover:border-cyan-300/35 hover:bg-cyan-400/10 hover:shadow-[0_0_22px_rgba(34,211,238,.12)]")}>
    <span className="relative block h-full w-full overflow-hidden rounded-[0.88rem] bg-black/45 ring-1 ring-white/10">
      <ChampionPortrait row={row} champion={row.champion} alt={row.champion} className="h-full w-full rounded-[inherit] object-cover" />
      <span className="absolute inset-0 bg-gradient-to-t from-black/88 via-black/12 to-black/10" />
      <ChampionTierMark tier={tier} active className="absolute right-1.5 top-1.5 z-40 h-5 w-5 rounded-md border border-white/60 bg-black/82 shadow-[0_0_10px_rgba(255,255,255,.18)] backdrop-blur-sm transition group-hover:scale-105 [&_svg]:h-3 [&_svg]:w-3" />
      <span className="absolute inset-x-1.5 bottom-1.5 z-30 truncate text-center text-[0.62rem] font-black text-white drop-shadow-[0_2px_6px_rgba(0,0,0,.9)]">{championDisplayName(row.champion)}</span>
    </span>
  </button>;
}

function CompositionSlot({ role, slot, players, rows, onChange }) {
  const rolePlayers = players.filter((player) => player.role === role);
  const player = players.find((item) => item.id === slot.playerId) || rolePlayers[0];
  const pick = rows.find((row) => row.id === slot.poolId);
  const status = pick ? championPoolStatus(pick) : "";
  function drop(event) {
    event.preventDefault();
    try {
      const payload = JSON.parse(event.dataTransfer.getData("application/json") || "{}");
      const row = rows.find((item) => item.id === payload.poolId);
      if (row && String(payload.role || row.role || "").toUpperCase() === role) onChange(role, { playerId: row.player_id || player?.id || "", poolId: row.id });
    } catch {}
  }
  return <div className="group relative overflow-hidden rounded-xl border border-white/10 bg-black/18 p-3">
    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/45 to-transparent" />
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2"><RoleIcon role={role} className="h-5 w-5" /><p className="text-sm font-black uppercase tracking-[0.16em] text-white">{roleLabel(role)}</p></div>
        <p className="mt-1 truncate text-xs font-bold text-cyan-100/75">{player?.name || "Profil manquant"}</p>
      </div>
      {pick ? <Badge tone={championPoolStatusTone(status)}>{championPoolStatusLabel(status)}</Badge> : <Badge tone="slate">À PICK</Badge>}
    </div>
    {rolePlayers.length > 1 && <div className="mt-3 flex flex-wrap gap-1.5">{rolePlayers.map((item) => <button key={item.id} type="button" onClick={() => onChange(role, { playerId: item.id, poolId: "" })} className={cx("rounded-xl border px-2.5 py-1.5 text-[0.62rem] font-black uppercase tracking-[0.1em] transition", item.id === player?.id ? "border-cyan-200/45 bg-cyan-400/12 text-cyan-50" : "border-white/10 bg-white/[0.035] text-slate-300 hover:text-white")}>{item.name}</button>)}</div>}
    <div onDragOver={(event) => event.preventDefault()} onDrop={drop} className={cx("relative mt-3 min-h-[168px] overflow-hidden rounded-xl border border-dashed p-3 transition", pick ? "border-cyan-200/28 bg-cyan-400/[0.055]" : "border-white/12 bg-white/[0.025] group-hover:border-cyan-300/22")}>
      {pick && <><ChampionBackdrop champion={pick.champion} /><div className="absolute inset-0 bg-gradient-to-t from-[#050711] via-[#050711]/72 to-transparent" /></>}
      <div className={cx("relative z-10 flex h-full min-h-[144px] flex-col", pick ? "justify-end" : "justify-center")}>
        {pick ? <div className="relative rounded-xl border border-white/10 bg-black/30 p-3 pr-10"><ChampionTierMark tier={championTierByStatus(status)} active className="absolute right-2 top-2 h-6 w-6 rounded-lg ring-1 ring-black/45 [&_svg]:h-3.5 [&_svg]:w-3.5" /><div className="flex items-end gap-3"><span className="inline-flex h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black/35"><ChampionPortrait row={pick} champion={pick.champion} alt={pick.champion} className="h-full w-full object-cover" /></span><div className="min-w-0"><p className="truncate text-xl font-black text-white">{championDisplayName(pick.champion)}</p><p className="mt-1 truncate text-xs font-bold text-slate-200">{compositionIdentity([pick]).tags.slice(0, 3).map(([tag]) => tagLabel(tag)).join(" · ") || "Standard"}</p></div></div><button type="button" onClick={() => onChange(role, { playerId: player?.id || "", poolId: "" })} className="mt-3 rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-slate-200 transition hover:border-rose-300/30 hover:text-rose-100">Vider</button></div> : <div className="flex h-full flex-col items-center justify-center text-center"><Sparkles className="h-5 w-5 text-cyan-100/70" /><p className="mt-3 text-sm font-black text-white">Glisse un champion ici</p><p className="mt-1 text-xs font-semibold text-slate-300">Pool {player?.name || role}</p></div>}
      </div>
    </div>
  </div>;
}

function CompositionChampionBank({ players, rows, slots, onPick }) {
  const tierOrder = { lock: 0, pocket: 1, work: 2, danger: 3 };
  const tierShortLabel = { lock: "Confiance", pocket: "Situationnel", work: "Validation", danger: "Training" };
  function dragStart(event, row, role) {
    event.dataTransfer.setData("application/json", JSON.stringify({ role, playerId: row.player_id || "", poolId: row.id }));
    event.dataTransfer.effectAllowed = "copy";
  }
  return <div className="mt-4 rounded-xl border border-white/10 bg-black/18 p-3">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-100/80">Banque de champions</p><p className="mt-1 text-sm font-semibold text-slate-300">Glisse une icône vers le cadre de compo correspondant.</p></div>
      <div className="flex flex-wrap gap-2">
        {CHAMPION_TIERS.map((tier) => <span key={tier.id} className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-black/24 px-3 py-2 text-[0.66rem] font-black uppercase tracking-[0.14em] text-white">
          <ChampionTierMark tier={tier} active className="h-7 w-7 rounded-xl border-white/18 bg-black/20 [&_svg]:h-4 [&_svg]:w-4" />
          {tier.title}
        </span>)}
      </div>
    </div>
    <div className="nxt5-composition-bank-grid mt-4 grid gap-3">
      {COMP_ROLES.map((role) => {
        const slot = slots[role] || {};
        const player = players.find((item) => item.id === slot.playerId) || players.find((item) => item.role === role);
        const pool = rows
          .filter((row) => (String(row.player_id || "") === String(player?.id || "") || row.player_name === player?.name) && String(row.role || role).toUpperCase() === role)
          .sort((a, b) => {
            const tierDiff = (tierOrder[championPoolStatus(a)] ?? 9) - (tierOrder[championPoolStatus(b)] ?? 9);
            if (tierDiff) return tierDiff;
            return championDisplayName(a.champion).localeCompare(championDisplayName(b.champion));
          });
        const tierGroups = CHAMPION_TIERS.map((tier) => ({ tier, items: pool.filter((row) => championPoolStatus(row) === tier.id) })).filter((group) => group.items.length);
        return <div key={role} className="min-w-0 rounded-xl border border-white/10 bg-black/18 p-3">
          <div className="mb-3 flex items-center justify-between gap-2"><span className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-white"><RoleIcon role={role} className="h-5 w-5" />{role}</span><span className="truncate text-[0.66rem] font-bold text-cyan-100/80">{player?.name || "Profil manquant"}</span></div>
          {tierGroups.length ? <div className="space-y-3">{tierGroups.map(({ tier, items }) => <section key={tier.id}>
            <div className="mb-2 flex min-w-0 items-center gap-2">
              <ChampionTierMark tier={tier} active className="h-6 w-6 rounded-lg [&_svg]:h-3.5 [&_svg]:w-3.5" />
              <p className="truncate text-[0.58rem] font-black uppercase tracking-[0.1em] text-slate-200">{tierShortLabel[tier.id]}</p>
              <span className="h-px min-w-2 flex-1 bg-white/[0.08]" />
              <span className="text-[0.58rem] font-black tabular-nums text-slate-400">{items.length}</span>
            </div>
            <div className="nxt5-composition-bank-pool grid gap-2">{items.map((row) => <CompositionChampionTile key={row.id} row={row} active={row.id === slot.poolId} onPick={() => onPick(role, { playerId: row.player_id || player?.id || "", poolId: row.id })} onDragStart={(event) => dragStart(event, row, role)} />)}</div>
          </section>)}</div> : <div className="rounded-xl border border-dashed border-white/10 bg-black/20 p-3 text-center text-xs font-semibold text-slate-300">Aucun champion.</div>}
        </div>;
      })}
    </div>
  </div>;
}

function CompositionCounterPanel({ slots, rows, compact = false }) {
  const groups = compositionCounterRecommendations(slots, rows, compact ? 1 : 3).filter((group) => group.counters.length);
  if (!groups.length) return <div className="mt-4 rounded-xl border border-dashed border-white/10 bg-black/18 p-3 text-sm font-semibold text-slate-300">Ajoute des champions dans la compo pour afficher les counters probables par rôle.</div>;
  const allCounters = groups.flatMap((group) => group.counters.map((counter) => ({ ...counter, role: group.role }))).sort((a, b) => b.score - a.score);
  if (compact) return <div className="mt-4 rounded-xl border border-rose-300/14 bg-rose-500/[0.045] p-3">
    <div className="mb-3 flex items-center justify-between gap-2"><Badge tone="red">Counters à prévoir</Badge></div>
    <div className="flex flex-wrap gap-2">{allCounters.slice(0, 5).map((counter) => <div key={`${counter.role}-${counter.champion}`} className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/24 py-1.5 pl-1.5 pr-3"><ChampionPortrait champion={counter.champion} alt={counter.champion} className="h-8 w-8 rounded-lg object-cover" /><span className="text-xs font-black text-white">{counter.role} · {championDisplayName(counter.champion)}</span></div>)}</div>
  </div>;
  return <div className="mt-4 rounded-xl border border-rose-300/14 bg-black/18 p-3">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div><Badge tone="red">Matchups</Badge><h3 className="mt-3 text-xl font-black text-white">Picks à vérifier</h3><p className="mt-1 text-sm font-semibold leading-6 text-slate-300">Ces champions peuvent poser problème à la compo selon leurs rôles et leurs styles.</p></div>
    </div>
    <div className="mt-4 grid gap-3 xl:grid-cols-5">
      {groups.map((group) => <div key={group.role} className="min-w-0 rounded-2xl border border-white/10 bg-black/24 p-3">
        <div className="mb-3 flex items-center justify-between gap-2"><span className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-white"><RoleIcon role={group.role} className="h-5 w-5" />{group.role}</span><Badge tone="red">{group.counters.length}</Badge></div>
        <div className="space-y-2">{group.counters.map((counter) => <div key={counter.champion} className="rounded-xl border border-white/10 bg-white/[0.035] p-2">
          <div className="flex min-w-0 items-center gap-2"><ChampionPortrait champion={counter.champion} alt={counter.champion} className="h-10 w-10 shrink-0 rounded-xl border border-white/10 object-cover" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-black text-white">{championDisplayName(counter.champion)}</p><p className="truncate text-[0.62rem] font-bold text-rose-100">Counter probable</p></div></div>
          <div className="mt-2 flex flex-wrap gap-1.5">{counter.reasons.map((reason) => <span key={reason} className="rounded-lg border border-rose-200/12 bg-rose-500/10 px-2 py-1 text-[0.58rem] font-black uppercase tracking-[0.08em] text-rose-50">{String(reason).toUpperCase()}</span>)}</div>
        </div>)}</div>
      </div>)}
    </div>
  </div>;
}

function CompositionCard({ composition, rows, canManage, saving, onEdit, onDuplicate, onDelete }) {
  const slots = compositionSlots(composition.slots);
  const tags = jsonList(composition.tags);
  const mastery = compositionMastery(slots, rows);
  const slotPicks = COMP_ROLES.map((role) => ({ role, pick: rows.find((row) => row.id === slots[role]?.poolId) }));
  const picks = slotPicks.map((slot) => slot.pick).filter(Boolean);
  const identity = compositionIdentity(picks);
  return <Surface className="group relative overflow-hidden p-0 transition duration-200 hover:border-cyan-300/28">
    <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-cyan-200/55 via-white/30 to-fuchsia-200/35" />
    <div className="relative z-10 p-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><Badge tone={mastery.tone}>{mastery.label}</Badge><Badge tone="cyan">{picks.length}/5 picks</Badge>{tags.map((tag) => <Badge key={tag} tone="purple">{tagLabel(tag)}</Badge>)}</div>
          <h3 className="mt-3 truncate text-2xl font-black text-white">{composition.title}</h3>
          <p className="mt-1 text-xs font-black uppercase tracking-[0.16em] text-cyan-100/72">Créée par {composition.created_by_name || "un membre"}</p>
          {composition.notes && <p className="mt-3 max-w-4xl text-sm font-semibold leading-6 text-slate-200">{composition.notes}</p>}
        </div>
        {canManage && <div className="flex shrink-0 gap-1 rounded-xl border border-white/10 bg-black/24 p-1">
          <button type="button" onClick={() => onEdit(composition)} disabled={saving} title="Modifier" className="rounded-xl p-2 text-slate-300 transition hover:bg-cyan-400/10 hover:text-cyan-100"><Clipboard className="h-4 w-4" /></button>
          <button type="button" onClick={() => onDuplicate(composition)} disabled={saving} title="Dupliquer" className="rounded-xl p-2 text-slate-300 transition hover:bg-violet-400/10 hover:text-violet-100"><RefreshCw className="h-4 w-4" /></button>
          <button type="button" onClick={() => onDelete(composition.id)} disabled={saving} title="Supprimer" className="rounded-xl p-2 text-slate-300 transition hover:bg-rose-500/10 hover:text-rose-200"><Trash2 className="h-4 w-4" /></button>
        </div>}
      </div>
      <div className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-black/24">
        <div className="nxt5-composition-card-slots grid gap-px bg-white/10">
          {slotPicks.map(({ role, pick }) => {
            const pickStatus = pick ? championPoolStatus(pick) : "";
            const tier = pick ? championTierByStatus(pickStatus) : null;
            return <div key={role} className={cx("relative min-h-[140px] overflow-hidden bg-[#07101f] p-3", pick ? "text-white" : "text-slate-400")}>
              {pick && <ChampionBackdrop champion={pick.champion} />}
              <div className="absolute inset-0 bg-gradient-to-b from-black/12 via-[#06101f]/74 to-[#050814]" />
              <div className="relative z-10 flex h-full min-h-[116px] flex-col justify-between">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/35 px-2.5 py-1 text-[0.66rem] font-black uppercase tracking-[0.14em]"><RoleIcon role={role} className="h-4 w-4 text-cyan-100" />{role}</span>
                  {tier && <ChampionTierMark tier={tier} active className="h-8 w-8 rounded-xl ring-1 ring-black/45 [&_svg]:h-4 [&_svg]:w-4" />}
                </div>
                {pick ? <div className="mt-5">
                  <div className="flex items-end gap-3">
                    <span className="inline-flex h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-white/15 bg-black/45"><ChampionPortrait row={pick} champion={pick.champion} alt={pick.champion} className="h-full w-full object-cover" /></span>
                    <div className="min-w-0 pb-1">
                      <p className="truncate text-lg font-black text-white">{championDisplayName(pick.champion)}</p>
                      <p className="truncate text-xs font-bold text-slate-200">{pick.player_name || "Joueur"}</p>
                    </div>
                  </div>
                  <p className="mt-3 truncate rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-[0.66rem] font-black uppercase tracking-[0.12em] text-cyan-100">{championPoolStatusLabel(pickStatus)}</p>
                </div> : <div className="flex flex-1 items-center justify-center text-sm font-black uppercase tracking-[0.16em] text-slate-500">Slot vide</div>}
              </div>
            </div>;
          })}
        </div>
      </div>
      {(identity.tags.length > 0 || picks.length > 0) && <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge tone={championStyleTone(identity.primary)}>{tagLabel(identity.primary)}</Badge>
        {identity.tags.map(([tag, count]) => <Badge key={tag} tone={championStyleTone(tag)}>{tagLabel(tag)} x{count}</Badge>)}
      </div>}
      <CompositionCounterPanel slots={slots} rows={rows} compact />
    </div>
  </Surface>;
}

function CompositionTagLexicon({ open }) {
  if (!open) return null;
  return <div className="nxt5-enter-fast mt-4 overflow-hidden rounded-[1.35rem] border border-cyan-200/16 bg-[#050914]/82 p-4 shadow-[0_0_34px_rgba(34,211,238,.08)] backdrop-blur-xl">
    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between"><div><Badge tone="cyan">Sommaire</Badge><h3 className="mt-3 text-xl font-black text-white">Lexique des tags champions</h3><p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-slate-200">Ces tags décrivent l'identité d'un champion dans une Compo Type. Ils servent à lire rapidement le plan de draft, pas à juger automatiquement la compo.</p></div><div className="hidden rounded-full border border-fuchsia-300/20 bg-fuchsia-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-fuchsia-100 md:block">NXT5 Draft</div></div>
    <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{CHAMPION_TAG_DEFINITIONS.map(([tag, definition]) => <div key={tag} className="rounded-2xl border border-white/10 bg-white/[0.035] p-3"><div className="flex items-center justify-between gap-2"><Badge tone={championStyleTone(tag)}>{tagLabel(tag)}</Badge></div><p className="mt-2 text-sm font-semibold leading-6 text-slate-200">{definition}</p></div>)}</div>
    <div className="mt-4 rounded-2xl border border-violet-300/14 bg-violet-400/[0.055] p-3"><p className="text-xs font-black uppercase tracking-[0.18em] text-violet-100">Tags de classement</p><div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">{COMPOSITION_TAG_DEFINITIONS.map(([tag, definition]) => <div key={tag} className="rounded-xl border border-white/10 bg-black/20 p-3"><Badge tone="purple">{tagLabel(tag)}</Badge><p className="mt-2 text-xs font-semibold leading-5 text-slate-200">{definition}</p></div>)}</div></div>
  </div>;
}

function ChampionPoolColorSummary() {
  return <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-black/25 px-3 py-2 shadow-[0_0_18px_rgba(34,211,238,.05)]">
    <span className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-slate-300">Couleurs pool</span>
    {CHAMPION_TIERS.map((tier) => <span key={tier.id} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] py-1 pl-1 pr-2.5 text-[0.62rem] font-black uppercase tracking-[0.08em] text-slate-100"><ChampionTierMark tier={tier} className="h-6 w-6 rounded-lg [&_svg]:h-3.5 [&_svg]:w-3.5" />{tier.title}</span>)}
  </div>;
}

function CompositionSummaryStrip({ players, rows, compositions, formPicks }) {
  const locked = rows.filter((row) => ["lock", "pocket"].includes(championPoolStatus(row))).length;
  const items = [
    ["Roster", `${players.length}/5`, "Profils lanes"],
    ["Pool draft", rows.length, `${locked} prêts`],
    ["Compos", compositions.length, "Enregistrées"],
    ["Builder", `${formPicks.length}/5`, "Picks actifs"],
  ];
  return <div className="mb-4 grid gap-2 sm:grid-cols-2 2xl:grid-cols-4">{items.map(([label, value, detail]) => <div key={label} className="rounded-xl border border-white/10 bg-black/18 px-3 py-2.5"><p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-slate-400">{label}</p><div className="mt-1 flex items-end justify-between gap-3"><span className="text-xl font-black text-white">{value}</span><span className="truncate text-xs font-semibold text-cyan-100/75">{detail}</span></div></div>)}</div>;
}

function Compositions({ data, selectedTeamId, refreshAll, pushToast, currentMember, user }) {
  const isStaff = canStaffManage(currentMember?.role);
  const canCreate = Boolean(currentMember);
  const players = (data.players || []).filter((player) => player.team_id === selectedTeamId && COMP_ROLES.includes(player.role));
  const rows = (data.championPool || []).filter((row) => row.team_id === selectedTeamId && ["manual", "riot_manual"].includes(String(row.source || "")));
  const compositions = (data.compositions || []).filter((item) => item.team_id === selectedTeamId);
  const [form, setForm] = useState({ id: null, title: "", notes: "", tags: [], slots: emptyCompositionSlots(players) });
  const [saving, setSaving] = useState(false);
  const [sideFilter, setSideFilter] = useState("all");
  const [showTagLexicon, setShowTagLexicon] = useState(false);
  const tagOptions = ["blue side", "red side"];

  useEffect(() => {
    setForm((current) => ({ ...current, slots: { ...emptyCompositionSlots(players), ...(current.slots || {}) } }));
  }, [players.map((player) => player.id).join("|")]);

  function updateSlot(role, slot) {
    setForm((current) => ({ ...current, slots: { ...current.slots, [role]: slot } }));
  }

  function toggleCompTag(tag) {
    setForm((current) => ({ ...current, tags: current.tags.includes(tag) ? current.tags.filter((item) => item !== tag) : [...current.tags, tag] }));
  }

  function resetCompositionForm() {
    setForm({ id: null, title: "", notes: "", tags: [], slots: emptyCompositionSlots(players) });
  }

  function editComposition(composition) {
    setForm({ id: composition.id, title: composition.title || "", notes: composition.notes || "", tags: jsonList(composition.tags), slots: { ...emptyCompositionSlots(players), ...compositionSlots(composition.slots) } });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function duplicateComposition(composition) {
    setForm({ id: null, title: `${composition.title || "Compo"} copie`, notes: composition.notes || "", tags: jsonList(composition.tags), slots: { ...emptyCompositionSlots(players), ...compositionSlots(composition.slots) } });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveComposition(event) {
    event.preventDefault();
    if (!canCreate) return;
    setSaving(true);
    try {
      await apiFetch("composition-types-manage", { method: "POST", body: JSON.stringify({ action: form.id ? "update" : "create", teamId: selectedTeamId, compositionId: form.id, title: form.title, notes: form.notes, tags: form.tags, slots: form.slots }) });
      resetCompositionForm();
      await refreshAll();
      pushToast({ type: "green", title: form.id ? "Compo mise à jour" : "Compo créée", text: "La Compo Type est disponible pour la team." });
    } catch (err) {
      pushToast({ type: "red", title: "Enregistrement impossible", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function deleteComposition(compositionId) {
    const composition = compositions.find((item) => item.id === compositionId);
    const canManageComposition = isStaff || composition?.created_by === user?.id;
    if (!canManageComposition || !window.confirm("Supprimer cette Compo Type ?")) return;
    setSaving(true);
    try {
      await apiFetch("composition-types-manage", { method: "POST", body: JSON.stringify({ action: "delete", teamId: selectedTeamId, compositionId }) });
      await refreshAll();
      pushToast({ type: "green", title: "Compo supprimée", text: "La liste est à jour." });
    } catch (err) {
      pushToast({ type: "red", title: "Suppression impossible", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  const mastery = compositionMastery(form.slots, rows);
  const filteredCompositions = compositions.filter((composition) => sideFilter === "all" || jsonList(composition.tags).includes(sideFilter));
  const sideOptions = [
    { id: "all", label: "Toutes" },
    { id: "blue side", label: "Blue Side" },
    { id: "red side", label: "Red Side" },
  ];
  const formPicks = COMP_ROLES.map((role) => rows.find((row) => row.id === form.slots?.[role]?.poolId)).filter(Boolean);
  const formIdentity = compositionIdentity(formPicks);
  return (
    <div className="nxt5-data-dense nxt5-compositions-page min-w-0 overflow-hidden">
      <PageHeader eyebrow="Draft" title="Compositions" subtitle="Prépare les picks de chaque rôle à partir des Champion Pools.">
        <button type="button" onClick={() => setShowTagLexicon((open) => !open)} className="inline-flex items-center gap-2 rounded-lg border border-cyan-300/20 bg-cyan-400/10 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-cyan-100 transition hover:border-cyan-200/45 hover:bg-cyan-400/16">
          <BookOpen className="h-4 w-4" />
          Tags
          <ChevronDown className={cx("h-4 w-4 transition", showTagLexicon && "rotate-180")} />
        </button>
        <ChampionPoolColorSummary />
      </PageHeader>

      <CompositionSummaryStrip players={players} rows={rows} compositions={compositions} formPicks={formPicks} />

      <React.Fragment>
        <CompositionTagLexicon open={showTagLexicon} />
      </React.Fragment>

      {players.length ? (
        <form onSubmit={saveComposition} className="mt-4">
          <Surface glow className="p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="cyan">Builder 5 lanes</Badge>
                  <Badge tone={mastery.tone}>{mastery.label}</Badge>
                </div>
                <h3 className="mt-3 text-2xl font-black text-white md:text-3xl">{form.id ? "Modifier la Compo" : "Nouvelle Compo"}</h3>
                <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-300">Choisis les champions directement dans le pool de chaque poste. Drag & drop ou clic, la categorie se met a jour instantanement.</p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {form.id && <Button type="button" variant="ghost" icon={X} onClick={resetCompositionForm}>Annuler</Button>}
                <Button type="submit" icon={saving ? Loader2 : form.id ? Check : Plus} disabled={!canCreate || saving || !form.title.trim()}>{form.id ? "Enregistrer" : "Creer"}</Button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(260px,.32fr)] xl:items-start">
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                <TextInput label="Nom de la Compo" value={form.title} onChange={(title) => setForm((current) => ({ ...current, title }))} placeholder="Ex: Engage Dragon, Front-to-Back Jinx..." required icon={Sparkles} />
                <div className="flex flex-wrap gap-2">
                  {tagOptions.map((tag) => <button key={tag} type="button" onClick={() => toggleCompTag(tag)} className={cx("rounded-lg border px-3 py-2 text-xs font-black uppercase tracking-[0.1em] transition", form.tags.includes(tag) ? "border-violet-300/35 bg-violet-400/10 text-violet-100" : "border-white/10 bg-white/[0.035] text-slate-300 hover:text-white")}>{tagLabel(tag)}</button>)}
                </div>
              </div>

              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-300">Resume</span>
                <textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Plan de jeu, conditions de draft..." rows={3} className="nxt5-input-shell w-full resize-none rounded-xl border border-cyan-100/14 bg-[#030712]/70 px-4 py-3 text-sm font-semibold leading-6 text-white outline-none transition placeholder:text-slate-400 focus:border-cyan-300/65 focus:ring-4 focus:ring-cyan-300/12" />
              </label>
            </div>

            <div className="nxt5-composition-slots mt-4 grid gap-3">
              {COMP_ROLES.map((role) => <CompositionSlot key={role} role={role} slot={form.slots[role] || {}} players={players} rows={rows} onChange={updateSlot} />)}
            </div>

            {formPicks.length > 0 && <div className="nxt5-flat-block mt-4 rounded-xl border p-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <Badge tone={championStyleTone(formIdentity.primary)}>Identite en cours</Badge>
                  <h4 className="mt-2 text-xl font-black text-white">{tagLabel(formIdentity.primary)}</h4>
                  <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-slate-200">{formIdentity.text}</p>
                </div>
                <Badge tone="cyan">{formPicks.length}/5 picks</Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">{formIdentity.tags.length ? formIdentity.tags.map(([tag, count]) => <Badge key={tag} tone={championStyleTone(tag)}>{tagLabel(tag)} x{count}</Badge>) : <Badge tone="slate">Standard</Badge>}</div>
            </div>}

            <CompositionCounterPanel slots={form.slots} rows={rows} />
            <CompositionChampionBank players={players} rows={rows} slots={form.slots} onPick={updateSlot} />
          </Surface>
        </form>
      ) : <EmptyState icon={Users} title="Roster incomplet" text="Ajoute les joueurs TOP, JGL, MID, ADC et SUP pour creer des Compos Types." />}

      <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-xs font-black uppercase tracking-[0.22em] text-slate-300">Compos enregistrees</h3>
          <p className="mt-1 text-xs font-bold text-slate-400">{filteredCompositions.length} / {compositions.length} visibles</p>
        </div>
        <div className="flex w-full rounded-xl border border-white/10 bg-black/20 p-1 md:w-auto">
          {sideOptions.map((option) => <button key={option.id} type="button" onClick={() => setSideFilter(option.id)} className={cx("flex-1 rounded-lg px-3 py-2 text-xs font-black uppercase tracking-[0.12em] transition md:flex-none", sideFilter === option.id ? "bg-cyan-300 text-slate-950 shadow-[0_0_16px_rgba(34,211,238,0.24)]" : "text-slate-300 hover:bg-white/[0.05] hover:text-white")}>{option.label}</button>)}
        </div>
      </div>

      <div className="mt-3 grid gap-3">
        {filteredCompositions.length ? filteredCompositions.map((composition) => <CompositionCard key={composition.id} composition={composition} rows={rows} canManage={isStaff || composition.created_by === user?.id} saving={saving} onEdit={editComposition} onDuplicate={duplicateComposition} onDelete={deleteComposition} />) : compositions.length ? <EmptyState icon={Sparkles} title="Aucune Compo pour ce side" text="Change le filtre ou ajoute le tag Blue Side / Red Side sur une Compo." /> : <EmptyState icon={Sparkles} title="Aucune Compo Type" text="Cree une premiere Compo a partir des Champion Pools de tes joueurs." />}
      </div>
    </div>
  );
}

function DraftWorkspace({ data, selectedTeamId, refreshAll, pushToast, currentMember, user, route, navigate }) {
  const view = draftViewFromPath(route?.path);
  const icons = { pool: Crown, compositions: Sparkles };
  return <div>
    <TabNav className="mb-5" label="Espace Draft" items={DRAFT_VIEW_ROUTES.map((item) => ({ ...item, icon: icons[item.id] }))} activeId={view} onChange={(id) => navigate(draftPathFromView(id))} columns="sm:grid-cols-2" />
    {view === "compositions"
      ? <Compositions data={data} selectedTeamId={selectedTeamId} refreshAll={refreshAll} pushToast={pushToast} currentMember={currentMember} user={user} />
      : <Champions data={data} selectedTeamId={selectedTeamId} refreshAll={refreshAll} pushToast={pushToast} currentMember={currentMember} user={user} />}
  </div>;
}

export { DraftWorkspace, Champions, championOptions, ChampionTierCard, ChampionMasteryPortrait, ChampionSearchTile, ChampionPoolColorSummary, Compositions, compositionMastery, CompositionSlot, championTierByStatus, CompositionChampionBank, CompositionChampionTile, CompositionCounterPanel, compositionCounterRecommendations, compositionPickList, directCounterReasons, DIRECT_COUNTERS, tagCounterReasons, COUNTER_TAG_RULES, CompositionCard, CompositionTagLexicon, CHAMPION_TAG_DEFINITIONS, COMPOSITION_TAG_DEFINITIONS, CompositionSummaryStrip };
