import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Clipboard, Loader2, Plus, Shield, Trophy, UserPlus, Users, X, Check, Image as ImageIcon, Pencil, Trash2, UserMinus, Upload, EyeOff, RefreshCw, ShieldCheck } from "lucide-react";
import { apiFetch } from "../../api/client.js";
import { openAppPath } from "../../app/routing.js";
import { Badge, Button, EmptyState, PageHeader, SelectInput, Surface, TextAreaInput, TextInput } from "../../components/ui/Core.jsx";
import { cx, tone, profileStatusLabel, profileStatusTone } from "../../app/helpers.js";
import { multiOpggUrlFromRoster, playerRosterStatus, rosterPlayersByStatus, rosterStatusMeta, ROSTER_STATUS_OPTIONS } from "../../utils/roster.js";
import { RoleIcon } from "../../components/brand/BrandAssets.jsx";
import { ROSTER_ROLE_ORDER, canStaffManage, isGameplayRole, isStaffRole, formatCountdown, championDisplayName, sortPlayersByRole, teamMatchRows, buildStaffAlerts, normalizeProfileRole, lazyNamed, loadNextPhase, TEAM_ACCESS_ROLES, COMP_ROLES, STAFF_ROLES, ChampionPortrait, playerIntegratedRows } from "./workspace-shared.jsx";
import { roleLabel } from "./shell-shared.jsx";
import "./Teams.css";

const HomeActionSummary = lazyNamed(loadNextPhase, "HomeActionSummary");
const TeamDataHealthPanel = lazyNamed(loadNextPhase, "TeamDataHealthPanel");

const PROFILE_ROLES = [...COMP_ROLES, "SUB", ...STAFF_ROLES];

function rosterRoleIndex(role) {
  const normalized = String(role || "").toUpperCase();
  const index = [...COMP_ROLES, "SUB"].indexOf(normalized);
  return index === -1 ? 99 : index;
}

function RoleTag({ role, staff = false, className = "" }) {
  const label = roleLabel(role);
  return (
    <Badge tone={staff ? "purple" : "blue"} className={cx("overflow-hidden justify-center px-2 sm:justify-start sm:px-2.5", className)} title={label}>
      <span className="block max-w-full truncate">{label}</span>
    </Badge>
  );
}

function decodeLoose(value) {
  let output = String(value || "").replace(/\+/g, " ");
  for (let i = 0; i < 2; i += 1) {
    try {
      const decoded = decodeURIComponent(output);
      if (decoded === output) break;
      output = decoded;
    } catch {
      break;
    }
  }
  return output;
}

function parseMultiOpgg(input) {
  const text = decodeLoose(input);
  const players = [];
  const seen = new Set();

  function addRiotId(name, tag) {
    const cleanName = String(name || "").trim().replace(/\s+/g, " ");
    const cleanTag = String(tag || "").trim().toUpperCase();
    if (!cleanName || !cleanTag) return;
    const riotId = `${cleanName}#${cleanTag}`;
    const key = riotId.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    players.push({ name: cleanName, riotId });
  }

  const riotIdPattern = /([\p{L}\p{N} _.'-]{2,32})\s*#\s*([A-Za-z0-9]{2,8})/gu;
  for (const match of text.matchAll(riotIdPattern)) addRiotId(match[1], match[2]);

  const urlPattern = /https?:\/\/\S+/g;
  for (const urlText of text.match(urlPattern) || []) {
    try {
      const url = new URL(urlText);
      const summoners = [
        ...url.searchParams.getAll("summoners"),
        ...url.searchParams.getAll("summoner"),
        ...url.searchParams.getAll("summonerName"),
      ].join(",");
      for (const entry of decodeLoose(summoners).split(/[,;\n|]+/)) {
        for (const match of entry.matchAll(riotIdPattern)) addRiotId(match[1], match[2]);
      }
    } catch {}
  }

  const opggPathPattern = /(?:summoners\/|^)(?:[a-z]{2,5}\/)?([^/?#&,;|\n]+)-([A-Za-z0-9]{2,8})/gi;
  for (const match of text.matchAll(opggPathPattern)) {
    addRiotId(decodeLoose(match[1]).replace(/-/g, " "), match[2]);
  }

  return players;
}

function opggUrlFromRiotId(riotId, region) {
  const [name, tag] = String(riotId).split("#");
  if (!name || !tag) return "";
  const slug = encodeURIComponent(`${name}-${tag}`);
  return `https://www.op.gg/lol/summoners/${String(region || "EUW").toLowerCase()}/${slug}`;
}

function Teams({ data, refreshAll, selectedTeamId, setSelectedTeamId, currentMember, routeSearch = "", pushToast, user, managementOnly = false }) {
  const [teamForm, setTeamForm] = useState({ name: "", tag: "", region: "EUW", multiOpgg: "" });
  const [playerForm, setPlayerForm] = useState({ name: "", riotId: "", opggUrl: "", role: "TOP", rosterStatus: "AUTO" });
  const [joinCode, setJoinCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [syncingPlayerId, setSyncingPlayerId] = useState("");
  const [teamSetupOpen, setTeamSetupOpen] = useState(false);
  const [riotCooldownUntil, setRiotCooldownUntil] = useState(0);
  const [nowTick, setNowTick] = useState(Date.now());
  const [teamEdit, setTeamEdit] = useState({ name: "", tag: "", avatarDataUrl: "", avatarZoom: 1, avatarX: 50, avatarY: 50 });
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [playerEditForm, setPlayerEditForm] = useState({ name: "", riotId: "", opggUrl: "", rosterStatus: "MAIN" });
  const selectedTeam = data.teams.find((team) => team.id === selectedTeamId) || data.teams[0];
  const roster = selectedTeam ?data.players.filter((player) => player.team_id === selectedTeam.id) : [];
  const gameplayRoster = roster.filter((player) => isGameplayRole(player.role));
  const mainTeamRoster = rosterPlayersByStatus(gameplayRoster, "MAIN");
  const substituteRoster = rosterPlayersByStatus(gameplayRoster, "SUB");
  const teamMembers = selectedTeam ?(data.teamMembers || []).filter((member) => member.team_id === selectedTeam.id) : [];
  const inviteCodes = selectedTeam ?(data.inviteCodes || []).filter((code) => code.team_id === selectedTeam.id) : [];
  const multiPlayers = useMemo(() => parseMultiOpgg(teamForm.multiOpgg), [teamForm.multiOpgg]);
  const hasTeams = data.teams.length > 0;
  const canManageTeam = canStaffManage(currentMember?.role);
  const canDeleteTeam = ["owner", "captain"].includes(String(currentMember?.role || "").toLowerCase());
  const riotCooldownSeconds = Math.max(0, Math.ceil((riotCooldownUntil - nowTick) / 1000));

  useEffect(() => {
    if (!selectedTeamId && data.teams[0]?.id) setSelectedTeamId(data.teams[0].id);
  }, [data.teams, selectedTeamId, setSelectedTeamId]);

  useEffect(() => {
    const params = new URLSearchParams(routeSearch || window.location.search);
    setTeamSetupOpen(params.get("create") === "1" || params.has("invite"));
    if (params.has("invite")) setJoinCode(params.get("invite") || "");
  }, [routeSearch]);

  useEffect(() => {
    if (!riotCooldownUntil) return undefined;
    const timer = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [riotCooldownUntil]);

  useEffect(() => {
    if (!selectedTeam) return;
    setTeamEdit({
      name: selectedTeam.name || "",
      tag: selectedTeam.tag || "",
      avatarDataUrl: selectedTeam.avatar_data_url || "",
      avatarZoom: Number(selectedTeam.avatar_zoom || 1),
      avatarX: Number(selectedTeam.avatar_x ?? 50),
      avatarY: Number(selectedTeam.avatar_y ?? 50),
    });
  }, [selectedTeam?.id]);

  async function createTeam(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const result = await apiFetch("teams-create", { method: "POST", body: JSON.stringify({ name: teamForm.name, tag: teamForm.tag, region: teamForm.region }) });
      const createdTeam = result.team;
      let importedCount = 0;
      for (const [index, player] of multiPlayers.entries()) {
        await apiFetch("players-create", {
          method: "POST",
          body: JSON.stringify({
            teamId: createdTeam.id,
            name: player.name,
            riotId: player.riotId,
            opggUrl: opggUrlFromRiotId(player.riotId, teamForm.region),
            role: ROSTER_ROLE_ORDER[index] || "SUB",
          }),
        });
        importedCount += 1;
      }
      setTeamForm({ name: "", tag: "", region: "EUW", multiOpgg: "" });
      setSelectedTeamId(createdTeam.id);
      setTeamSetupOpen(false);
      openAppPath("/equipes");
      await refreshAll({ teamId: createdTeam.id });
      pushToast({ type: "green", title: "Team créée", text: importedCount ?`${importedCount} joueur${importedCount > 1 ?"s" : ""} importé${importedCount > 1 ?"s" : ""} depuis le multi OP.GG.` : "Tu peux maintenant ajouter le roster ou générer un code d’invitation." });
    } catch (err) {
      pushToast({ type: "red", title: "Création impossible", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function joinTeam(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const result = await apiFetch("teams-join", { method: "POST", body: JSON.stringify({ invite: joinCode }) });
      setSelectedTeamId(result.team.id);
      setJoinCode("");
      setTeamSetupOpen(false);
      openAppPath("/equipes");
      await refreshAll({ teamId: result.team.id });
      pushToast({ type: "green", title: "Team rejointe", text: "Tu as maintenant accès à cette structure." });
    } catch (err) {
      pushToast({ type: "red", title: "Invitation invalide", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function createPlayer(event) {
    event.preventDefault();
    if (!selectedTeam) return;
    setSaving(true);
    try {
      await apiFetch("players-create", { method: "POST", body: JSON.stringify({ ...playerForm, rosterStatus: playerForm.rosterStatus === "AUTO" ? "" : playerForm.rosterStatus, teamId: selectedTeam.id }) });
      setPlayerForm({ name: "", riotId: "", opggUrl: "", role: "TOP", rosterStatus: "AUTO" });
      await refreshAll();
      pushToast({ type: "green", title: isStaffRole(playerForm.role) ? "Staff ajouté" : "Joueur ajouté", text: "Roster mis à jour." });
    } catch (err) {
      pushToast({ type: "red", title: "Ajout impossible", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function copyInviteLink() {
    if (!selectedTeam) return;
    setSaving(true);
    try {
      const result = await apiFetch("teams-invite-code", { method: "POST", body: JSON.stringify({ teamId: selectedTeam.id }) });
      await navigator.clipboard.writeText(result.code);
      await refreshAll();
      pushToast({ type: "green", title: "Code d’invitation copié", text: `${result.code} est valable 1h maximum.` });
    } catch (err) {
      pushToast({ type: "red", title: "Code impossible", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function copyMultiOpggLink(players, label) {
    if (!selectedTeam || !players.length) return;
    const link = multiOpggUrlFromRoster(players, selectedTeam.region);
    if (!link) {
      pushToast({ type: "red", title: "Multi OP.GG impossible", text: "Ajoute des Riot IDs au format Pseudo#TAG." });
      return;
    }
    await navigator.clipboard.writeText(link);
    const linkedCount = players.filter((player) => String(player.riot_id || "").includes("#")).length;
    pushToast({ type: "green", title: `Multi OP.GG ${label} copié`, text: `${linkedCount} joueur${linkedCount > 1 ?"s" : ""} dans le lien.` });
  }

  async function copyPlayerOpggLink(player) {
    const link = String(player?.opgg_url || "").trim() || opggUrlFromRiotId(player?.riot_id, selectedTeam?.region);
    if (!link) {
      pushToast({ type: "red", title: "OP.GG introuvable", text: "Ajoute un Riot ID ou un lien OP.GG sur ce profil." });
      return;
    }
    await navigator.clipboard.writeText(link);
    pushToast({ type: "green", title: "OP.GG copié", text: `${player?.name || "Profil"} est dans le presse-papiers.` });
  }

  function openPlayerEdit(player) {
    setEditingPlayer(player);
    setPlayerEditForm({
      name: player?.name || "",
      riotId: player?.riot_id || "",
      opggUrl: player?.opgg_url || "",
      rosterStatus: playerRosterStatus(player),
    });
  }

  function closePlayerEdit() {
    setEditingPlayer(null);
    setPlayerEditForm({ name: "", riotId: "", opggUrl: "", rosterStatus: "MAIN" });
  }

  async function updatePlayer(event) {
    event.preventDefault();
    if (!selectedTeam || !editingPlayer) return;
    setSaving(true);
    try {
      await apiFetch("players-update", { method: "POST", body: JSON.stringify({ teamId: selectedTeam.id, playerId: editingPlayer.id, ...playerEditForm }) });
      closePlayerEdit();
      await refreshAll();
      pushToast({ type: "green", title: "Profil modifié", text: "Identité, OP.GG et effectif sont à jour." });
    } catch (err) {
      pushToast({ type: "red", title: "Modification impossible", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function updatePlayerRosterStatus(player, rosterStatus) {
    if (!selectedTeam || !player || playerRosterStatus(player) === rosterStatus) return;
    setSaving(true);
    try {
      await apiFetch("players-update", { method: "POST", body: JSON.stringify({ teamId: selectedTeam.id, playerId: player.id, name: player.name, riotId: player.riot_id || "", opggUrl: player.opgg_url || "", rosterStatus }) });
      await refreshAll();
      pushToast({ type: "green", title: "Effectif mis à jour", text: `${player.name} passe dans ${rosterStatusMeta(rosterStatus).label}.` });
    } catch (err) {
      pushToast({ type: "red", title: "Modification impossible", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function linkPlayerAccount(playerId, userId) {
    if (!selectedTeam) return;
    setSaving(true);
    try {
      await apiFetch("players-link-account", { method: "POST", body: JSON.stringify({ teamId: selectedTeam.id, playerId, userId: userId || null }) });
      await refreshAll();
      pushToast({ type: "green", title: userId ?"Compte lié" : "Compte délié", text: "La gestion de la team est à jour." });
    } catch (err) {
      pushToast({ type: "red", title: "Liaison impossible", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function updateMemberRole(userId, role) {
    if (!selectedTeam) return;
    setSaving(true);
    try {
      await apiFetch("team-member-role", { method: "POST", body: JSON.stringify({ teamId: selectedTeam.id, userId, role }) });
      await refreshAll();
      pushToast({ type: "green", title: "Statut mis à jour", text: "Le profil reflète son rôle dans la team." });
    } catch (err) {
      pushToast({ type: "red", title: "Modification impossible", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  function loadTeamAvatar(file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      pushToast({ type: "red", title: "Avatar invalide", text: "Choisis une image depuis ton PC." });
      return;
    }
    if (file.size > 900000) {
      pushToast({ type: "yellow", title: "Image trop lourde", text: "Prends une image sous 900 Ko pour garder l’avatar léger." });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setTeamEdit((current) => ({ ...current, avatarDataUrl: String(reader.result || "") }));
    reader.readAsDataURL(file);
  }

  async function updateTeam(event) {
    event.preventDefault();
    if (!selectedTeam) return;
    setSaving(true);
    try {
      await apiFetch("teams-update", { method: "POST", body: JSON.stringify({ teamId: selectedTeam.id, ...teamEdit }) });
      await refreshAll();
      pushToast({ type: "green", title: "Team mise à jour", text: "Nom et avatar sont synchronisés." });
    } catch (err) {
      pushToast({ type: "red", title: "Modification impossible", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function removeMember(userId, label) {
    if (!selectedTeam) return;
    if (!window.confirm(`Renvoyer ${label || "ce profil"} de la team ?`)) return;
    setSaving(true);
    try {
      await apiFetch("team-member-remove", { method: "POST", body: JSON.stringify({ teamId: selectedTeam.id, userId }) });
      await refreshAll();
      pushToast({ type: "green", title: "Profil renvoyé", text: "Le compte n'a plus accès à cette team." });
    } catch (err) {
      pushToast({ type: "red", title: "Renvoi impossible", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function deletePlayer(playerId, label) {
    if (!selectedTeam) return;
    if (!window.confirm(`Supprimer le profil "${label || "sélectionné"}" du roster ?`)) return;
    setSaving(true);
    try {
      await apiFetch("players-delete", { method: "POST", body: JSON.stringify({ teamId: selectedTeam.id, playerId }) });
      if (editingPlayer?.id === playerId) closePlayerEdit();
      await refreshAll();
      pushToast({ type: "green", title: "Profil supprimé", text: "Le roster de gestion est à jour." });
    } catch (err) {
      pushToast({ type: "red", title: "Suppression impossible", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function syncPlayerMostPlayed(player) {
    if (!selectedTeam || !player) return;
    if (riotCooldownSeconds > 0) {
      pushToast({ type: "yellow", title: "Riot refroidit", text: `Réessaie dans ${formatCountdown(riotCooldownSeconds)}.` });
      return;
    }
    setSyncingPlayerId(player.id);
    try {
      const result = await apiFetch("players-sync-most-played", { method: "POST", body: JSON.stringify({ teamId: selectedTeam.id, playerId: player.id }) });
      await refreshAll();
      const firstFailed = result.results?.find((item) => !item.ok);
      if (firstFailed?.code === "RIOT_RATE_LIMIT") {
        const retryAfter = Number(firstFailed.retryAfter || 120);
        setRiotCooldownUntil(Date.now() + Math.max(30, retryAfter) * 1000);
      }
      if (firstFailed) {
        pushToast({ type: "yellow", title: "Analyse incomplète", text: `${player.name} n'a pas été analysé : ${firstFailed.error}` });
      } else {
        pushToast({ type: "green", title: "Profil analysé", text: `${player.name} est à jour.` });
      }
    } catch (err) {
      if (err.code === "RIOT_RATE_LIMIT" || err.status === 429) {
        const retryAfter = Number(err.retryAfter || 120);
        setRiotCooldownUntil(Date.now() + Math.max(30, retryAfter) * 1000);
      }
      pushToast({ type: "red", title: "Analyse impossible", text: err.message });
    } finally {
      setSyncingPlayerId("");
    }
  }

  async function deleteTeam() {
    if (!selectedTeam) return;
    const confirmed = window.confirm(`Supprimer définitivement la team "${selectedTeam.name}" ? Cette action supprime aussi roster, matchs, reviews et invitations liés.`);
    if (!confirmed) return;

    setSaving(true);
    try {
      await apiFetch("teams-delete", { method: "POST", body: JSON.stringify({ teamId: selectedTeam.id }) });
      setSelectedTeamId(null);
      await refreshAll();
      pushToast({ type: "green", title: "Team supprimée", text: "La structure et ses données liées ont été supprimées." });
    } catch (err) {
      pushToast({ type: "red", title: "Suppression impossible", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  if (managementOnly) return <div className="nxt5-data-dense">
    <PageHeader eyebrow="Gestion" title="Gestion de l’équipe" subtitle="Permissions, liaisons de comptes, création de profils et santé des données de l’équipe." />
    {selectedTeam ? <div className="space-y-5">
      <TeamDataHealthPanel team={selectedTeam} players={data.players || []} matches={data.matches || []} />
      <TeamManagementPanel team={selectedTeam} edit={teamEdit} setEdit={setTeamEdit} onAvatarFile={loadTeamAvatar} onSaveTeam={updateTeam} onCopyInvite={copyInviteLink} canManage={canManageTeam} canDeleteTeam={canDeleteTeam} members={teamMembers} roster={roster} inviteCodes={inviteCodes} saving={saving} onRoleChange={updateMemberRole} onRosterStatusChange={updatePlayerRosterStatus} onLink={linkPlayerAccount} onRemoveMember={removeMember} onDeletePlayer={deletePlayer} onDeleteTeam={deleteTeam} playerForm={playerForm} setPlayerForm={setPlayerForm} onCreatePlayer={createPlayer} editingPlayer={editingPlayer} playerEditForm={playerEditForm} setPlayerEditForm={setPlayerEditForm} onUpdatePlayer={updatePlayer} onClosePlayerEdit={closePlayerEdit} onEditPlayer={openPlayerEdit} />
    </div> : <Surface glow><EmptyState icon={Users} title="Aucune équipe" text="Crée ou rejoins une équipe avant d’ouvrir la gestion." /></Surface>}
  </div>;

  return <div><PageHeader eyebrow="Équipe" title={hasTeams ?"Ton équipe" : "Créer ou rejoindre une team"} subtitle={hasTeams ?"Roster, champions joués et statistiques de profils de l’équipe active." : "Première décision simple : tu crées une nouvelle structure, ou tu rejoins celle de ton staff avec un code."}>{hasTeams && <Button type="button" variant="ghost" icon={teamSetupOpen ? X : UserPlus} onClick={() => { if (teamSetupOpen) { setTeamSetupOpen(false); openAppPath("/equipes"); } else setTeamSetupOpen(true); }}>{teamSetupOpen ? "Fermer les formulaires" : "Créer ou rejoindre une équipe"}</Button>}</PageHeader>
    {!hasTeams && <Surface className="mb-5 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <Badge tone="cyan">Démarrage</Badge>
          <h3 className="mt-2 text-xl font-black text-white">Le plus simple pour commencer</h3>
          <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-slate-300">Si tu es capitaine ou coach, crée la team. Si quelqu'un t'a envoyé un code, rejoins directement. Le roster et les imports viennent après.</p>
        </div>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-3">
        {[["1", "Créer ou rejoindre", "Tu choisis l'entrée adaptée à ta situation."], ["2", "Ajouter le roster", "TOP, JGL, MID, ADC, SUP et staff."], ["3", "Importer une game", "NXT5 commence alors à expliquer l'équipe."]].map(([number, title, text]) => <div key={title} className="rounded-xl border border-white/10 bg-white/[0.035] p-3"><p className="text-xs font-black text-cyan-100">{number}</p><p className="mt-1 text-sm font-black text-white">{title}</p><p className="mt-1 text-xs font-semibold leading-5 text-slate-400">{text}</p></div>)}
      </div>
    </Surface>}
    <div className={cx("grid gap-5", (!hasTeams || teamSetupOpen) && "xl:grid-cols-2")}>
      {(!hasTeams || teamSetupOpen) && <div className="space-y-5">
        <Surface glow>
          <h3 className="text-xl font-black text-white">Créer une team</h3>
          <p className="mt-1 text-sm text-slate-300">Pour lancer une nouvelle structure, créer son roster et importer ses games.</p>
          <form onSubmit={createTeam} className="mt-5 space-y-4">
            <TextInput label="Nom de team" value={teamForm.name} onChange={(name) => setTeamForm({ ...teamForm, name })} placeholder="Nom de l'équipe" required icon={Trophy} />
            <TextInput label="Tag" value={teamForm.tag} onChange={(tag) => setTeamForm({ ...teamForm, tag })} placeholder="TAG" required icon={Shield} />
            <SelectInput label="Région" value={teamForm.region} onChange={(region) => setTeamForm({ ...teamForm, region })}><option>EUW</option><option>EUNE</option><option>NA</option><option>KR</option><option>BR</option><option>LAN</option><option>LAS</option><option>JP</option><option>OCE</option><option>TR</option></SelectInput>
            <TextAreaInput label="Multi OP.GG ou Riot IDs" value={teamForm.multiOpgg} onChange={(multiOpgg) => setTeamForm({ ...teamForm, multiOpgg })} placeholder={"Colle un lien multi OP.GG ou une liste :\nToplaner#EUW\nJungler#EUW\nMidlaner#EUW\nADC#EUW\nSupport#EUW"} icon={Clipboard} />
            {multiPlayers.length > 0 && <div className="rounded-2xl border border-cyan-300/15 bg-cyan-400/10 p-3"><p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-100">{multiPlayers.length} joueur{multiPlayers.length > 1 ?"s" : ""} détecté{multiPlayers.length > 1 ?"s" : ""}</p><div className="mt-2 flex flex-wrap gap-2">{multiPlayers.map((player, index) => <Badge key={player.riotId} tone={index < 5 ?"cyan" : "slate"}>{ROSTER_ROLE_ORDER[index] || "SUB"} · {player.riotId}</Badge>)}</div></div>}
            <Button type="submit" disabled={saving} icon={saving ?Loader2 : Plus} className="w-full">Créer la team</Button>
          </form>
        </Surface>

        <Surface glow>
          <h3 className="text-xl font-black text-white">Rejoindre une team</h3>
          <p className="mt-1 text-sm text-slate-300">Demande au coach, manager ou capitaine un code temporaire. Il expire après 1h.</p>
          <form onSubmit={joinTeam} className="mt-5 space-y-4">
            <TextInput label="Code d’invitation" value={joinCode} onChange={setJoinCode} placeholder="NXT5-ABC123" required icon={UserPlus} />
            <Button type="submit" disabled={saving || !joinCode.trim()} icon={saving ?Loader2 : ArrowRight} className="w-full">Rejoindre la team</Button>
          </form>
        </Surface>

      </div>}

      {selectedTeam && <div className="space-y-5">
        <TeamCoachDashboard team={selectedTeam} players={data.players || []} matches={data.matches || []} championPool={data.championPool || data.champion_pool || []} />
        <Surface glow>
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div><h3 className="text-2xl font-black text-white">{selectedTeam.name}</h3><p className="mt-1 text-sm text-slate-300">Roster lisible, champions joués et statistiques de profils.</p></div>
            <div className="flex flex-wrap justify-end gap-2"><Button type="button" icon={Clipboard} onClick={() => copyMultiOpggLink(mainTeamRoster, "Main Team")} disabled={!mainTeamRoster.length}>Copier Main Team · {mainTeamRoster.length}</Button><Button type="button" variant="ghost" icon={Clipboard} onClick={() => copyMultiOpggLink(substituteRoster, "Subs")} disabled={!substituteRoster.length}>Copier Subs · {substituteRoster.length}</Button><Badge tone="purple">{selectedTeam.tag || "TEAM"}</Badge></div>
          </div>

          <>
            <PremiumRosterTable roster={roster} matches={data.matches || []} region={selectedTeam.region} currentUserId={user?.id} />
          </>
        </Surface>
      </div>}
    </div>
  </div>;
}

function TeamCoachDashboard({ team, players = [], matches = [], championPool = [] }) {
  const teamMatches = matches.filter((match) => match.team_id === team?.id);
  const teamPlayers = sortPlayersByRole(players.filter((player) => player.team_id === team?.id && isGameplayRole(player.role)));
  const wins = teamMatches.filter((match) => match.result === "Victoire").length;
  const winrate = Math.round((wins / Math.max(1, teamMatches.length)) * 100);
  const alerts = buildStaffAlerts(teamMatches, teamPlayers);
  const rows = teamMatchRows(teamMatches, "ALLY");
  const poolByRole = ROSTER_ROLE_ORDER.map((role) => {
    const manual = championPool.filter((row) => row.team_id === team?.id && normalizeProfileRole(row.role) === role);
    const imported = rows.filter((row) => row.role === role);
    const picks = Array.from([...manual.map((row) => row.champion), ...imported.map((row) => row.champion)].reduce((map, champion) => map.set(champion, (map.get(champion) || 0) + 1), new Map()).entries()).sort((a, b) => b[1] - a[1]).slice(0, 3);
    return { role, picks };
  });
  return <Surface glow className="mb-5 overflow-hidden p-0">
    <div className="grid gap-0 2xl:grid-cols-[minmax(0,1.1fr)_minmax(20rem,.9fr)]">
      <div className="min-w-0 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2"><Badge tone="cyan">Résumé équipe</Badge><Badge tone={teamMatches.length >= 3 ? "green" : "slate"}>{teamMatches.length} games</Badge></div>
        <h3 className="mt-3 break-words text-2xl font-black text-white">Décisions staff de la semaine</h3>
        <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-slate-300">Priorité de l’équipe, joueur à revoir, pick à garder et game associée.</p>
        <HomeActionSummary matches={teamMatches} alerts={alerts} />
      </div>
      <aside className="border-t border-white/10 bg-black/24 p-4 sm:p-5 2xl:border-l 2xl:border-t-0">
        <div className="flex items-center justify-between gap-3"><div><p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-slate-400">Bloc actif</p><p className="mt-1 text-2xl font-black text-white">{teamMatches.length ? `${winrate}% WR` : "--"}</p></div><Button type="button" variant="ghost" icon={ArrowRight} onClick={() => openAppPath("/tendances")}>Tendances</Button></div>
        <div className="mt-4 grid gap-2">
          {alerts.length ? alerts.slice(0, 3).map((alert) => <div key={alert.title} className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
            <div className="flex items-center gap-2"><span className={cx("grid h-7 w-7 place-items-center rounded-lg", tone(alert.toneName))}><alert.icon className="h-3.5 w-3.5" /></span><p className="text-sm font-black text-white">{alert.title}</p></div>
            <p className="mt-1 text-xs font-semibold leading-5 text-slate-300">{alert.text}</p>
          </div>) : <p className="rounded-xl border border-dashed border-white/10 bg-black/20 p-3 text-sm font-semibold text-slate-300">Importe quelques games pour générer les alertes staff.</p>}
        </div>
      </aside>
    </div>
    <div className="border-t border-white/10 p-4">
      <div className="grid gap-2 lg:grid-cols-5">{poolByRole.map((entry) => <div key={entry.role} className="min-w-0 rounded-xl bg-white/[0.025] p-3">
        <div className="flex items-center gap-2"><RoleIcon role={entry.role} className="h-4 w-4 text-cyan-100" /><p className="text-xs font-black uppercase tracking-[0.12em] text-white">{roleLabel(entry.role)}</p></div>
        <p className="mt-2 truncate text-xs font-semibold text-slate-300">{entry.picks.length ? entry.picks.map(([champion]) => championDisplayName(champion)).join(" · ") : "Pool à remplir"}</p>
      </div>)}</div>
    </div>
  </Surface>;
}

function TeamManagementPanel({ team, edit, setEdit, onAvatarFile, onSaveTeam, onCopyInvite, canManage, canDeleteTeam, members, roster, inviteCodes = [], saving, onRoleChange, onRosterStatusChange, onLink, onRemoveMember, onDeletePlayer, onDeleteTeam, playerForm, setPlayerForm, onCreatePlayer, editingPlayer, playerEditForm, setPlayerEditForm, onUpdatePlayer, onClosePlayerEdit, onEditPlayer }) {
  const [nowTick, setNowTick] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const linkedPlayerByUser = new Map(roster.filter((player) => player.user_id).map((player) => [player.user_id, player]));
  const memberByUser = new Map(members.map((member) => [member.user_id, member]));
  const unlinkedMemberRows = members.filter((member) => !linkedPlayerByUser.has(member.user_id));
  const linkedCount = roster.filter((player) => player.user_id).length;
  const gameplayCount = roster.filter((player) => isGameplayRole(player.role)).length;
  const staffCount = roster.filter((player) => isStaffRole(player.role)).length;
  const activeCodes = inviteCodes.filter((code) => new Date(code.expires_at).getTime() > nowTick);
  const roleValue = (role) => TEAM_ACCESS_ROLES.some(([id]) => id === String(role || "").toLowerCase()) ? String(role || "").toLowerCase() : "player";
  const linkedProfileLabel = (member) => {
    const linked = linkedPlayerByUser.get(member.user_id);
    const accountName = member.name || member.account_name || "Compte NXT5";
    return linked ? accountName + " · " + (linked.riot_id || roleLabel(linked.role)) : accountName + " · Non-lié";
  };
  const isLinkedElsewhere = (member, player) => {
    const linked = linkedPlayerByUser.get(member.user_id);
    return Boolean(linked && linked.id !== player.id);
  };
  return <Surface glow className="mb-6 p-5 md:p-6">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <Badge tone="cyan">Gestion</Badge>
        <h3 className="mt-3 truncate text-3xl font-black tracking-tight text-white md:text-4xl">{team.name}</h3>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-300">Identité, invitations, profils liés et permissions. Tout est regroupé ici pour aller vite.</p>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center sm:min-w-[360px]">
        <div className="rounded-2xl border border-emerald-300/15 bg-emerald-400/10 p-3"><p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-emerald-100/80">Liés</p><p className="mt-1 text-2xl font-black text-white">{linkedCount}/{roster.length}</p></div>
        <div className="rounded-2xl border border-cyan-300/15 bg-cyan-400/10 p-3"><p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-cyan-100/80">Joueurs</p><p className="mt-1 text-2xl font-black text-white">{gameplayCount}</p></div>
        <div className="rounded-2xl border border-fuchsia-300/15 bg-fuchsia-400/10 p-3"><p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-fuchsia-100/80">Staff</p><p className="mt-1 text-2xl font-black text-white">{staffCount}</p></div>
      </div>
    </div>

    <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(260px,.7fr)_minmax(0,1.3fr)]">
      <form onSubmit={onSaveTeam} className="rounded-3xl border border-white/10 bg-black/22 p-4">
        <div className="flex items-center gap-4">
          <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-cyan-300/25 bg-black/30">
            {edit.avatarDataUrl ? <img src={edit.avatarDataUrl} alt={team.name} className="h-full w-full object-cover" loading="lazy" decoding="async" style={{ transform: "scale(" + Number(edit.avatarZoom || 1) + ")", objectPosition: Number(edit.avatarX ?? 50) + "% " + Number(edit.avatarY ?? 50) + "%" }} /> : <div className="flex h-full w-full items-center justify-center"><ImageIcon className="h-9 w-9 text-slate-400" /></div>}
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <TextInput label="Nom de l'équipe" value={edit.name} onChange={(name) => setEdit({ ...edit, name })} placeholder="Nom" required icon={Trophy} />
            <TextInput label="Tag" value={edit.tag} onChange={(tag) => setEdit({ ...edit, tag })} placeholder="TAG" required icon={Shield} />
          </div>
        </div>
        <details className="mt-4 rounded-2xl border border-white/10 bg-white/[0.035] p-3">
          <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.16em] text-cyan-100">Image de team</summary>
          <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.045] px-4 py-3 text-sm font-black text-cyan-100 transition hover:bg-white/[0.07]"><Upload className="h-4 w-4" /> Choisir une image<input type="file" accept="image/*" className="hidden" onChange={(event) => onAvatarFile(event.target.files?.[0])} disabled={!canManage || saving} /></label>
          <div className="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <label className="block"><span className="mb-2 block text-[0.66rem] font-black uppercase tracking-[0.18em] text-slate-300">Zoom</span><input type="range" min="1" max="2.5" step="0.05" value={edit.avatarZoom} onChange={(event) => setEdit({ ...edit, avatarZoom: event.target.value })} disabled={!canManage || saving} className="w-full" /></label>
            <label className="block"><span className="mb-2 block text-[0.66rem] font-black uppercase tracking-[0.18em] text-slate-300">Horizontal</span><input type="range" min="0" max="100" value={edit.avatarX} onChange={(event) => setEdit({ ...edit, avatarX: event.target.value })} disabled={!canManage || saving} className="w-full" /></label>
            <label className="block"><span className="mb-2 block text-[0.66rem] font-black uppercase tracking-[0.18em] text-slate-300">Vertical</span><input type="range" min="0" max="100" value={edit.avatarY} onChange={(event) => setEdit({ ...edit, avatarY: event.target.value })} disabled={!canManage || saving} className="w-full" /></label>
          </div>
        </details>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="submit" icon={saving ? Loader2 : Check} disabled={saving || !canManage}>Enregistrer</Button>
          {canDeleteTeam && <Button type="button" variant="danger" icon={saving ? Loader2 : Trash2} onClick={onDeleteTeam} disabled={saving}>Supprimer</Button>}
        </div>
        {!canManage && <p className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-400/10 p-3 text-sm font-semibold text-amber-100">Ton statut actuel ne permet pas de modifier la gestion.</p>}
      </form>

      <div className="rounded-3xl border border-cyan-300/14 bg-cyan-400/[0.045] p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h4 className="text-xl font-black text-white">Invitations temporaires</h4>
            <p className="mt-1 text-sm font-semibold text-slate-300">Un code, valable 1h, à donner au joueur ou au staff.</p>
          </div>
          <Button type="button" variant="ghost" icon={saving ? Loader2 : UserPlus} onClick={onCopyInvite} disabled={saving || !canManage}>Créer un code</Button>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {activeCodes.length ? activeCodes.map((code) => {
            const remaining = Math.max(0, Math.ceil((new Date(code.expires_at).getTime() - nowTick) / 1000));
            return <div key={code.id} className="rounded-2xl border border-white/10 bg-black/25 p-3">
              <div className="flex items-center justify-between gap-3"><p className="font-mono text-lg font-black tracking-[0.08em] text-white">{code.code}</p><Badge tone={remaining > 900 ? "green" : remaining > 300 ? "yellow" : "red"}>{formatCountdown(remaining)}</Badge></div>
              <p className="mt-1 truncate text-xs font-semibold text-slate-300">Créé par {code.created_by_name || "staff"}</p>
            </div>;
          }) : <p className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm font-semibold text-slate-300 md:col-span-2">Aucun code actif.</p>}
        </div>
      </div>
    </div>

    <div className="mt-6 rounded-3xl border border-cyan-300/14 bg-cyan-400/[0.045] p-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div><h4 className="text-xl font-black text-white">Créer un profil</h4><p className="mt-1 text-sm font-semibold text-slate-300">Ajoute un joueur ou un membre staff, puis lie-le à un compte NXT5 si besoin.</p></div>
        <Badge tone="purple">Gestion roster</Badge>
      </div>
      <form onSubmit={onCreatePlayer} className="mt-4 grid gap-3 md:grid-cols-2 2xl:grid-cols-6">
        <TextInput label="Nom" value={playerForm.name} onChange={(name) => setPlayerForm({ ...playerForm, name })} placeholder="Nom du joueur ou staff" required />
        <TextInput label="Riot ID" value={playerForm.riotId} onChange={(riotId) => setPlayerForm({ ...playerForm, riotId })} placeholder={isStaffRole(playerForm.role) ? "Optionnel pour staff" : "Pseudo#TAG"} required={!isStaffRole(playerForm.role)} disabled={isStaffRole(playerForm.role)} />
        <TextInput label="OP.GG" value={playerForm.opggUrl} onChange={(opggUrl) => setPlayerForm({ ...playerForm, opggUrl })} placeholder={isStaffRole(playerForm.role) ? "Non utilisé pour staff" : "https://op.gg/..."} disabled={isStaffRole(playerForm.role)} />
        <SelectInput label="Catégorie" value={playerForm.role} onChange={(role) => setPlayerForm({ ...playerForm, role, riotId: isStaffRole(role) ? "" : playerForm.riotId, opggUrl: isStaffRole(role) ? "" : playerForm.opggUrl, rosterStatus: isStaffRole(role) ? "INACTIVE" : role === "SUB" ? "SUB" : playerForm.rosterStatus === "INACTIVE" ? "AUTO" : playerForm.rosterStatus })}>{PROFILE_ROLES.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}</SelectInput>
        <SelectInput label="Effectif" value={playerForm.rosterStatus} onChange={(rosterStatus) => setPlayerForm({ ...playerForm, rosterStatus })} disabled={isStaffRole(playerForm.role) || playerForm.role === "SUB"}><option value="AUTO">Automatique</option>{ROSTER_STATUS_OPTIONS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</SelectInput>
        <div className="flex items-end"><Button type="submit" disabled={saving || !canManage} icon={saving ? Loader2 : UserPlus} className="w-full">Ajouter</Button></div>
      </form>
      {editingPlayer && <form onSubmit={onUpdatePlayer} className="mt-5 rounded-[1.35rem] border border-cyan-300/20 bg-cyan-400/10 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><Badge tone="orange">Modification</Badge><h4 className="mt-3 text-xl font-black text-white">Modifier {editingPlayer.name}</h4><p className="mt-1 text-sm font-semibold text-cyan-100/80">Corrige le nom, le Riot ID ou l’OP.GG du profil.</p></div><Button type="button" variant="ghost" icon={X} onClick={onClosePlayerEdit}>Fermer</Button></div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4"><TextInput label="Nom" value={playerEditForm.name} onChange={(name) => setPlayerEditForm({ ...playerEditForm, name })} placeholder="Nom visible" required /><TextInput label="Riot ID" value={playerEditForm.riotId} onChange={(riotId) => setPlayerEditForm({ ...playerEditForm, riotId })} placeholder={isStaffRole(editingPlayer.role) ? "Non utilisé pour staff" : "Pseudo#TAG"} required={!isStaffRole(editingPlayer.role)} disabled={isStaffRole(editingPlayer.role)} /><TextInput label="OP.GG" value={playerEditForm.opggUrl} onChange={(opggUrl) => setPlayerEditForm({ ...playerEditForm, opggUrl })} placeholder={isStaffRole(editingPlayer.role) ? "Non utilisé pour staff" : "https://op.gg/..."} disabled={isStaffRole(editingPlayer.role)} /><SelectInput label="Effectif" value={playerEditForm.rosterStatus} onChange={(rosterStatus) => setPlayerEditForm({ ...playerEditForm, rosterStatus })} disabled={isStaffRole(editingPlayer.role) || editingPlayer.role === "SUB"}>{ROSTER_STATUS_OPTIONS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</SelectInput></div>
        <div className="mt-4 flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClosePlayerEdit}>Annuler</Button><Button type="submit" icon={saving ? Loader2 : Check} disabled={saving || !canManage}>Enregistrer</Button></div>
      </form>}
    </div>

    <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.035] p-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div><h4 className="text-xl font-black text-white">Profils & accès</h4><p className="mt-1 text-sm font-semibold text-slate-300">Lie un compte, choisis son accès, et retire un profil depuis la même ligne.</p></div>
        <Badge tone="purple">{roster.length} profil{roster.length > 1 ? "s" : ""}</Badge>
      </div>
      <div className="nxt5-management-profiles mt-4 space-y-2">
        {roster.map((player) => {
          const linkedMember = player.user_id ? memberByUser.get(player.user_id) : null;
          const staff = isStaffRole(player.role);
          return <div key={player.id} className={cx("nxt5-management-profile rounded-2xl border p-3", player.user_id ? "border-emerald-300/18 bg-emerald-400/[0.045]" : "border-cyan-300/14 bg-black/22")}>
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-2"><RoleTag role={player.role} staff={staff} className="max-w-[7rem] sm:max-w-[8.5rem]" /><Badge tone={player.user_id ? "green" : "orange"}>{player.user_id ? "Lié" : "Non-lié"}</Badge>{!staff && <label><span className="sr-only">Effectif de {player.name}</span><select value={playerRosterStatus(player)} onChange={(event) => onRosterStatusChange?.(player, event.target.value)} disabled={saving || !canManage || player.role === "SUB"} title="Groupe d’effectif" className="rounded-full border border-cyan-200/20 bg-[#081322] px-2.5 py-1 text-[0.66rem] font-black uppercase text-cyan-50 outline-none transition hover:border-cyan-200/40 disabled:cursor-not-allowed disabled:opacity-45">{ROSTER_STATUS_OPTIONS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>}</div>
              <p className="mt-2 truncate text-lg font-black text-white">{linkedMember?.name || linkedMember?.account_name || player.name}</p>
              <p className="truncate text-xs font-semibold text-slate-300">{player.riot_id || (staff ? "Staff" : "Riot ID manquant")}</p>
            </div>
            <label className="block min-w-0"><span className="mb-1 block text-[0.62rem] font-black uppercase tracking-[0.16em] text-slate-300">Compte lié</span><select value={player.user_id || ""} onChange={(event) => onLink(player.id, event.target.value)} disabled={saving || !canManage} className="w-full rounded-xl border border-white/10 bg-black/[0.22] px-3 py-2 text-sm font-black text-white outline-none"><option value="">Non-lié</option>{members.map((member) => { const blocked = isLinkedElsewhere(member, player); return <option key={member.user_id} value={member.user_id} disabled={blocked}>{linkedProfileLabel(member)}{blocked ? " · Déjà lié" : ""}</option>; })}</select></label>
            <label className="block min-w-0"><span className="mb-1 block text-[0.62rem] font-black uppercase tracking-[0.16em] text-slate-300">Accès</span><select value={linkedMember ? roleValue(linkedMember.role) : "player"} onChange={(event) => linkedMember && onRoleChange(linkedMember.user_id, event.target.value)} disabled={!linkedMember || saving || !canManage || String(linkedMember?.role || "").toLowerCase() === "owner"} className="w-full rounded-xl border border-white/10 bg-black/[0.22] px-3 py-2 text-sm font-black text-white outline-none">{TEAM_ACCESS_ROLES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
            <div className="nxt5-management-actions">
              {linkedMember && <Button type="button" variant="ghost" icon={UserMinus} className="px-3" onClick={() => onRemoveMember(linkedMember.user_id, roleLabel(player.role) + " · " + (linkedMember.name || player.name))} disabled={saving || !canManage || String(linkedMember.role || "").toLowerCase() === "owner"}><span>Renvoyer</span></Button>}
              <Button type="button" variant="ghost" icon={Pencil} className="px-3" onClick={() => onEditPlayer(player)} disabled={saving || !canManage}><span>Modifier</span></Button>
              <Button type="button" variant="danger" icon={Trash2} className="px-3" onClick={() => onDeletePlayer(player.id, player.name)} disabled={saving || !canManage}><span>Supprimer</span></Button>
            </div>
          </div>;
        })}
      </div>
    </div>

    {unlinkedMemberRows.length > 0 && <div className="mt-5 rounded-3xl border border-fuchsia-300/14 bg-fuchsia-400/[0.045] p-4">
      <h4 className="text-xl font-black text-white">Comptes sans profil</h4>
      <div className="mt-4 grid gap-2 lg:grid-cols-2">
        {unlinkedMemberRows.map((member) => <div key={member.id} className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/25 p-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0"><div className="flex flex-wrap gap-2"><Badge tone="slate">Non-lié</Badge><Badge tone={profileStatusTone(member)}>{profileStatusLabel(member)}</Badge></div><p className="mt-2 truncate text-sm font-black text-white">{member.name || member.account_name || "Compte invité"}</p></div>
          <div className="flex flex-wrap gap-2"><select value={roleValue(member.role)} onChange={(event) => onRoleChange(member.user_id, event.target.value)} disabled={saving || !canManage || String(member.role || "").toLowerCase() === "owner"} className="rounded-xl border border-white/10 bg-black/[0.22] px-3 py-2 text-sm font-black text-white outline-none">{TEAM_ACCESS_ROLES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select><Button type="button" variant="danger" icon={UserMinus} onClick={() => onRemoveMember(member.user_id, member.name || "ce compte non lié")} disabled={saving || !canManage || String(member.role || "").toLowerCase() === "owner"}>Renvoyer</Button></div>
        </div>)}
      </div>
    </div>}
  </Surface>;
}

function ChampionCircle({ champion, index }) {
  return <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-cyan-300/15 bg-cyan-400/10 px-3 py-2"><div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full border border-cyan-200/30 bg-black/35"><ChampionPortrait champion={champion.champion} alt={champion.champion} /></div><div className="min-w-0"><p className="truncate text-sm font-black text-white">{championDisplayName(champion.champion)}</p><p className="text-xs font-black text-cyan-100/75">#{index + 1} · {champion.games || 0} game{champion.games > 1 ? "s" : ""}</p></div></div>;
}

function playerImportedChampionStats(player, matches = []) {
  const rows = playerIntegratedRows(player, matches);
  return Array.from(rows.reduce((map, row) => {
    const champion = row.champion || "Champion";
    const current = map.get(champion) || { champion, games: 0, wins: 0 };
    current.games += 1;
    current.wins += row.match?.result === "Victoire" ? 1 : 0;
    map.set(champion, current);
    return map;
  }, new Map()).values()).sort((a, b) => b.games - a.games || b.wins - a.wins || championDisplayName(a.champion).localeCompare(championDisplayName(b.champion)));
}

function ImportedChampionBadges({ player, matches = [] }) {
  const items = playerImportedChampionStats(player, matches).slice(0, 3);
  if (!items.length) return <span className="text-xs font-semibold text-slate-300">Aucune game importee pour ce profil</span>;
  return <div className="flex flex-wrap gap-2">{items.map((champion, index) => <ChampionCircle key={(champion.championId || champion.champion) + "-imported-" + index} champion={champion} index={index} />)}</div>;
}

function PremiumRosterTable({ roster, matches = [], region = "EUW", currentUserId = "", canManage = false, saving = false, syncingPlayerId = "", riotCooldownSeconds = 0, onCopyOpgg, onSyncPlayer, onEditPlayer, onDeletePlayer }) {
  const openProfile = (player) => {
    if (!isStaffRole(player.role)) openAppPath(`/mon-profil?player=${encodeURIComponent(player.id)}`);
  };
  if (!roster.length) return <div className="mt-6"><EmptyState icon={UserPlus} title="Aucun profil" text="Ajoute tes joueurs et ton staff pour préparer les reviews." /></div>;
  const sortRosterSection = (items) => [...items].sort((a, b) => rosterRoleIndex(a.role) - rosterRoleIndex(b.role) || String(a.name || "").localeCompare(String(b.name || "")));
  const gameplayRoster = roster.filter((item) => !isStaffRole(item.role));
  const mainRoster = sortRosterSection(gameplayRoster.filter((item) => playerRosterStatus(item) === "MAIN"));
  const subRoster = sortRosterSection(gameplayRoster.filter((item) => playerRosterStatus(item) === "SUB"));
  const inactiveRoster = sortRosterSection(gameplayRoster.filter((item) => playerRosterStatus(item) === "INACTIVE"));
  const staffRoster = roster.filter((item) => isStaffRole(item.role));
  const showActions = Boolean(onCopyOpgg || onSyncPlayer || onEditPlayer || onDeletePlayer);
  const renderSection = (items, title, subtitle, Icon, emptyText) => (
    <div className="overflow-hidden rounded-[1.35rem] border border-cyan-300/14 bg-white/[0.028] shadow-[0_0_38px_rgba(34,211,238,.055)]">
      <div className="flex flex-col gap-3 border-b border-white/10 bg-black/25 px-4 py-4 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-400/10 text-cyan-100"><Icon className="h-5 w-5" /></div>
          <div className="min-w-0">
            <h3 className="truncate text-xl font-black text-white">{title}</h3>
            <p className="mt-1 text-sm font-semibold text-slate-300">{subtitle}</p>
          </div>
        </div>
        <Badge tone={items.length ? "cyan" : "slate"}>{items.length} profil{items.length > 1 ? "s" : ""}</Badge>
      </div>
      {items.length ? <><div className="grid gap-3 p-3 md:hidden">
        {items.map((item) => {
          const staff = isStaffRole(item.role);
          const hasOpgg = !staff && Boolean(String(item.opgg_url || "").trim() || opggUrlFromRiotId(item.riot_id, region));
          const isLinkedToMe = String(item.user_id || "") === String(currentUserId || "");
          return <div key={item.id} className="rounded-2xl border border-white/10 bg-black/[0.18] p-3 transition hover:border-cyan-300/25 hover:bg-white/[0.04]"><button type="button" onClick={() => openProfile(item)} disabled={staff} className="flex w-full items-start justify-between gap-3 text-left disabled:cursor-default"><div className="flex min-w-0 items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/25">{isGameplayRole(item.role) ? <RoleIcon role={item.role} className="h-4 w-4" /> : <Users className="h-4 w-4 text-violet-200" />}</div><div className="min-w-0"><div className="flex min-w-0 flex-wrap items-center gap-2"><RoleTag role={item.role} staff={staff} className="max-w-[7rem]" />{isLinkedToMe && <Badge tone="orange">Mon profil</Badge>}{item.user_id && !isLinkedToMe && <Badge tone="green">Lié</Badge>}</div><p className="mt-2 truncate text-lg font-black text-white">{item.name}</p><p className="mt-1 truncate text-xs font-semibold text-slate-300">{staff ? "Non utilisé dans OP.GG" : item.riot_id || "Sans Riot ID"}</p></div></div>{!staff && <ArrowRight className="mt-2 h-5 w-5 shrink-0 text-cyan-100" />}</button><div className="mt-4">{staff ?<span className="text-xs font-semibold text-slate-300">Hors draft / OP.GG</span> : <ImportedChampionBadges player={item} matches={matches} />}</div>{showActions && <div className="mt-4 grid grid-cols-4 gap-2"><button type="button" onClick={(event) => { event.stopPropagation(); onCopyOpgg?.(item); }} disabled={!hasOpgg} title={staff ? "Pas d'OP.GG pour staff" : "Copier l'OP.GG"} className="inline-flex h-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.045] text-cyan-100 transition hover:border-cyan-300/35 hover:bg-cyan-400/10 disabled:cursor-not-allowed disabled:opacity-35"><Clipboard className="h-4 w-4" /></button><button type="button" onClick={(event) => { event.stopPropagation(); onSyncPlayer?.(item); }} disabled={staff || !canManage || saving || syncingPlayerId === item.id || riotCooldownSeconds > 0} title={riotCooldownSeconds > 0 ? `Riot ${formatCountdown(riotCooldownSeconds)}` : "Analyser ce profil"} className="inline-flex h-11 items-center justify-center rounded-xl border border-emerald-300/20 bg-emerald-400/10 text-emerald-100 transition hover:bg-emerald-400/15 disabled:cursor-not-allowed disabled:opacity-35">{syncingPlayerId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}</button><button type="button" onClick={(event) => { event.stopPropagation(); onEditPlayer?.(item); }} disabled={!canManage || saving} title="Modifier le profil" className="inline-flex h-11 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-400/10 text-cyan-100 transition hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-35"><Pencil className="h-4 w-4" /></button><button type="button" onClick={(event) => { event.stopPropagation(); onDeletePlayer?.(item.id, item.name); }} disabled={!canManage || saving} title="Supprimer le profil" className="inline-flex h-11 items-center justify-center rounded-xl border border-rose-300/20 bg-rose-500/10 text-rose-100 transition hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-35"><Trash2 className="h-4 w-4" /></button></div>}</div>;
        })}
      </div><div className="hidden overflow-x-auto md:block">
        <table className={cx("w-full text-left text-sm", showActions ? "min-w-[1040px]" : "min-w-[860px]")}>
          <thead className="sticky top-0 bg-white/[0.055] text-[0.68rem] uppercase tracking-[0.18em] text-slate-300"><tr><th className="px-4 py-3">Rôle</th><th className="px-4 py-3">Joueur</th><th className="px-4 py-3">Riot ID</th><th className="px-4 py-3">Champions les plus joués</th>{showActions && <th className="px-4 py-3 text-right">Actions</th>}</tr></thead>
          <tbody className="divide-y divide-white/10">{items.map((item) => {
    const staff = isStaffRole(item.role);
    const hasOpgg = !staff && Boolean(String(item.opgg_url || "").trim() || opggUrlFromRiotId(item.riot_id, region));
    const isLinkedToMe = String(item.user_id || "") === String(currentUserId || "");
    return <tr key={item.id} onClick={() => openProfile(item)} className={cx("bg-black/[0.12] text-slate-300 transition hover:bg-white/[0.04]", staff ? "cursor-default" : "cursor-pointer")}><td className="px-4 py-4"><div className="flex min-w-0 items-center gap-2">{!staff && <ArrowRight className="h-4 w-4 shrink-0 text-cyan-100" />}<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/25">{isGameplayRole(item.role) ? <RoleIcon role={item.role} className="h-5 w-5" /> : <Users className="h-4 w-4 text-violet-200" />}</div><RoleTag role={item.role} staff={staff} className="max-w-[7.5rem]" /></div></td><td className="px-4 py-4"><div className="flex min-w-0 flex-wrap items-center gap-2"><span className="min-w-0 truncate font-black text-white">{item.name}</span>{isLinkedToMe && <Badge tone="orange">Mon profil</Badge>}{item.user_id && !isLinkedToMe && <Badge tone="green">Lié</Badge>}</div></td><td className="px-4 py-4 font-semibold text-slate-300">{staff ? "Non utilisé" : item.riot_id || "Sans Riot ID"}</td><td className="px-4 py-4">{staff ?<span className="text-xs font-semibold text-slate-300">Hors draft / OP.GG</span> : <ImportedChampionBadges player={item} matches={matches} />}</td>{showActions && <td className="px-4 py-4"><div className="flex justify-end gap-2"><button type="button" onClick={(event) => { event.stopPropagation(); onCopyOpgg?.(item); }} disabled={!hasOpgg} title={staff ? "Pas d'OP.GG pour staff" : "Copier l'OP.GG"} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.045] text-cyan-100 transition hover:border-cyan-300/35 hover:bg-cyan-400/10 disabled:cursor-not-allowed disabled:opacity-35"><Clipboard className="h-4 w-4" /></button><button type="button" onClick={(event) => { event.stopPropagation(); onSyncPlayer?.(item); }} disabled={staff || !canManage || saving || syncingPlayerId === item.id || riotCooldownSeconds > 0} title={riotCooldownSeconds > 0 ? `Riot ${formatCountdown(riotCooldownSeconds)}` : "Analyser ce profil"} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-300/20 bg-emerald-400/10 text-emerald-100 transition hover:bg-emerald-400/15 disabled:cursor-not-allowed disabled:opacity-35">{syncingPlayerId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}</button><button type="button" onClick={(event) => { event.stopPropagation(); onEditPlayer?.(item); }} disabled={!canManage || saving} title="Modifier le profil" className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-400/10 text-cyan-100 transition hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-35"><Pencil className="h-4 w-4" /></button><button type="button" onClick={(event) => { event.stopPropagation(); onDeletePlayer?.(item.id, item.name); }} disabled={!canManage || saving} title="Supprimer le profil" className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-rose-300/20 bg-rose-500/10 text-rose-100 transition hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-35"><Trash2 className="h-4 w-4" /></button></div></td>}</tr>;
          })}</tbody>
        </table>
      </div></> : <div className="p-4"><div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm font-semibold text-slate-300">{emptyText}</div></div>}
    </div>
  );
  return <div className="mt-6 grid gap-5">
    {renderSection(mainRoster, "Main Team", "Les titulaires utilisés par défaut pour le Multi OP.GG, les drafts et les imports.", Users, "Aucun titulaire défini. Passe un profil en Main Team depuis Gestion.")}
    {renderSection(subRoster, "Subs", "Les remplaçants disponibles, avec leur propre Multi OP.GG.", UserPlus, "Aucun remplaçant défini. Passe un profil en Sub depuis Gestion.")}
    {inactiveRoster.length > 0 && renderSection(inactiveRoster, "Hors roster", "Profils conservés sans être inclus dans les lineups OP.GG.", EyeOff, "")}
    {renderSection(staffRoster, "Coaching staff", "Coachs, managers et staff : accès gestion sans présence dans le draft ni OP.GG.", ShieldCheck, "Aucun membre staff ajouté pour le moment.")}
  </div>;
}

export { Teams, parseMultiOpgg, decodeLoose, opggUrlFromRiotId, TeamCoachDashboard, HomeActionSummary, TeamManagementPanel, PROFILE_ROLES, RoleTag, PremiumRosterTable, rosterRoleIndex, ImportedChampionBadges, ChampionCircle, playerImportedChampionStats };
